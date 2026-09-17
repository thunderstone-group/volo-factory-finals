"""V2/Flash -> source diagnosis -> bounded skill patches -> deterministic recheck.

No generated application execution, no hidden evaluator, no native sandbox fallback.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import shutil
import tempfile
import time
from oneshot import main as core, skill_repair as sr, platform_entry, effort_entry
from oneshot.v2 import main as v2
from oneshot.business_feedback import source_id
from . import checks, review

CONTROLS = {'thinking': {'type': 'enabled'}, 'reasoning_effort': 'low'}
MODEL = 'deepseek-v4-flash'


def write(path, value):
    path.write_text(sr._json(sr._safe(value, os.environ.get('OPENAI_API_KEY', '')))+'\n')


def event(stage, **values):
    print('[thin] '+json.dumps({'stage': stage, **values}, ensure_ascii=False), flush=True)


def artifact(app, label):
    """Bounded source receipts permit exact offline A0/B replay when download fails."""
    blobs = core.read_template(app)
    manifest = {p: sr.sha256(b) for p, b in blobs.items()}
    event('artifact_manifest', artifact=label, source_sha256=source_id(app), files=manifest)
    if sum(map(len, blobs.values())) > 512*1024:
        event('artifact_transport_skipped', artifact=label, reason='source_log_budget')
        return
    key = os.environ.get('OPENAI_API_KEY', '').encode()
    for name, blob in sorted(blobs.items()):
        if key and key in blob:
            event('artifact_transport_skipped', artifact=label, reason='credential_in_source')
            return
        encoded = base64.b64encode(blob).decode()
        parts = [encoded[i:i+1800] for i in range(0, len(encoded), 1800)] or ['']
        for number, text in enumerate(parts):
            event('artifact_part', artifact=label, path=name, sha256=manifest[name],
                  part=number, parts=len(parts), data_b64=text)


def pipeline(requirements, evidence, state, *, max_rounds=2):
    if type(max_rounds) is not int or not 0 <= max_rounds <= 2:
        raise ValueError('round_limit')
    config = {'model': os.environ.get('MODEL', MODEL),
              'base_url': os.environ.get('OPENAI_BASE_URL', core.DEFAULT_BASE),
              'api_key': os.environ['OPENAI_API_KEY']}
    if config['model'] != MODEL:
        raise ValueError('this frozen candidate requires deepseek-v4-flash')
    document, identity = v2.adapter.load_inputs(requirements)
    state.update(schema='thin-source/v1', input=identity, model=config['model'],
                 review_calls=0, repair_calls=0, rounds=[], static_accepted=False,
                 runtime_executed=False, browser_executed=False, verified_requirements=[],
                 status='generating', acceptance_scope='delivery_and_syntax_only')
    write(evidence/'state.json', state)
    initial = evidence/'A0'
    event('generation_started', model=config['model'])
    with effort_entry.low_effort_generation(v2.core):
        code = v2.main([str(requirements), '--output-dir', str(initial), '--type', 'web'])
    if code:
        state.update(status='generation_error')
        return
    state['current'] = str(initial)
    state['a0_sha256'] = source_id(initial)
    current_static = checks.check(initial)
    state['static'] = current_static
    write(evidence/'a0-static.json', current_static)
    event('generation_complete', source_sha256=state['a0_sha256'], static_status=current_static['status'])
    artifact(initial, 'A0')
    current = initial
    for number in range(1, max_rounds+1):
        if current_static['status'] in ('environment_error', 'unknown'):
            state['status'] = 'static_unavailable'
            break
        paths = sorted(core.read_template(current))
        event('review_started', round=number)
        findings, trace = review.diagnose(document, current, paths, config)
        state['review_calls'] += len(trace['calls'])
        write(evidence/('review-'+str(number)+'.json'), trace)
        syntax_failures = [r for r in current_static['checks'] if r['status'] == 'product_fail']
        event('review_complete', round=number, findings=len(findings) if findings is not None else None,
              status=trace['status'], model_calls=state['review_calls'])
        observations = [{'requirement': f['requirement'],
                         'observation': 'SOURCE DIAGNOSIS, not browser evidence: '+f['observation']}
                        for f in (findings or [])]
        observations += [{'requirement': 'Delivery contract: complete syntactically valid application files.',
                          'observation': 'Deterministic '+r['id']+': '+r['detail']} for r in syntax_failures]
        if not observations:
            state['status'] = 'no_supported_findings' if findings is not None else 'review_unavailable'
            break
        remaining = 6-state['repair_calls']
        if remaining <= 0:
            state['status'] = 'repair_call_limit'
            break
        row = {'round': number, 'source_sha256': source_id(current),
               'findings': findings, 'static_accepted': False}
        state['rounds'].append(row)
        source = sr.load_source(current, paths, protected_paths=list(v2.PROTECTED))
        event('repair_started', round=number)
        try:
            result = sr.propose(source, observations, **config,
                                limits=sr.Limits(max_calls=min(3, remaining), request_timeout=300,
                                                 max_output_tokens=16384),
                                requirement_document=document, request_controls=CONTROLS)
        except sr.RepairError as exc:
            state['repair_calls'] += len(exc.trace.get('calls', []))
            row['diagnostic'] = sr.safe_diagnostics(exc.trace)
            write(evidence/('repair-'+str(number)+'.json'), exc.trace)
            state['status'] = 'model_error'
            event('repair_failed', round=number, diagnostic=row['diagnostic'])
            break
        state['repair_calls'] += len(result['trace'].get('calls', []))
        write(evidence/('repair-'+str(number)+'.json'), result)
        row['diagnostic'] = sr.safe_diagnostics(result['trace'])
        proposal = sr.validate_proposal(result['proposal'], source)
        if not proposal['edits']:
            state['status'] = 'no_change'
            break
        candidate = evidence/('candidate-'+str(number))
        sr.apply_proposal(source, proposal, candidate)
        after = checks.check(candidate)
        row.update(static=after, candidate_sha256=source_id(candidate), edits=len(proposal['edits']))
        write(evidence/('candidate-'+str(number)+'-static.json'), after)
        if not checks.nonregressing(current_static, after):
            state['status'] = 'candidate_rejected_by_static_checks'
            event('candidate_rejected', round=number, static_status=after['status'])
            break
        row['static_accepted'] = state['static_accepted'] = True
        current, current_static = candidate, after
        state.update(current=str(current), static=current_static, status='partial_static_retained')
        write(evidence/'state.json', state)
        event('candidate_static_pass', round=number, edits=row['edits'],
              source_sha256=row['candidate_sha256'], business_verified=False)
    if source_id(initial) != state['a0_sha256']:
        raise ValueError('original_changed')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('requirement_path', type=Path)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--type', choices=('web',), default='web')
    args = parser.parse_args(argv)
    os.umask(0o077)
    state = {'status': 'starting', 'delivered': False, 'runtime_executed': False,
             'browser_executed': False, 'verified_requirements': []}
    evidence = None
    started = time.monotonic()
    try:
        output = platform_entry.check_output(args.output_dir)
        if (output/'.volo-thin').exists() or (output/'.volo-thin').is_symlink():
            raise ValueError('existing_evidence_would_be_overwritten')
        output.parent.mkdir(parents=True, exist_ok=True)
        evidence = Path(tempfile.mkdtemp(prefix='.volo-thin-', dir=output.parent))
        try:
            with sr._deadline(1760):
                pipeline(args.requirement_path, evidence, state)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            state.update(status='pipeline_error', error={'type': type(exc).__name__,
                         'detail': str(exc)[:160]})
        current = Path(state['current']) if state.get('current') else None
        known_invalid = any(r['status'] == 'product_fail' for r in state.get('static', {}).get('checks', []))
        if current and current.is_dir() and not core.missing_required(current) and not known_invalid:
            candidate = evidence/'delivery'
            shutil.copytree(current, candidate)
            platform_entry.publish(candidate, output)
            state.update(delivered=True, delivered_source_sha256=source_id(current),
                         runner_metadata_preserved=True)
            artifact(current, 'B')
        state['elapsed_seconds'] = round(time.monotonic()-started, 3)
        state['evidence'] = str(evidence)
        write(evidence/'result.json', state)
        if state['delivered']:
            shutil.move(str(evidence), str(output/'.volo-thin'))
            state['current'] = str(output/'.volo-thin'/Path(state['current']).name)
            state['evidence'] = str(output/'.volo-thin')
            write(output/'.volo-thin/result.json', state)
        event('finished', **sr._safe(state, os.environ.get('OPENAI_API_KEY', '')))
        return 0 if state['delivered'] else 1
    except (OSError, ValueError, KeyError) as exc:
        state.update(status='entry_error', error={'type': type(exc).__name__},
                     evidence=str(evidence) if evidence else None)
        if evidence and evidence.is_dir():
            write(evidence/'result.json', state)
        event('finished', **state)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

"""Opt-in, source-bound business observation -> skill proposal -> fresh observation.

The caller supplies a trusted requirement-derived observer, not official scores.
This module executes no application itself and reuses the existing skill client.
Acceptance covers the named probes only; verified_requirements stays empty.
"""
import json
from pathlib import Path
import time
from oneshot import main as baseline
from oneshot.minimal_feedback import identity
from oneshot import skill_repair as sr


def source_id(app):
    return identity(baseline.read_template(Path(app)))


def validate_feedback(result, app, expected_contract=None, expected_ids=None):
    if not isinstance(result, dict) or result.get('source_sha256') != source_id(app):
        raise ValueError('feedback_source_mismatch')
    contract = result.get('contract_sha256')
    if not isinstance(contract, str) or len(contract) != 64 or (expected_contract and contract != expected_contract):
        raise ValueError('feedback_contract_mismatch')
    checks = result.get('checks', [])
    if not isinstance(checks, list) or not checks or len(checks) > 12:
        raise ValueError('missing_or_unbounded_checks')
    ids = [r.get('id') for r in checks]
    if any(not isinstance(i, str) or not i for i in ids) or len(set(ids)) != len(ids):
        raise ValueError('duplicate_or_missing_check_ids')
    if expected_ids is not None and set(ids) != expected_ids:
        raise ValueError('check_coverage_changed')
    allowed = {'pass', 'product_fail', 'unknown', 'environment_error'}
    if any(r.get('status') not in allowed or not isinstance(r.get('requirement'), str)
           or not isinstance(r.get('observation'), str) for r in checks):
        raise ValueError('invalid_check_result')
    status = next((s for s in ('environment_error', 'unknown', 'product_fail')
                   if any(r['status'] == s for r in checks)), 'pass')
    if result.get('status') != status:
        raise ValueError('inconsistent_feedback_status')
    if result.get('integrity_verified') is not True:
        raise ValueError('feedback_integrity_not_verified')
    return result


def run(application, evidence_root, *, observer, paths, model_config=None,
        protected_paths=(), max_rounds=2, max_model_calls=6, proposer=None,
        request_timeout=300, max_output_tokens=16384, feedback_policy="whole_result"):
    """Run at most two repair rounds, with one shared HTTP-call cap across rounds.

    No credentials are read implicitly. With no model_config this only observes.
    proposer is injectable for synthetic tests; production defaults to sr.propose.
    Evidence/output must be separate from and non-overlapping with original input.
    """
    if type(max_rounds) is not int or not 0 <= max_rounds <= 2:
        raise ValueError('max_rounds must be 0..2')
    if type(max_model_calls) is not int or not 1 <= max_model_calls <= 6:
        raise ValueError('max_model_calls must be 1..6')
    # The outer 300-second conversation deadline still bounds every request.
    # Nonstreaming tool responses must not be cut off by a hidden 120s sub-limit.
    sr.Limits(request_timeout=request_timeout, max_output_tokens=max_output_tokens)
    if feedback_policy not in ("whole_result", "per_check"):
        raise ValueError("invalid feedback policy")
    per_check = feedback_policy == "per_check"
    application = sr._absolute(application)
    root = sr._new_output(evidence_root, application)
    initial = sr.load_source(application, paths, protected_paths=protected_paths)
    original = source_id(application)
    root.mkdir(mode=0o700)
    report = {'schema': 'business-feedback/v1', 'scope': 'explicit_requirement_probes_only',
              'verified_requirements': [], 'official_score': False, 'source_sha256': original,
              'model_calls': 0, 'max_model_calls': max_model_calls, 'rounds': [],
              'accepted': False, 'stop_reason': 'observe_only', 'feedback_policy': feedback_policy}
    started = time.monotonic()
    key = (model_config or {}).get('api_key', '')
    proposer = proposer or sr.propose
    current_app, retained = application, application
    try:
        current = validate_feedback(observer(application, root / 'baseline'), application)
        report['baseline'] = current
        contract, check_ids = current['contract_sha256'], {r['id'] for r in current['checks']}
        protected = {r['id'] for r in current['checks'] if r['status'] == 'pass'}
        for number in range(1, max_rounds + 1):
            actionable = any(r['status'] == 'product_fail' for r in current['checks'])
            if (current['status'] == 'environment_error' or not actionable or
                    (not per_check and current['status'] != 'product_fail')):
                report['stop_reason'] = current['status']
                break
            if model_config is None:
                break
            remaining = max_model_calls - report['model_calls']
            if remaining < 1:
                report['stop_reason'] = 'model_call_limit'
                break
            source = sr.load_source(current_app, paths, protected_paths=protected_paths)
            observations = [{'requirement': r['requirement'], 'observation': r['observation']}
                            for r in current['checks'] if r['status'] == 'product_fail']
            # Include preservation context without exposing test programs or scores.
            observations += [{'requirement': r['requirement'],
                              'observation': 'Preserve this already observed behavior: ' + r['observation']}
                             for r in current['checks'] if r['status'] == 'pass']
            row = {'round': number, 'working_source_sha256': source_id(current_app),
                   'observations': observations, 'accepted': False}
            report['rounds'].append(row)
            try:
                result = proposer(source, observations, **model_config,
                                  limits=sr.Limits(max_calls=min(4, remaining),
                                                   request_timeout=request_timeout,
                                                   max_output_tokens=max_output_tokens))
            except sr.RepairError as exc:
                row['trace'] = exc.trace
                row['diagnostics'] = sr.safe_diagnostics(exc.trace)
                report['model_calls'] += len(exc.trace.get('calls', []))
                report['stop_reason'] = 'model_error'
                row['error'] = str(exc)
                break
            row['trace'] = result['trace']
            row['diagnostics'] = sr.safe_diagnostics(result['trace'])
            report['model_calls'] += len(result['trace'].get('calls', []))
            if report['model_calls'] > max_model_calls:
                raise ValueError('model_call_limit_violated')
            proposal = sr.validate_proposal(result['proposal'], source)
            row['proposal'] = proposal
            if not proposal['edits']:
                report['stop_reason'] = 'no_change'
                break
            candidate = root / ('candidate-' + str(number))
            sr.apply_proposal(source, proposal, candidate)
            candidate_hash = source_id(candidate)
            feedback = validate_feedback(observer(candidate, root / ('check-' + str(number))),
                                         candidate, contract, check_ids)
            if source_id(candidate) != candidate_hash:
                raise ValueError('candidate_changed_during_check')
            row['feedback'] = feedback
            passes = {r['id'] for r in feedback['checks'] if r['status'] == 'pass'}
            if feedback['status'] == 'environment_error' or (not per_check and feedback['status'] == 'unknown'):
                report['stop_reason'] = feedback['status']
                break
            known = {r['id'] for r in current['checks'] if r['status'] in ('pass', 'product_fail')}
            next_known = {r['id'] for r in feedback['checks'] if r['status'] in ('pass', 'product_fail')}
            if per_check and not known <= next_known:
                report['stop_reason'] = 'known_check_became_unknown'
                break
            if not protected <= passes:
                report['stop_reason'] = 'regression'
                break
            if feedback['status'] == 'pass':
                retained = candidate
                row['accepted'] = report['accepted'] = True
                report['stop_reason'] = 'covered_probes_pass'
                break
            if per_check and passes > protected:
                retained = candidate
                row['accepted'] = report['accepted'] = True
                report['acceptance_scope'] = 'partial_observed_improvement'
            current_app, current = candidate, feedback
            protected |= passes
            report['stop_reason'] = 'round_limit'
        if source_id(application) != original:
            raise ValueError('original_changed')
        export_source = sr.load_source(retained, paths, protected_paths=protected_paths)
        sr.apply_proposal(export_source, {'edits': []}, root / 'application')
        report['retained_source_sha256'] = source_id(root / 'application')
        report['original_unchanged'] = True
        report['export'] = str(root / 'application')
    except (OSError, ValueError) as exc:
        report['stop_reason'] = 'invalid_or_incomplete'
        report['error'] = str(exc)
        report['accepted'] = False
        report['original_unchanged'] = source_id(application) == original
    finally:
        report['elapsed_seconds'] = round(time.monotonic() - started, 3)
        # Separate metadata receipt: reading failure categories never requires
        # exposing the full source-bearing model conversation.
        report['diagnostics'] = {'schema': 'repair-status/v1',
            'accepted': report['accepted'], 'stop_reason': report['stop_reason'],
            'model_calls': report['model_calls'],
            'rounds': [{'round': r['round'], 'accepted': r['accepted'],
                        'model': sr.safe_diagnostics(r.get('trace', {}))} for r in report['rounds']]}
        (root / 'diagnostic-status.json').write_text(json.dumps(report['diagnostics'], indent=2) + '\n')
        report = sr._safe(report, key)
        (root / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report

"""V2 generation + one plan + existing bounded business repair, opt-in only."""
import argparse
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time
from oneshot import main as core, business_feedback as bf, skill_repair as sr, effort_entry
from oneshot.minimal_feedback import _process, redact
from oneshot.v2 import main as v2
from . import planner
from .observer import NativeObserver, runtime_preflight

WALL_SECONDS = 1790  # Includes generation, planning, both repairs and observations.
PACKAGE_ROOT = Path(__file__).resolve().parents[2]


def write(path, value):
    path.write_text(redact(sr._json(sr._safe(value, os.environ.get('OPENAI_API_KEY', ''))))+'\n')


def worker(requirements, output, evidence, deadline):
    report = {'schema': 'minimal-v3/v1', 'candidate': 'minimal-v3-experimental',
              'scope': 'model_derived_fixed_probes_only',
              'status': 'unknown', 'accepted_repair': False, 'official_score': False,
              'verified_requirements': [], 'limits': {'generation': 3, 'planner': 1, 'repair': 6,
                                                      'wall_seconds': WALL_SECONDS}}
    # Explicit stage receipts distinguish installed code from stages actually run.
    report['stages'] = {name: {'status': 'not_started'} for name in
                        ('runtime_preflight', 'generation', 'planner', 'observation', 'repair')}
    report['planner_calls'] = 0
    report['repair'] = {'model_calls': 0, 'accepted': False, 'rounds': [], 'stop_reason': 'not_started'}
    generated = False
    try:
        report['stages']['runtime_preflight']['status'] = 'running'
        preflight = runtime_preflight(evidence/'_runtime', deadline)
        write(evidence/'runtime-preflight.json', preflight)
        report['stages']['runtime_preflight'] = preflight
        if preflight.get('status') != 'ready' or preflight.get('cleanup_verified') is not True:
            report.update(status='environment_error', stop_reason='runtime_preflight_failed',
                          error={'stage': 'runtime_preflight', 'code': 'runtime_preflight_failed'})
            return 1  # No paid generation or planning when V3 cannot observe safely.
        report['stages']['generation'] = {'status': 'running', 'thinking': 'enabled',
                                         'reasoning_effort': 'low'}
        # Reuse the tested low-effort policy from the submitted V2 baseline.
        # V2 prompts, starter bytes, token cap and retry budget are unchanged.
        with effort_entry.low_effort_generation(v2.core):
            code = v2.main([str(requirements), '--output-dir', str(output), '--type', 'web'])
        if code != 0:
            report['stages']['generation']['status'] = 'failed'
            report.update(status='generation_error', error={'stage': 'generation', 'code': 'v2_failed'})
            return 1
        generated = True
        report['stages']['generation']['status'] = 'completed'
        report['a0_sha256'] = bf.source_id(output)
        write(evidence/'generation.json', {'source_sha256': report['a0_sha256'], 'delivered': True})
        document, identity = v2.adapter.load_inputs(requirements)
        report['input'] = identity
        config = {'model': os.environ.get('MODEL', 'deepseek-v4-pro'),
                  'base_url': os.environ.get('OPENAI_BASE_URL', core.DEFAULT_BASE),
                  'api_key': os.environ['OPENAI_API_KEY']}
        paths = sorted(core.read_template(output))
        report['stages']['planner']['status'] = 'running'
        contract, trace = planner.plan(document, output, paths, config)
        write(evidence/'planner.json', trace)
        report['planner_calls'] = len(trace['calls'])
        report['stages']['planner'] = {'status': trace['status'], 'model_calls': report['planner_calls']}
        if contract is None:
            report.update(status='unknown', stop_reason='unsupported_or_uncertain_plan')
            return 0
        report['contract_sha256'] = contract['contract_sha256']
        write(evidence/'contract.json', contract)
        observer = NativeObserver(contract, evidence/'_runtime', deadline)
        report['stages']['observation']['status'] = 'running'
        result = bf.run(output, evidence/'business', observer=observer, paths=paths,
                        protected_paths=list(v2.PROTECTED), model_config=config,
                        max_rounds=2, max_model_calls=6)
        report['repair'] = result['diagnostics']
        observed = ([result['baseline']] if 'baseline' in result else [])
        observed += [row['feedback'] for row in result['rounds'] if 'feedback' in row]
        report['stages']['observation'] = {
            'status': observed[-1]['status'] if observed else 'unknown',
            'observations': len(observed)}
        report['stages']['repair'] = {
            'status': result['stop_reason'] if result['model_calls'] else 'skipped',
            'model_calls': result['model_calls'], 'accepted': result['accepted']}
        report['status'] = result['stop_reason']
        # Publish only the coordinator's observed, regression-free candidate.
        if result['accepted']:
            candidate = Path(result['export'])
            if core.missing_required(candidate) or bf.source_id(output) != report['a0_sha256']:
                raise ValueError('candidate_delivery_invalid')
            for name in v2.PROTECTED:
                if (candidate/name).read_bytes() != (output/name).read_bytes():
                    raise ValueError('protected_source_changed')
            backup = evidence/'A0'
            output.rename(backup)
            try:
                candidate.rename(output)
            except BaseException:
                backup.rename(output)
                raise
            report['accepted_repair'] = True
    except (OSError, ValueError, KeyError, TypeError) as exc:
        report.update(status='unknown' if generated else 'generation_error',
                      error={'stage': 'integration', 'code': 'integration_failed', 'type': type(exc).__name__})
    finally:
        for stage in report['stages'].values():
            if stage['status'] == 'not_started':
                stage.update(status='skipped', reason=report.get('stop_reason', report['status']))
            elif stage['status'] == 'running':
                stage.update(status='incomplete')
        if output.is_dir() and generated:
            report['retained_source_sha256'] = bf.source_id(output)
        write(evidence/'result.json', report)
    return 0 if generated else 1


def supervised_main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('requirement_path', type=Path)
    parser.add_argument('--output-dir', required=True, type=Path)
    parser.add_argument('--type', choices=('web',), default='web')
    args = parser.parse_args(argv)
    try:
        # Canonical parents support /tmp aliases but an output symlink is refused.
        if args.output_dir.is_symlink():
            raise ValueError('output_symlink')
        out = args.output_dir.resolve()
        req = args.requirement_path.resolve()
        if out == req or out in req.parents or req in out.parents:
            raise ValueError('input_output_overlap')
        if out.exists() and (not out.is_dir() or any(out.iterdir())):
            raise ValueError('output_not_empty')
        v2.adapter.load_inputs(req)
        out.parent.mkdir(parents=True, exist_ok=True)
        evidence = Path(tempfile.mkdtemp(prefix='.minimal-v3-', dir=out.parent))
        started = time.monotonic()
        # Only the trusted Python model worker gets credentials. The observer
        # launch and app use explicit clean environments, with no gateway access.
        env = {k: os.environ[k] for k in ('PATH', 'LANG', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'MODEL') if k in os.environ}
        env['PYTHONUNBUFFERED'] = '1'
        argv = [sys.executable, '-B', '-m', 'oneshot.v3.entry', str(req), str(out), str(evidence),
                str(started+WALL_SECONDS)]
        r = _process(argv, PACKAGE_ROOT, WALL_SECONDS, env=env, max_log=16*1024*1024)
        (evidence/'generation.log').write_text(redact(sr._safe(r['output'], os.environ.get('OPENAI_API_KEY', ''))))
        # A process kill during publication leaves A0 in this private known path.
        if not out.exists() and (evidence/'A0').is_dir():
            (evidence/'A0').rename(out)
        shutil.rmtree(evidence/'_runtime', ignore_errors=True)
        complete = r['exit_code'] == 0 and not r.get('reason')
        delivered = (evidence/'generation.json').is_file() and out.is_dir() and not core.missing_required(out)
        status = {'schema': 'minimal-v3-entry/v1', 'delivered': delivered, 'official_score': False,
                  'verified_requirements': [], 'evidence': str(evidence),
                  'elapsed_seconds': round(time.monotonic()-started, 3)}
        if (evidence/'result.json').is_file():
            status['result'] = json.loads((evidence/'result.json').read_text())
        if not complete:
            status['error'] = {'stage': 'entry', 'code': r.get('reason') or 'worker_failed'}
        if (evidence/'_runtime').exists():
            status['error'] = {'stage': 'cleanup', 'code': 'snapshot_cleanup_failed'}
        write(evidence/'entry.json', status)
        print(json.dumps(status, ensure_ascii=False))
        return 0 if delivered else 1
    except sr.RepairError:
        raise
    except (OSError, ValueError) as exc:
        print(json.dumps({'schema': 'minimal-v3-entry/v1', 'delivered': False,
                          'error': {'stage': 'entry', 'code': 'invalid_input_or_environment',
                                    'type': type(exc).__name__}, 'verified_requirements': []}))
        return 1


def main(argv=None):
    # Also bound setup, serialization and cleanup outside the worker timeout.
    try:
        with sr._deadline(1800):
            return supervised_main(argv)
    except sr.RepairError:
        print(json.dumps({'schema': 'minimal-v3-entry/v1', 'status': 'unknown',
                          'error': {'stage': 'entry', 'code': 'global_wall_limit'},
                          'official_score': False, 'verified_requirements': []}))
        return 1


if __name__ == '__main__':
    # Internal worker protocol, never an application command or model-generated code.
    os.umask(0o077)
    raise SystemExit(worker(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), float(sys.argv[4])))

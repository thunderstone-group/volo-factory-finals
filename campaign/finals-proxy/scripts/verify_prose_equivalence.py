#!/usr/bin/env python3
"""Verify style-only execution inputs and label reused base scores explicitly."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from run_proxy import IMAGE,tree_hash
from scripts.freeze import digest,files,verify

def main():
    coverage=json.loads((ROOT/'results/prose-name-coverage.json').read_text())
    assert coverage['all_names_present'] and all(t['all_30_covered'] for t in coverage['tasks'].values())
    image_id=subprocess.check_output(['docker','image','inspect',IMAGE,'--format','{{.Id}}'],text=True).strip()
    proof={'style_only':True,'base_scores_are_reused_not_rerun':True,'variants':{}}
    for base in ['github','sheet']:
        task=base+'-prose';freeze_hash=verify(task);source_hash=verify(base)
        manifest=json.loads((ROOT/task/'FROZEN.json').read_text())
        canonical_tests={k:v for k,v in files(base).items() if k.startswith('tests/')}
        variant_tests={k:v for k,v in files(task).items() if k.startswith('tests/')}
        assert canonical_tests==variant_tests
        test_hash=hashlib.sha256(json.dumps(canonical_tests,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        baseline_path=ROOT/'results'/f'base-{base}-proxy.json'
        baseline=json.loads(baseline_path.read_text())
        original_reference=json.loads((ROOT/'results'/f'reference-{base}-proxy-2.json').read_text())
        current_path=ROOT/'results'/f'reference-{task}-proxy.json'
        current=json.loads(current_path.read_text())
        raw=json.loads(current_path.with_suffix('.playwright.json').read_text())
        old_raw=json.loads(baseline_path.with_suffix('.playwright.json').read_text())
        assert current['passed']==current['total']==30 and current['failed']==0 and not current.get('infrastructure_error')
        assert current['subset'] is None
        assert current['frozen_manifest_sha256']==coverage['tasks'][task]['frozen_manifest_sha256']==freeze_hash
        assert current['test_task']==base and current['test_source_manifest_sha256']==source_hash
        assert current['requirements_sha256']==digest(ROOT/task/'requirements/requirements.yaml')
        assert current['test_files_sha256']==canonical_tests and current['test_suite_sha256']==test_hash
        assert current['app_sha256']==original_reference['app_sha256']==tree_hash(ROOT/'reference'/f'{base}-app')
        assert baseline['frozen_manifest_sha256']==source_hash
        assert baseline['app_sha256']==tree_hash(Path(baseline['app_dir']))
        assert baseline['passed']==0 and baseline['total']==baseline['failed']==30 and not baseline.get('infrastructure_error')
        assert current['image_id']==baseline['image_id']==image_id
        assert current['settings']==baseline['settings']==original_reference['settings']
        assert [t['name'] for t in current['tests']]==[t['name'] for t in baseline['tests']]
        assert raw['config']['rootDir']==old_raw['config']['rootDir']==f'/proxy/{base}/tests'
        frozen_at=datetime.datetime.fromisoformat(manifest['frozen_at'])
        started=datetime.datetime.fromisoformat(raw['stats']['startTime'].replace('Z','+00:00'))
        assert frozen_at<started
        proof['variants'][task]={
            'prose_requirements_sha256':current['requirements_sha256'],
            'prose_frozen_manifest_sha256':freeze_hash,
            'frozen_before_execution':True,
            'canonical_task':base,
            'canonical_frozen_manifest_sha256':source_hash,
            'shared_test_suite_sha256':test_hash,
            'tests_are_the_same_files':(ROOT/task/'tests').resolve()==(ROOT/base/'tests').resolve(),
            'same_test_titles_and_order':True,
            'test_directory':raw['config']['rootDir'],
            'image_id':image_id,
            'settings':current['settings'],
            'reference':{'method':'executed_once_under_prose_task_name','report':str(current_path.relative_to(ROOT)),'app_sha256':current['app_sha256'],'passed':current['passed'],'total':current['total'],'wall_seconds':current['wall_seconds']},
            'base':{'method':'reused_completed_baseline_by_identical_execution_inputs','report':str(baseline_path.relative_to(ROOT)),'report_sha256':digest(baseline_path),'app_dir':baseline['app_dir'],'app_sha256':baseline['app_sha256'],'passed':baseline['passed'],'total':baseline['total'],'historical_wall_seconds':baseline['wall_seconds'],'not_rerun':True},
            'argument':'The evaluator executes the identical canonical spec files and helper on the unchanged base app, in the same immutable image and with the same settings. Requirement prose is provenance, not an input consumed by Playwright or the application at evaluation time. The completed 0/30 result is reused; no new baseline execution is claimed.'
        }
    (ROOT/'results/prose-equivalence.json').write_text(json.dumps(proof,indent=2)+'\n')
    for task,entry in proof['variants'].items():print(task, 'reference 30/30 executed; base 0/30 reused by identical hashes; all checks passed')
    return 0
if __name__=='__main__':raise SystemExit(main())

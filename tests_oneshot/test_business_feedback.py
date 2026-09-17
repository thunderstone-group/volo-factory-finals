"""Synthetic coordinator/probe receipts; model and browser are mocked explicitly."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from oneshot import business_feedback as bf
from oneshot import skill_repair as sr
from scripts.observe_business import parse_observations, load_contract

REQ='Saving the edited entity must retain its value after reopening.'
CONTRACT='a'*64

class BusinessFeedbackTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name); self.app=self.root/'A0'
        for d in ['frontend','backend']:
            (self.app/d).mkdir(parents=True);(self.app/d/'package.json').write_text('{}')
        self.path='frontend/app.js';(self.app/self.path).write_text('save:bad cancel:good favorite:bad')
        self.initial=bf.source_id(self.app);self.calls=[]
    def observe(self, app, output):
        text=(app/self.path).read_text()
        checks=[{'id':x,'status':'pass' if x+':good' in text else 'product_fail',
                 'requirement':REQ,'observation':x+' observed from '+bf.source_id(app)} for x in ['save','cancel','favorite']]
        return {'source_sha256':bf.source_id(app),'contract_sha256':CONTRACT,'checks':checks,
                'integrity_verified':True,'status':'pass' if all(x['status']=='pass' for x in checks) else 'product_fail'}
    def proposal(self, source, observations, **kwargs):
        self.calls.append((source.files[self.path],copy.deepcopy(observations),kwargs['limits'].max_calls))
        text=source.files[self.path];old='save:bad' if 'save:bad' in text else 'favorite:bad'
        return {'proposal':{'edits':[{'path':self.path,'before_sha256':sr.sha256(text.encode()),'old':old,'new':old.replace('bad','good')}]},
                'trace':{'calls':[{'fixture':'synthetic'},{'fixture':'synthetic'}]}}
    def run_loop(self, **kwargs):
        args={'observer':self.observe,'paths':[self.path],'model_config':{'model':'synthetic','base_url':'https://synthetic.invalid','api_key':'synthetic'},'proposer':self.proposal}
        args.update(kwargs); return bf.run(self.app,self.root/'evidence',**args)
    def test_two_rounds_new_source_feedback_shared_calls(self):
        r=self.run_loop();self.assertTrue(r['accepted']);self.assertEqual(r['model_calls'],4)
        self.assertEqual(self.calls[0][2],4);self.assertEqual(self.calls[1][2],4)
        self.assertIn('save:good',self.calls[1][0]);self.assertNotEqual(self.calls[0][1],self.calls[1][1])
        self.assertEqual(bf.source_id(self.app),self.initial);self.assertEqual(r['verified_requirements'],[])
        self.assertIn('favorite:good',(Path(r['export'])/self.path).read_text())
    def test_passing_observation_never_requests_a_repair(self):
        (self.app/self.path).write_text('save:good cancel:good favorite:good')
        r=self.run_loop();self.assertEqual(r['stop_reason'],'pass');self.assertFalse(self.calls)
        self.assertEqual(r['model_calls'],0)
    def test_explicit_login_scope_is_bounded(self):
        manifest={'schema':1,'login':{'open':'Sign in','fields':{'Email':'demo@example.com'},'submit':'Enter','ready':'Demo','scope':'banner'},'flows':[{'id':'s','kind':'save-reopen','requirement':REQ,'navigate':['Records'],'open':'Edit','field':'Name','save':'Save','cancel':'Cancel'}]}
        mf=self.root/'m.json';doc=self.root/'r.txt';doc.write_text(REQ);mf.write_text(json.dumps(manifest))
        self.assertEqual(load_contract(mf,doc)['login']['scope'],'banner')
        manifest['login']['scope']='arbitrary-css';mf.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):load_contract(mf,doc)
    def test_budget_is_not_reset_per_round(self):
        r=self.run_loop(max_model_calls=2);self.assertFalse(r['accepted']);self.assertEqual(len(self.calls),1)
        self.assertEqual(r['stop_reason'],'model_call_limit');self.assertEqual(r['retained_source_sha256'],self.initial)
    def test_unknown_does_not_call_model(self):
        def unknown(app,out):
            r=self.observe(app,out);r['status']='unknown';r['checks'][0]['status']='unknown';return r
        r=self.run_loop(observer=unknown);self.assertEqual(r['stop_reason'],'unknown');self.assertFalse(self.calls)
    def test_environment_error_does_not_call_model(self):
        def failed(app,out):
            r=self.observe(app,out);r['status']='environment_error';r['checks'][0]['status']='environment_error';return r
        r=self.run_loop(observer=failed);self.assertEqual(r['stop_reason'],'environment_error');self.assertFalse(self.calls)
    def test_regression_never_replaces_original(self):
        def regressor(source, observations, **kwargs):
            r=self.proposal(source,observations,**kwargs)
            r['proposal']['edits'].append({'path':self.path,'before_sha256':sr.sha256(source.files[self.path].encode()),'old':'cancel:good','new':'cancel:bad'})
            return r
        r=self.run_loop(proposer=regressor);self.assertEqual(r['stop_reason'],'regression');self.assertFalse(r['accepted'])
        self.assertEqual(r['retained_source_sha256'],self.initial)
    def test_mismatched_source_receipt_fails_closed(self):
        def mismatch(app,out):
            r=self.observe(app,out);r['source_sha256']='b'*64;return r
        r=self.run_loop(observer=mismatch);self.assertEqual(r['stop_reason'],'invalid_or_incomplete');self.assertFalse(self.calls)
    def test_contract_changed_after_edit_fails_closed(self):
        def changed(app,out):
            r=self.observe(app,out)
            if app!=self.app:r['contract_sha256']='b'*64
            return r
        r=self.run_loop(observer=changed);self.assertFalse(r['accepted']);self.assertIn('contract',r['error'])
    def test_missing_check_cannot_be_accepted(self):
        def changed(app,out):
            r=self.observe(app,out)
            if app!=self.app:r['checks']=r['checks'][:2];r['status']='pass'
            return r
        r=self.run_loop(observer=changed);self.assertFalse(r['accepted']);self.assertIn('coverage',r['error'])
    def test_transport_failure_accounted_no_retry(self):
        def failed(*args,**kwargs):raise sr.RepairError('synthetic transport',{'calls':[{}]})
        r=self.run_loop(proposer=failed);self.assertEqual(r['model_calls'],1);self.assertEqual(r['stop_reason'],'model_error')
        self.assertEqual(r['retained_source_sha256'],self.initial)
    def test_observe_only_and_zero_rounds(self):
        r=self.run_loop(max_rounds=0);self.assertFalse(self.calls);self.assertFalse(r['accepted'])
    def test_output_inside_original_refused(self):
        with self.assertRaises(sr.RepairError):bf.run(self.app,self.app/'bad',observer=self.observe,paths=[self.path])
    def test_probe_receipt_not_process_success(self):
        contract={'flows':[{'id':'x','requirement':REQ}],'contract_sha256':CONTRACT}
        row={'id':'x','status':'product_fail','observation':'saved value remains old','contract_sha256':CONTRACT}
        raw={'suites':[{'specs':[{'title':'x','tests':[{'results':[{'status':'passed','stdout':[{'text':'VOLO_BUSINESS_OBSERVATION '+json.dumps(row)+'\n'}]}]}]}]}]}
        result=parse_observations(raw,contract);self.assertEqual(result[0]['status'],'product_fail')
        raw['suites'][0]['specs'][0]['tests'][0]['results'][0]['stdout']*=2
        with self.assertRaises(ValueError):parse_observations(raw,contract)
    def test_contract_requires_public_excerpt_and_no_arbitrary_code(self):
        manifest={'schema':1,'login':None,'flows':[{'id':'save','kind':'save-reopen','requirement':REQ,'navigate':['Records','Alpha'],'open':'Edit','field':'Name','save':'Save','cancel':'Cancel'}]}
        mf=self.root/'manifest.json';doc=self.root/'requirements.txt';doc.write_text(REQ);mf.write_text(json.dumps(manifest))
        self.assertEqual(len(load_contract(mf,doc)['flows']),1)
        manifest['flows'][0]['requirement']='Unsupported assertion not in the original document.';mf.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):load_contract(mf,doc)
        manifest['flows'][0]['requirement']=REQ;manifest['flows'][0]['evaluate']='arbitrary code';mf.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):load_contract(mf,doc)

if __name__=='__main__':unittest.main()

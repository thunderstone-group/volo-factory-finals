let records = []; let protection = {requireApproval:true, requireCheck:false};
function list(name) { return name === 'reviews' ? records : []; }
function ruleFor() { return protection; }
function canMaintain() { return true; }
function checkFor() { return {status:'success'}; }
function reviewsFor(pr) { return list('reviews').filter((r) => r.prId === pr.id && r.commit === pr.compareCommit); }
function eligibility(repo, pr, user) {
  if (pr.status === 'Draft') return { ok: false, reason: '' };
  if (pr.status !== 'Open') return { ok: false, reason: '' };
  const rule = ruleFor(repo, pr.base);
  const revs = reviewsFor(pr);
  if (revs.some((r) => r.decision === 'Request changes')) return { ok: false, reason: 'Changes requested' };
  if (rule) {
    const approvals = revs.filter((r) => r.decision === 'Approve' && r.reviewerId !== pr.authorId);
    if (rule.requireApproval && approvals.length < 1) return { ok: false, reason: 'Review required by branch protection' };
    if (rule.requireCheck) {
      const chk = checkFor(pr);
      if (!chk || chk.status !== 'success') return { ok: false, reason: 'Review required by branch protection' };
    }
  }
  if (!canMaintain(repo, user)) return { ok: false, reason: 'You do not have permission to merge this pull request.' };
  return { ok: true, reason: '' };
}
const pr={id:'p',status:'Open',base:'main',authorId:'author',compareCommit:'current'};
const review = (decision, commit='current') => ({prId:'p',reviewerId:'reviewer',commit,decision});
const cases=[
 {name:'only current approval',reviews:[review('Approve')],protected:true,expected_ok:true},
 {name:'request changes replaced by approval',reviews:[review('Request changes'),review('Approve')],protected:true,expected_ok:true},
 {name:'request changes replaced by comment on unprotected target',reviews:[review('Request changes'),review('Comment')],protected:false,expected_ok:true},
 {name:'old commit request changes is stale',reviews:[review('Request changes','old'),review('Approve')],protected:true,expected_ok:true}
];
console.log(JSON.stringify(cases.map(c => {records=c.reviews;protection=c.protected?{requireApproval:true,requireCheck:false}:null;return {name:c.name,expected_ok:c.expected_ok,actual:eligibility({id:'r'},pr,{id:'maintainer'})};})));

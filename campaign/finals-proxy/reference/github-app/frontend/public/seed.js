'use strict';
// Initial records required by the GIVEN clauses. Accounts, organizations, teams, repositories,
// branches, files, commits, issues, pull requests, labels, milestones, protections and checks.
window.SEED = (function () {
  const PWD = 'Valid-password-123!';
  function u(name, email) { return { id: 'u-' + name, name: name, email: email, password: PWD }; }

  const users = [
    u('alice-dev', 'alice.dev@example.test'),
    u('recovery-visibility', 'recovery-visibility@example.test'),
    u('recovery-invalid-code', 'recovery-invalid-code@example.test'),
    u('recovery-success', 'recovery-success@example.test'),
    u('password-change-success', 'password-change-success@example.test'),
    u('password-change-invalid', 'password-change-invalid@example.test'),
    u('password-change-required', 'password-change-required@example.test'),
    u('org-owner', 'org-owner@example.test'),
    u('team-maintainer', 'team-maintainer@example.test'),
    u('bob-reviewer', 'bob-reviewer@example.test'),
    u('new-member', 'new-member@example.test'),
    u('existing-member', 'existing-member@example.test'),
    u('org-member', 'org-member@example.test'),
    u('protected-member', 'protected-member@example.test'),
    u('repo-admin', 'repo-admin@example.test'),
    u('repo-owner', 'repo-owner@example.test'),
    u('fork-user', 'fork-user@example.test'),
    u('visibility-admin', 'visibility-admin@example.test'),
    u('collaborator', 'collaborator@example.test'),
    u('branch-contributor', 'branch-contributor@example.test'),
    u('default-branch-admin', 'default-branch-admin@example.test'),
    u('default-branch-viewer', 'default-branch-viewer@example.test'),
    u('file-contributor', 'file-contributor@example.test'),
    u('issue-author', 'issue-author@example.test'),
    u('issue-editor', 'issue-editor@example.test'),
    u('issue-commenter', 'issue-commenter@example.test'),
    u('issue-viewer', 'issue-viewer@example.test'),
    u('protection-admin', 'protection-admin@example.test'),
    u('protection-viewer', 'protection-viewer@example.test'),
    u('pr-contributor', 'pr-contributor@example.test'),
    u('draft-author', 'draft-author@example.test'),
    u('pr-reviewer', 'pr-reviewer@example.test'),
    u('pr-author', 'pr-author@example.test'),
    u('pr-maintainer', 'pr-maintainer@example.test'),
    u('pr-viewer', 'pr-viewer@example.test')
  ];

  const orgs = [
    { id: 'org-acme-demo', name: 'acme-demo', display: 'Acme Demo', description: 'Public demo organization' }
  ];

  const orgMembers = [
    { org: 'acme-demo', user: 'org-owner', role: 'owner' },
    { org: 'acme-demo', user: 'team-maintainer', role: 'owner' },
    { org: 'acme-demo', user: 'org-member', role: 'member' },
    { org: 'acme-demo', user: 'existing-member', role: 'member' },
    { org: 'acme-demo', user: 'protected-member', role: 'member' },
    { org: 'acme-demo', user: 'bob-reviewer', role: 'member' },
    { org: 'acme-demo', user: 'repo-admin', role: 'member' },
    { org: 'acme-demo', user: 'repo-owner', role: 'member' }
  ];

  const teams = [
    { id: 'team-platform', org: 'acme-demo', name: 'platform-team', parent: null, members: [] },
    { id: 'team-frontend', org: 'acme-demo', name: 'frontend-team', parent: 'team-platform', members: [] },
    { id: 'team-frontend-child', org: 'acme-demo', name: 'frontend-child', parent: 'team-frontend', members: [] },
    { id: 'team-access-role', org: 'acme-demo', name: 'access-role-team', parent: null, members: [] }
  ];

  const repos = [
    { id: 'repo-acme-docs', owner: 'acme-demo', ownerType: 'org', name: 'acme-docs', visibility: 'public', description: 'Documentation and search', defaultBranch: 'main', forkOf: null },
    { id: 'repo-secret-research', owner: 'acme-demo', ownerType: 'org', name: 'secret-research', visibility: 'private', description: 'Private research', defaultBranch: 'main', forkOf: null },
    { id: 'repo-acme-docs-personal', owner: 'repo-owner', ownerType: 'user', name: 'acme-docs', visibility: 'private', description: 'Personal copy', defaultBranch: 'main', forkOf: null },
    { id: 'repo-visibility-demo', owner: 'visibility-admin', ownerType: 'user', name: 'visibility-demo', visibility: 'private', description: 'Visibility demo', defaultBranch: 'main', forkOf: null },
    { id: 'repo-acme-docs-fork', owner: 'fork-user', ownerType: 'user', name: 'acme-docs-fork', visibility: 'private', description: '', defaultBranch: 'main', forkOf: 'repo-acme-docs' },
    { id: 'repo-branch-switch-demo', owner: 'acme-demo', ownerType: 'org', name: 'branch-switch-demo', visibility: 'public', description: 'Branch switching demo', defaultBranch: 'main', forkOf: null },
    { id: 'repo-default-branch-demo', owner: 'acme-demo', ownerType: 'org', name: 'default-branch-demo', visibility: 'public', description: 'Default branch demo', defaultBranch: 'main', forkOf: null },
    { id: 'repo-file-management-demo', owner: 'acme-demo', ownerType: 'org', name: 'file-management-demo', visibility: 'public', description: 'File management demo', defaultBranch: 'main', forkOf: null },
    { id: 'repo-branch-protection-demo', owner: 'acme-demo', ownerType: 'org', name: 'branch-protection-demo', visibility: 'public', description: 'Branch protection demo', defaultBranch: 'main', forkOf: null }
  ];

  const grants = [
    { id: 'g1', repo: 'repo-acme-docs', subject: 'team-access-role', subjectType: 'team', role: 'write' },
    { id: 'g2', repo: 'repo-acme-docs', subject: 'repo-admin', subjectType: 'user', role: 'admin' },
    { id: 'g3', repo: 'repo-acme-docs', subject: 'issue-author', subjectType: 'user', role: 'write' },
    { id: 'g4', repo: 'repo-acme-docs', subject: 'issue-editor', subjectType: 'user', role: 'maintain' },
    { id: 'g5', repo: 'repo-acme-docs', subject: 'issue-commenter', subjectType: 'user', role: 'write' },
    { id: 'g6', repo: 'repo-acme-docs', subject: 'pr-contributor', subjectType: 'user', role: 'write' },
    { id: 'g7', repo: 'repo-acme-docs', subject: 'pr-reviewer', subjectType: 'user', role: 'write' },
    { id: 'g8', repo: 'repo-acme-docs', subject: 'pr-author', subjectType: 'user', role: 'write' },
    { id: 'g9', repo: 'repo-acme-docs', subject: 'pr-maintainer', subjectType: 'user', role: 'maintain' },
    { id: 'g10', repo: 'repo-acme-docs', subject: 'draft-author', subjectType: 'user', role: 'write' },
    { id: 'g11', repo: 'repo-visibility-demo', subject: 'collaborator', subjectType: 'user', role: 'write' },
    { id: 'g12', repo: 'repo-branch-switch-demo', subject: 'branch-contributor', subjectType: 'user', role: 'write' },
    { id: 'g13', repo: 'repo-default-branch-demo', subject: 'default-branch-admin', subjectType: 'user', role: 'admin' },
    { id: 'g14', repo: 'repo-file-management-demo', subject: 'file-contributor', subjectType: 'user', role: 'write' },
    { id: 'g15', repo: 'repo-branch-protection-demo', subject: 'protection-admin', subjectType: 'user', role: 'admin' }
  ];

  const branches = [];
  function br(repo, name, head) { branches.push({ id: repo + ':' + name, repo: repo, name: name, head: head || null }); }

  const files = [];
  function f(repo, branch, path, content) { files.push({ id: repo + ':' + branch + ':' + path, repo: repo, branch: branch, path: path, content: content }); }

  const commits = [];
  function c(repo, branch, id, message, author, date, changed) {
    commits.push({ id: id, repo: repo, branch: branch, message: message, author: author, date: date, files: changed });
  }

  br('repo-acme-docs', 'main', 'c-acme-1');
  br('repo-acme-docs', 'feature-search', 'c-acme-2');
  br('repo-acme-docs', 'draft-feature', 'c-acme-3');
  f('repo-acme-docs', 'main', 'src/README.md', 'Document search flow');
  f('repo-acme-docs', 'main', 'src/search.ts', 'export function search(term: string) {\n  return term;\n}');
  f('repo-acme-docs', 'feature-search', 'src/search.ts', 'export function search(term: string) {\n  return term.trim().toLowerCase();\n}');
  f('repo-acme-docs', 'draft-feature', 'src/search.ts', 'export function search(term: string) {\n  return term;\n}\n');
  c('repo-acme-docs', 'main', 'c-acme-1', 'Document search flow', 'alice-dev', '2 days ago', [
    { path: 'src/README.md', additions: 1, deletions: 0 },
    { path: 'src/search.ts', additions: 12, deletions: 3 }
  ]);
  c('repo-acme-docs', 'feature-search', 'c-acme-2', 'Add search flow', 'alice-dev', '1 day ago', [
    { path: 'src/search.ts', additions: 4, deletions: 1 }
  ]);
  c('repo-acme-docs', 'draft-feature', 'c-acme-3', 'Draft search update', 'draft-author', '5 hours ago', [
    { path: 'src/search.ts', additions: 2, deletions: 0 }
  ]);

  br('repo-branch-switch-demo', 'main', 'c-bsd-1');
  br('repo-branch-switch-demo', 'feature-search', 'c-bsd-2');
  f('repo-branch-switch-demo', 'main', 'README.md', 'Branch switch demo');
  f('repo-branch-switch-demo', 'feature-search', 'main-only.md', 'Only on the feature branch');
  c('repo-branch-switch-demo', 'main', 'c-bsd-1', 'Initial commit', 'alice-dev', '4 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);

  br('repo-default-branch-demo', 'main', 'c-dbd-1');
  br('repo-default-branch-demo', 'release', 'c-dbd-2');
  f('repo-default-branch-demo', 'main', 'README.md', 'Default branch demo');
  f('repo-default-branch-demo', 'release', 'README.md', 'Default branch demo');
  c('repo-default-branch-demo', 'main', 'c-dbd-1', 'Initial commit', 'alice-dev', '3 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);
  c('repo-default-branch-demo', 'release', 'c-dbd-2', 'Prepare release', 'alice-dev', '2 days ago', [{ path: 'README.md', additions: 2, deletions: 0 }]);

  br('repo-file-management-demo', 'main', 'c-fmd-1');
  f('repo-file-management-demo', 'main', 'README.md', 'File management demo');
  c('repo-file-management-demo', 'main', 'c-fmd-1', 'Initial commit', 'alice-dev', '3 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);

  br('repo-branch-protection-demo', 'main', 'c-bpd-1');
  f('repo-branch-protection-demo', 'main', 'README.md', 'Branch protection demo');
  c('repo-branch-protection-demo', 'main', 'c-bpd-1', 'Initial commit', 'alice-dev', '3 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);

  br('repo-visibility-demo', 'main', 'c-vd-1');
  f('repo-visibility-demo', 'main', 'README.md', 'Visibility demo');
  c('repo-visibility-demo', 'main', 'c-vd-1', 'Initial commit', 'visibility-admin', '6 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);

  br('repo-acme-docs-fork', 'main', 'c-acme-1');
  f('repo-acme-docs-fork', 'main', 'src/README.md', 'Document search flow');
  f('repo-acme-docs-fork', 'main', 'src/search.ts', 'export function search(term: string) {\n  return term;\n}');
  c('repo-acme-docs-fork', 'main', 'c-acme-1', 'Document search flow', 'alice-dev', '2 days ago', [{ path: 'src/README.md', additions: 1, deletions: 0 }]);

  br('repo-acme-docs-personal', 'main', 'c-acme-1');
  f('repo-acme-docs-personal', 'main', 'README.md', 'Personal copy');
  c('repo-acme-docs-personal', 'main', 'c-acme-1', 'Initial commit', 'repo-owner', '5 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);

  br('repo-secret-research', 'main', 'c-sr-1');
  f('repo-secret-research', 'main', 'README.md', 'Secret research');
  c('repo-secret-research', 'main', 'c-sr-1', 'Initial commit', 'org-owner', '7 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);

  function issue(repo, number, title, status, description, author) {
    return {
      id: repo + ':issue:' + number, repo: repo, number: number, title: title, status: status,
      description: description || '', author: author || 'alice-dev', labels: [], assignees: [], milestone: null
    };
  }

  const issues = [
    issue('repo-acme-docs', 1, 'Improve onboarding', 'open', 'Describe the onboarding improvement.', 'alice-dev'),
    issue('repo-acme-docs', 2, 'Legacy welcome text', 'closed', 'Old copy kept for reference.', 'alice-dev'),
    issue('repo-acme-docs', 3, 'Editable onboarding issue', 'open', 'Original description.', 'alice-dev'),
    issue('repo-acme-docs', 4, 'Original issue title', 'open', 'Original body.', 'alice-dev'),
    issue('repo-acme-docs', 5, 'Commentable onboarding issue', 'open', 'Commentable body.', 'alice-dev'),
    issue('repo-acme-docs', 6, 'Comment validation issue', 'open', 'Validation body.', 'alice-dev'),
    issue('repo-acme-docs', 7, 'Assignable onboarding issue', 'open', 'Assignable body.', 'alice-dev'),
    issue('repo-acme-docs', 8, 'Labelable onboarding issue', 'open', 'Labelable body.', 'alice-dev'),
    issue('repo-acme-docs', 9, 'Milestone onboarding issue', 'open', 'Milestone body.', 'alice-dev'),
    issue('repo-acme-docs', 10, 'Closable onboarding issue', 'open', 'Closable body.', 'alice-dev'),
    issue('repo-acme-docs', 11, 'Protected onboarding issue', 'open', 'Protected body.', 'alice-dev')
  ];

  const issueComments = [
    { id: 'ic-1', issue: 'repo-acme-docs:issue:1', author: 'alice-dev', body: 'This issue tracks the onboarding improvement.', created: '2 days ago' },
    { id: 'ic-2', issue: 'repo-acme-docs:issue:1', author: 'bob-reviewer', body: 'Activity: opened the issue for discussion.', created: '1 day ago' }
  ];

  const labels = [
    { id: 'lbl-bug', repo: 'repo-acme-docs', name: 'bug', color: '#d73a4a' },
    { id: 'lbl-enhancement', repo: 'repo-acme-docs', name: 'enhancement', color: '#a2eeef' }
  ];

  const milestones = [
    { id: 'ms-v1', repo: 'repo-acme-docs', title: 'v1.0' }
  ];

  const prs = [];
  function pr(o) {
    prs.push(Object.assign({
      id: 'pr-' + o.repo + '-' + o.number, repo: o.repo, number: o.number, title: o.title, status: o.status,
      author: o.author || 'alice-dev', source: o.source || 'feature-search', target: o.target || 'main',
      description: o.description || '', created: o.created || '2 days ago',
      sourceCommit: o.sourceCommit || 'c-acme-2', baseCommit: o.baseCommit || 'c-acme-1',
      changedFiles: o.changedFiles || [{ path: 'src/search.ts', additions: 12, deletions: 3 }],
      commits: o.commits || [{ sha: o.sourceCommit || 'c-acme-2', message: 'Add search flow', author: o.author || 'alice-dev', date: '2 days ago' }],
      reviewers: o.reviewers || [], reviews: o.reviews || [], comments: o.comments || [],
      merged: null, mergedBy: null, mergedAt: null
    }, o.extra || {}));
  }

  pr({ repo: 'repo-acme-docs', number: 1, title: 'Improve onboarding', status: 'open' });
  pr({ repo: 'repo-acme-docs', number: 2, title: 'Overview onboarding PR', status: 'open', author: 'pr-contributor' });
  pr({ repo: 'repo-acme-docs', number: 3, title: 'Public onboarding PR', status: 'open', author: 'pr-contributor' });
  pr({ repo: 'repo-acme-docs', number: 4, title: 'Reviewable onboarding PR', status: 'open', author: 'pr-author' });
  pr({ repo: 'repo-acme-docs', number: 5, title: 'Pending review onboarding PR', status: 'open', author: 'pr-author' });
  pr({ repo: 'repo-acme-docs', number: 6, title: 'Change request onboarding PR', status: 'open', author: 'pr-author' });
  pr({ repo: 'repo-acme-docs', number: 7, title: 'Reviewer request onboarding PR', status: 'open', author: 'pr-author' });
  pr({
    repo: 'repo-acme-docs', number: 8, title: 'Mergeable onboarding PR', status: 'open', author: 'pr-contributor',
    reviews: [{ id: 'rv-8', author: 'bob-reviewer', decision: 'approved', summary: '', commit: 'c-acme-2' }]
  });
  pr({ repo: 'repo-acme-docs', number: 9, title: 'Blocked onboarding PR', status: 'open', author: 'pr-contributor' });
  pr({ repo: 'repo-acme-docs', number: 10, title: 'Closable onboarding PR', status: 'open', author: 'pr-author' });
  pr({ repo: 'repo-acme-docs', number: 11, title: 'Protected onboarding PR', status: 'open', author: 'pr-contributor' });
  pr({
    repo: 'repo-acme-docs', number: 12, title: 'Draft onboarding update', status: 'draft', author: 'draft-author',
    source: 'draft-feature', sourceCommit: 'c-acme-3'
  });
  pr({ repo: 'repo-acme-docs', number: 13, title: 'Fix search', status: 'open', author: 'pr-contributor' });
  pr({ repo: 'repo-branch-protection-demo', number: 1, title: 'Protection status onboarding PR', status: 'open', author: 'protection-admin' });

  const protections = [
    { id: 'prot-acme-main', repo: 'repo-acme-docs', pattern: 'main', requireApprovals: 1, requireStatus: 'test' }
  ];

  const checks = [
    { id: 'chk-8', repo: 'repo-acme-docs', pr: 8, name: 'test', status: 'success', actor: 'pr-maintainer' },
    { id: 'chk-bpd-1', repo: 'repo-branch-protection-demo', pr: 1, name: 'test', status: 'pending', actor: null }
  ];

  return {
    session: null,
    ui: {},
    users: users,
    orgs: orgs,
    orgMembers: orgMembers,
    teams: teams,
    repos: repos,
    grants: grants,
    branches: branches,
    files: files,
    commits: commits,
    issues: issues,
    issueComments: issueComments,
    labels: labels,
    milestones: milestones,
    prs: prs,
    protections: protections,
    checks: checks
  };
})();

// Independent evolution fixtures, declared by the new requirements' GIVEN clauses.
(function(s) {
  s.savedReplies = [];
  function repo(ev) {
    const id='evolution-'+ev;
    const r={id,owner:'repo-admin',ownerType:'user',name:id,visibility:'public',description:'Evolution workspace',defaultBranch:'main',forkOf:null,stars:[],topics:[]};
    s.repos.push(r);
    for(const name of ['issue-editor','issue-commenter','file-contributor','pr-contributor','pr-author','pr-reviewer'])s.grants.push({id:id+':'+name,repo:id,subject:name,subjectType:'user',role:'write'});
    s.branches.push({id:id+':main',repo:id,name:'main',head:id+':initial'},{id:id+':feature',repo:id,name:'feature',head:id+':change'});
    s.files.push({id:id+':readme',repo:id,branch:'main',path:'README.md',content:'Initial file'});
    s.commits.push({id:id+':initial',repo:id,branch:'main',message:'Initial commit',author:'repo-admin',date:'1 day ago',files:[{path:'README.md',additions:1,deletions:0}]});
    return r;
  }
  const repos={};for(let group=1;group<=3;group++)for(let num=1;num<=10;num++){const ev=`EV-${group}.${num}`;repos[ev]=repo(ev);}
  function issue(ev,title,extra={}) {const r=repos[ev],number=s.issues.filter(i=>i.repo===r.id).length+1;const i={id:r.id+':issue:'+number,repo:r.id,number,title,status:'open',description:'',author:'repo-admin',labels:[],assignees:[],milestone:null,...extra};s.issues.push(i);return i;}
  function label(ev,name,description='',color='#aaaaaa'){s.labels.push({id:repos[ev].id+':label:'+name,repo:repos[ev].id,name,description,color});}
  function pr(ev,title,extra={}) {const r=repos[ev],number=s.prs.filter(p=>p.repo===r.id).length+1;const p={id:r.id+':pr:'+number,repo:r.id,number,title,status:'open',author:'pr-author',source:'feature',target:'main',description:'',created:'1 day ago',sourceCommit:r.id+':change',baseCommit:r.id+':initial',changedFiles:[{path:'src/search.ts',additions:1,deletions:1}],commits:[],reviewers:[],reviews:[],comments:[],merged:null,...extra};s.prs.push(p);return p;}
  issue('EV-1.1','Bug EV-1.1',{status:'closed',labels:['bug'],author:'issue-editor'});
  issue('EV-1.1','Open EV-1.1',{labels:['bug'],author:'issue-editor'});
  issue('EV-1.1','Other EV-1.1',{status:'closed',labels:['docs'],author:'issue-commenter'});
  ['First','Second','Third'].forEach((name,i)=>issue('EV-1.2',name+' EV-1.2',{createdAt:`2030-01-0${i+1}`}));
  pr('EV-1.3','Draft EV-1.3',{status:'draft'});pr('EV-1.3','Ready EV-1.3');pr('EV-1.3','Other EV-1.3',{status:'draft',author:'pr-contributor'});
  issue('EV-1.4','Declined EV-1.4',{description:'Keep this description.'});issue('EV-1.5','Preview EV-1.5');
  pr('EV-1.7','Draft conversion EV-1.7',{source:'feature-ev-1.7',description:'Work in progress.'});
  s.branches.push({id:'feature-ev-1.7',repo:repos['EV-1.7'].id,name:'feature-ev-1.7',head:repos['EV-1.7'].id+':change'});
  pr('EV-1.8','Layout EV-1.8',{changedFiles:[{path:'src/message.txt',additions:1,deletions:1,beforeText:'hello before',afterText:'hello after'}]});
  issue('EV-1.9','Label search EV-1.9');['bug','documentation','enhancement'].forEach(x=>label('EV-1.9',x));
  const cr=repos['EV-1.10'];s.branches.push({id:cr.id+':feature-ev-1.10',repo:cr.id,name:'feature-ev-1.10',head:cr.id+':compare'});
  s.files.push({id:cr.id+':file-main',repo:cr.id,branch:'main',path:'src/compare.txt',content:'before'},{id:cr.id+':file-feature',repo:cr.id,branch:'feature-ev-1.10',path:'src/compare.txt',content:'after'});
  s.commits.push({id:cr.id+':compare',repo:cr.id,branch:'feature-ev-1.10',message:'Compare update',author:'pr-contributor',date:'1 hour ago',files:[{path:'src/compare.txt',additions:1,deletions:1}]});
  repos['EV-2.4'].topics=['api','docs'];issue('EV-2.5','Preserved EV-2.5');
  repos['EV-2.6'].archived=true;issue('EV-2.6','Read only EV-2.6',{description:'Historical discussion.'});
  issue('EV-2.7','Apply EV-2.7');label('EV-2.8','old-ev-2.8','Old description');issue('EV-2.8','Linked EV-2.8',{labels:['old-ev-2.8']});
  issue('EV-2.9','Schedule EV-2.9');s.milestones.push({id:'milestone-EV-2.10',repo:repos['EV-2.10'].id,title:'Cycle EV-2.10',description:'Preserve scope',due:'2030-12-01',closed:false});
  issue('EV-3.1','Lock EV-3.1',{description:'Retain context.'});issue('EV-3.2','Lock permission EV-3.2',{description:'Readable content.'});
  issue('EV-3.3','Pinned EV-3.3');issue('EV-3.4','Unpin EV-3.4',{pinned:true,pinnedAt:1,description:'Keep this issue.'});
  issue('EV-3.5','React EV-3.5');issue('EV-3.6','Reply EV-3.6');
  const edit=issue('EV-3.7','Edit comment EV-3.7'),del=issue('EV-3.8','Delete comment EV-3.8',{description:'Keep the issue body.'});
  s.issueComments.push({id:'comment-EV-3.7',issue:edit.id,author:'issue-commenter',body:'Original comment EV-3.7',created:'1 day ago'},{id:'comment-EV-3.8',issue:del.id,author:'issue-commenter',body:'Disposable EV-3.8',created:'1 day ago'});
  issue('EV-3.9','Checklist EV-3.9',{description:'- [ ] Add tests\n- [ ] Update docs'});
  pr('EV-3.10','Resolve EV-3.10',{threads:[{id:'thread-EV-3.10',title:'Thread EV-3.10',author:'pr-reviewer',body:'Handle the empty case.',path:'src/search.ts',resolved:false}]});
})(window.SEED);

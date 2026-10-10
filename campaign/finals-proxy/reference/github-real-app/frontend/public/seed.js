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

// The real finals' declared evolution fixtures are independent of the originals.
(function (state) {
  const password = 'Evo-Password-987!';
  const accounts = [
    ['evo-register-existing','evo.register.existing@evolution.test'],
    ['evo-login-case','evo.login.case@evolution.test'],
    ['evo-session-owner','evo.session.owner@evolution.test'],
    ['evo-session-owner-s2','evo.session.owner.s2@evolution.test'],
    ['evo-session-owner-s3','evo.session.owner.s3@evolution.test'],
    ['evo-org-owner','evo.org.owner@evolution.test'],
    ['evo-audit-owner','evo.audit.owner@evolution.test'],
    ['evo-audit-viewer','evo.audit.viewer@evolution.test'],
    ['evo-archive-admin','evo.archive.admin@evolution.test'],
    ['evo-archive-viewer','evo.archive.viewer@evolution.test'],
    ['evo-release-owner','evo.release.owner@evolution.test'],
    ['evo-reaction-author','evo.reaction.author@evolution.test'],
    ['evo-reaction-user','evo.reaction.user@evolution.test']
  ];
  for (const [name,email] of accounts) state.users.push({id:'u-'+name,name,email,password,verified:true,available:true});
  state.orgs.push({id:'org-evo-lab-02',name:'evo-lab-02',display:'Evo Lab Two',description:''});
  state.orgs.push({id:'org-evo-audit-org',name:'evo-audit-org',display:'evo-audit-org',description:'Organization audit history'});
  state.orgMembers.push({org:'evo-lab-02',user:'evo-org-owner',role:'owner'},
    {org:'evo-audit-org',user:'evo-audit-owner',role:'owner'}, {org:'evo-audit-org',user:'evo-audit-viewer',role:'member'});
  state.auditEvents = [
    {id:'audit-member',org:'evo-audit-org',actor:'evo-audit-owner',action:'Member added',target:'evo-audit-viewer',timestamp:'2026-10-06T10:00:00Z'},
    {id:'audit-repository',org:'evo-audit-org',actor:'evo-audit-owner',action:'Repository created',target:'audit-notes',timestamp:'2026-10-06T10:05:00Z'}
  ];
  state.releases = [];
  function repository(name, owner, branch, archived, description) {
    const id = 'repo-' + name;
    state.repos.push({id,name,owner,ownerType:'user',visibility:'public',description:description || '',defaultBranch:branch,archived:!!archived,forkOf:null});
    state.branches.push({id:id+':'+branch,repo:id,name:branch,head:null});
    state.files.push({id:id+':readme',repo:id,branch,path:'README.md',content:'Repository documentation for '+name+'.'});
    return id;
  }
  repository('evo-search-catalog-s1','evo-org-owner','main',false,'An evolution catalog');
  repository('evo-search-notebook-s2','evo-org-owner','main',false,'An evolution-notebook for the team');
  for (let i=1;i<=3;i++) repository('evo-archive-repository-s'+i,'evo-archive-admin','main',i!==1,'Archive lifecycle example');
  for (let i=1;i<=3;i++) {
    const id=repository('evo-branch-switch-s'+i,'evo-org-owner','evo-main-s'+i,false,'Branch navigation');
    state.branches.push({id:id+':feature',repo:id,name:'evo-feature-s'+i,head:null});
    state.files.push({id:id+':target',repo:id,branch:'evo-feature-s'+i,path:'evo-target-s'+i+'.md',content:'Available only on the feature branch.'});
    const releaseRepo=repository('evo-release-repository-s'+i,'evo-org-owner','evo-main-s'+i,false,'Release history');
    state.grants.push({id:'evo-release-write-'+i,repo:releaseRepo,subject:'evo-release-owner',subjectType:'user',role:'write'});
    if(i>1) state.releases.push({id:'release-evo-s'+i,repo:releaseRepo,tag:'evo-v0-1-s'+i,title:i===2?'Existing Evolution Release':'First Evolution Release',description:i===2?'Evolution release':'Initial evolution release notes.',branch:'evo-main-s'+i});
  }
  const reactionRepo=repository('evo-reaction-repository-s1','evo-reaction-author','main',false,'Public issue reactions');
  for(let i=1;i<=3;i++) state.issues.push({id:reactionRepo+':issue:'+i,repo:reactionRepo,number:i,title:'Evo reaction issue s'+i,status:'open',description:'Discuss the evolution change.',author:'evo-reaction-author',labels:[],assignees:[],milestone:null,reactions:i===3?{'+1':['evo-reaction-author']}:{}});
})(window.SEED);

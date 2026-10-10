'use strict';
// Initial records required by the GIVEN clauses. Accounts, organizations, teams, repositories,
// branches, files, commits, issues, pull requests, labels, milestones, protections, checks,
// releases, reactions, audit events and active browser sessions.
window.SEED = (function () {
  const PWD = 'Valid-password-123!';
  const EVO = 'Evo-Password-987!';
  function u(name, email) { return { id: 'u-' + name, name: name, email: email, password: PWD }; }
  function ue(name, email) { return { id: 'u-' + name, name: name, email: email, password: EVO }; }

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
    u('pr-viewer', 'pr-viewer@example.test'),
    ue('evo-register-existing', 'evo.register.existing@evolution.test'),
    ue('evo-login-case', 'evo.login.case@evolution.test'),
    ue('evo-session-owner', 'evo.session.owner@evolution.test'),
    ue('evo-session-owner-s2', 'evo.session.owner.s2@evolution.test'),
    ue('evo-session-owner-s3', 'evo.session.owner.s3@evolution.test'),
    ue('evo-org-owner', 'evo.org.owner@evolution.test'),
    ue('evo-audit-owner', 'evo.audit.owner@evolution.test'),
    ue('evo-audit-viewer', 'evo.audit.viewer@evolution.test'),
    ue('evo-release-owner', 'evo.release.owner@evolution.test'),
    ue('evo-archive-admin', 'evo.archive.admin@evolution.test'),
    ue('evo-archive-viewer', 'evo.archive.viewer@evolution.test'),
    ue('evo-reaction-author', 'evo.reaction.author@evolution.test'),
    ue('evo-reaction-user', 'evo.reaction.user@evolution.test')
  ];

  const orgs = [
    { id: 'org-acme-demo', name: 'acme-demo', display: 'Acme Demo', description: 'Public demo organization' },
    { id: 'org-evo-lab-02', name: 'evo-lab-02', display: 'Evo Lab Two', description: 'Evolution organization' },
    { id: 'org-evo-audit-org', name: 'evo-audit-org', display: 'evo-audit-org', description: 'Audited organization' }
  ];

  const orgMembers = [
    { org: 'acme-demo', user: 'org-owner', role: 'owner' },
    { org: 'acme-demo', user: 'team-maintainer', role: 'owner' },
    { org: 'acme-demo', user: 'org-member', role: 'member' },
    { org: 'acme-demo', user: 'existing-member', role: 'member' },
    { org: 'acme-demo', user: 'protected-member', role: 'member' },
    { org: 'acme-demo', user: 'bob-reviewer', role: 'member' },
    { org: 'acme-demo', user: 'repo-admin', role: 'member' },
    { org: 'acme-demo', user: 'repo-owner', role: 'member' },
    { org: 'evo-lab-02', user: 'evo-org-owner', role: 'owner' },
    { org: 'evo-audit-org', user: 'evo-audit-owner', role: 'owner' },
    { org: 'evo-audit-org', user: 'evo-audit-viewer', role: 'member' }
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
    { id: 'repo-branch-protection-demo', owner: 'acme-demo', ownerType: 'org', name: 'branch-protection-demo', visibility: 'public', description: 'Branch protection demo', defaultBranch: 'main', forkOf: null },
    { id: 'repo-evo-search-catalog', owner: 'acme-demo', ownerType: 'org', name: 'evo-search-catalog-s1', visibility: 'public', description: 'Evolution catalog', defaultBranch: 'main', forkOf: null },
    { id: 'repo-evo-search-notebook', owner: 'acme-demo', ownerType: 'org', name: 'evo-search-notebook-s2', visibility: 'public', description: 'Notes for the evolution-notebook workflow', defaultBranch: 'main', forkOf: null },
    { id: 'repo-evo-branch-s1', owner: 'acme-demo', ownerType: 'org', name: 'evo-branch-switch-s1', visibility: 'public', description: 'Branch switching evolution one', defaultBranch: 'evo-main-s1', forkOf: null },
    { id: 'repo-evo-branch-s2', owner: 'acme-demo', ownerType: 'org', name: 'evo-branch-switch-s2', visibility: 'public', description: 'Branch switching evolution two', defaultBranch: 'evo-main-s2', forkOf: null },
    { id: 'repo-evo-branch-s3', owner: 'acme-demo', ownerType: 'org', name: 'evo-branch-switch-s3', visibility: 'public', description: 'Branch switching evolution three', defaultBranch: 'evo-main-s3', forkOf: null },
    { id: 'repo-evo-release-s1', owner: 'acme-demo', ownerType: 'org', name: 'evo-release-repository-s1', visibility: 'public', description: 'Releases evolution one', defaultBranch: 'evo-main-s1', forkOf: null },
    { id: 'repo-evo-release-s2', owner: 'acme-demo', ownerType: 'org', name: 'evo-release-repository-s2', visibility: 'public', description: 'Releases evolution two', defaultBranch: 'evo-main-s2', forkOf: null },
    { id: 'repo-evo-release-s3', owner: 'acme-demo', ownerType: 'org', name: 'evo-release-repository-s3', visibility: 'public', description: 'Releases evolution three', defaultBranch: 'evo-main-s3', forkOf: null },
    { id: 'repo-evo-archive-s1', owner: 'acme-demo', ownerType: 'org', name: 'evo-archive-repository-s1', visibility: 'public', description: 'Archive demo one', defaultBranch: 'main', forkOf: null, archived: false },
    { id: 'repo-evo-archive-s2', owner: 'acme-demo', ownerType: 'org', name: 'evo-archive-repository-s2', visibility: 'public', description: 'Archive demo two', defaultBranch: 'main', forkOf: null, archived: true },
    { id: 'repo-evo-archive-s3', owner: 'acme-demo', ownerType: 'org', name: 'evo-archive-repository-s3', visibility: 'public', description: 'Archive demo three', defaultBranch: 'main', forkOf: null, archived: true },
    { id: 'repo-evo-reaction-s1', owner: 'acme-demo', ownerType: 'org', name: 'evo-reaction-repository-s1', visibility: 'public', description: 'Reaction demo repository', defaultBranch: 'main', forkOf: null }
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
    { id: 'g15', repo: 'repo-branch-protection-demo', subject: 'protection-admin', subjectType: 'user', role: 'admin' },
    { id: 'g16', repo: 'repo-evo-release-s1', subject: 'evo-release-owner', subjectType: 'user', role: 'write' },
    { id: 'g17', repo: 'repo-evo-release-s3', subject: 'evo-release-owner', subjectType: 'user', role: 'write' },
    { id: 'g18', repo: 'repo-evo-archive-s1', subject: 'evo-archive-admin', subjectType: 'user', role: 'admin' },
    { id: 'g19', repo: 'repo-evo-archive-s2', subject: 'evo-archive-admin', subjectType: 'user', role: 'admin' },
    { id: 'g20', repo: 'repo-evo-archive-s3', subject: 'evo-archive-admin', subjectType: 'user', role: 'admin' },
    { id: 'g21', repo: 'repo-evo-archive-s2', subject: 'evo-archive-viewer', subjectType: 'user', role: 'read' },
    { id: 'g22', repo: 'repo-evo-archive-s3', subject: 'evo-archive-viewer', subjectType: 'user', role: 'read' }
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

  br('repo-evo-search-catalog', 'main', 'c-esc-1');
  f('repo-evo-search-catalog', 'main', 'README.md', 'Evolution catalog');
  c('repo-evo-search-catalog', 'main', 'c-esc-1', 'Initial commit', 'alice-dev', '3 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);
  br('repo-evo-search-notebook', 'main', 'c-esn-1');
  f('repo-evo-search-notebook', 'main', 'README.md', 'Evolution notebook');
  c('repo-evo-search-notebook', 'main', 'c-esn-1', 'Initial commit', 'alice-dev', '3 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);

  br('repo-evo-branch-s1', 'evo-main-s1', 'c-ebs1-main');
  br('repo-evo-branch-s1', 'evo-feature-s1', 'c-ebs1-feat');
  f('repo-evo-branch-s1', 'evo-main-s1', 'evo-readme-s1.md', 'Branch switch demo s1');
  f('repo-evo-branch-s1', 'evo-feature-s1', 'evo-target-s1.md', 'Only on the target branch');
  c('repo-evo-branch-s1', 'evo-main-s1', 'c-ebs1-main', 'Initial commit', 'alice-dev', '4 days ago', [{ path: 'evo-readme-s1.md', additions: 1, deletions: 0 }]);

  br('repo-evo-branch-s2', 'evo-main-s2', 'c-ebs2-main');
  br('repo-evo-branch-s2', 'evo-feature-s2', 'c-ebs2-feat');
  f('repo-evo-branch-s2', 'evo-main-s2', 'evo-readme-s2.md', 'Branch switch demo s2');
  f('repo-evo-branch-s2', 'evo-feature-s2', 'evo-target-s2.md', 'Only on the target branch');
  c('repo-evo-branch-s2', 'evo-main-s2', 'c-ebs2-main', 'Initial commit', 'alice-dev', '4 days ago', [{ path: 'evo-readme-s2.md', additions: 1, deletions: 0 }]);

  br('repo-evo-branch-s3', 'evo-main-s3', 'c-ebs3-main');
  br('repo-evo-branch-s3', 'evo-feature-s3', 'c-ebs3-feat');
  f('repo-evo-branch-s3', 'evo-main-s3', 'evo-readme-s3.md', 'Branch switch demo s3');
  f('repo-evo-branch-s3', 'evo-feature-s3', 'evo-target-s3.md', 'Only on the target branch');
  c('repo-evo-branch-s3', 'evo-main-s3', 'c-ebs3-main', 'Initial commit', 'alice-dev', '4 days ago', [{ path: 'evo-readme-s3.md', additions: 1, deletions: 0 }]);

  br('repo-evo-release-s1', 'evo-main-s1', 'c-ers1-main');
  f('repo-evo-release-s1', 'evo-main-s1', 'README.md', 'Release demo one');
  c('repo-evo-release-s1', 'evo-main-s1', 'c-ers1-main', 'Initial commit', 'evo-release-owner', '6 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);
  br('repo-evo-release-s2', 'evo-main-s2', 'c-ers2-main');
  f('repo-evo-release-s2', 'evo-main-s2', 'README.md', 'Release demo two');
  c('repo-evo-release-s2', 'evo-main-s2', 'c-ers2-main', 'Initial commit', 'evo-release-owner', '6 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);
  br('repo-evo-release-s3', 'evo-main-s3', 'c-ers3-main');
  f('repo-evo-release-s3', 'evo-main-s3', 'README.md', 'Release demo three');
  c('repo-evo-release-s3', 'evo-main-s3', 'c-ers3-main', 'Initial commit', 'evo-release-owner', '6 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);

  br('repo-evo-archive-s1', 'main', 'c-eas1');
  f('repo-evo-archive-s1', 'main', 'README.md', 'Archive demo one');
  c('repo-evo-archive-s1', 'main', 'c-eas1', 'Initial commit', 'evo-archive-admin', '5 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);
  br('repo-evo-archive-s2', 'main', 'c-eas2');
  f('repo-evo-archive-s2', 'main', 'README.md', 'Archived demo two');
  c('repo-evo-archive-s2', 'main', 'c-eas2', 'Initial commit', 'evo-archive-admin', '5 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);
  br('repo-evo-archive-s3', 'main', 'c-eas3');
  f('repo-evo-archive-s3', 'main', 'README.md', 'Archived restore demo');
  c('repo-evo-archive-s3', 'main', 'c-eas3', 'Initial commit', 'evo-archive-admin', '5 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);

  br('repo-evo-reaction-s1', 'main', 'c-ersx-1');
  f('repo-evo-reaction-s1', 'main', 'README.md', 'Reaction demo');
  c('repo-evo-reaction-s1', 'main', 'c-ersx-1', 'Initial commit', 'evo-reaction-author', '2 days ago', [{ path: 'README.md', additions: 1, deletions: 0 }]);

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
    issue('repo-acme-docs', 11, 'Protected onboarding issue', 'open', 'Protected body.', 'alice-dev'),
    issue('repo-evo-reaction-s1', 1, 'Evo reaction issue s1', 'open', 'Reaction issue one.', 'evo-reaction-author'),
    issue('repo-evo-reaction-s1', 2, 'Evo reaction issue s2', 'open', 'Reaction issue two.', 'evo-reaction-author'),
    issue('repo-evo-reaction-s1', 3, 'Evo reaction issue s3', 'open', 'Reaction issue three.', 'evo-reaction-author')
  ];

  const issueComments = [
    { id: 'ic-1', issue: 'repo-acme-docs:issue:1', author: 'alice-dev', body: 'This issue tracks the onboarding improvement.', created: '2 days ago' },
    { id: 'ic-2', issue: 'repo-acme-docs:issue:1', author: 'bob-reviewer', body: 'Activity: opened the issue for discussion.', created: '1 day ago' },
    { id: 'ic-3', issue: 'repo-evo-reaction-s1:issue:1', author: 'evo-reaction-author', body: 'Tracking the reaction workflow.', created: '2 days ago' },
    { id: 'ic-4', issue: 'repo-evo-reaction-s1:issue:3', author: 'evo-reaction-author', body: 'Existing reaction discussion.', created: '2 days ago' }
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

  const releases = [
    {
      id: 'rel-evo-s2', repo: 'repo-evo-release-s2', tag: 'evo-v0-1-s2',
      title: 'Existing Evolution Release', description: 'Existing evolution release description.',
      target: 'evo-main-s2', author: 'evo-release-owner', created: '2 days ago'
    },
    {
      id: 'rel-evo-s3', repo: 'repo-evo-release-s3', tag: 'evo-v0-1-s3',
      title: 'Existing evolution tag release', description: 'Existing tag description.',
      target: 'evo-main-s3', author: 'evo-release-owner', created: '3 days ago'
    }
  ];

  const reactions = [
    { id: 'rx-seed-1', issue: 'repo-evo-reaction-s1:issue:3', user: 'evo-reaction-author', type: '+1' }
  ];

  const auditEvents = [
    { id: 'ae-1', org: 'evo-audit-org', actor: 'evo-audit-owner', action: 'Member added', target: 'evo-audit-viewer', timestamp: '2 days ago' },
    { id: 'ae-2', org: 'evo-audit-org', actor: 'evo-audit-owner', action: 'Repository created', target: 'evo-audit-project', timestamp: '1 day ago' }
  ];

  const sessions = [
    { id: 'sess-evo-s2-other', user: 'u-evo-session-owner-s2', device: 'Chrome on Linux', lastActive: '2 hours ago', active: true }
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
    checks: checks,
    releases: releases,
    reactions: reactions,
    auditEvents: auditEvents,
    sessions: sessions
  };
})();

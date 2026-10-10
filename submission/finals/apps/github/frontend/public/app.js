'use strict';
// Application screens, layout and actions. Every screen renders through the shared layout;
// navigation renders synchronously from the in-memory store.
(function () {
  const RANK = { read: 1, triage: 2, write: 3, maintain: 4, admin: 5 };
  const esc = function (s) { return ARC.esc(s); };
  const S = function () { return ARC.state; };
  function ui() { if (!S().ui || typeof S().ui !== 'object') S().ui = {}; return S().ui; }
  function save() { ARC.save(); }
  function me() { return ARC.currentUser(); }

  // --- Session identity. A browser login is a persisted session record; this browser keeps its id,
  // so revoking the record signs this browser out on its next read.
  ARC.currentUser = function () {
    const s = ARC.state;
    if (!s || !s.session) return null;
    const raw = s.session;
    const userId = (raw && typeof raw === 'object') ? raw.user : raw;
    if (raw && typeof raw === 'object' && raw.sid) {
      const rec = (s.sessions || []).find(function (x) { return x.id === raw.sid; });
      if (rec && rec.active === false) return null;
    }
    return (s.users || []).find(function (u) { return u.id === userId; }) || null;
  };
  function currentSessionId() {
    const raw = S().session;
    return (raw && typeof raw === 'object') ? (raw.sid || null) : null;
  }
  function deviceLabel() {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge'
      : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS'
      : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
    return browser + ' on ' + os;
  }

  function users() { return S().users || []; }
  function byLogin(v) {
    const q = String(v == null ? '' : v).trim().toLowerCase();
    return users().find(function (x) { return x.name.toLowerCase() === q || x.email.toLowerCase() === q; }) || null;
  }
  function byName(n) {
    const q = String(n == null ? '' : n).trim().toLowerCase();
    return users().find(function (x) { return x.name.toLowerCase() === q; }) || null;
  }
  // Sign in: the username is matched exactly, the email case-insensitively.
  function findAccount(v) {
    const t = String(v == null ? '' : v).trim();
    if (!t) return null;
    const exact = users().find(function (x) { return x.name === t; });
    if (exact) return exact;
    const lower = t.toLowerCase();
    return users().find(function (x) { return x.email.toLowerCase() === lower; }) || null;
  }

  function orgs() { return S().orgs || []; }
  function orgByName(n) { return orgs().find(function (o) { return o.name === n; }) || null; }
  function orgMembers(oid) { return (S().orgMembers || []).filter(function (m) { return m.org === oid; }); }
  function memberRole(oid, uname) {
    const m = (S().orgMembers || []).find(function (m) { return m.org === oid && m.user === uname; });
    return m ? m.role : null;
  }
  function allTeams() { return S().teams || []; }
  function orgTeams(oid) { return allTeams().filter(function (t) { return t.org === oid; }); }
  function teamById(id) { return allTeams().find(function (t) { return t.id === id; }) || null; }
  function teamByName(oid, name) { return allTeams().find(function (t) { return t.org === oid && t.name === name; }) || null; }

  function repos() { return S().repos || []; }
  function repoByPath(owner, name) { return repos().find(function (r) { return r.owner === owner && r.name === name; }) || null; }
  function repoById(id) { return repos().find(function (r) { return r.id === id; }) || null; }
  function repoHref(r) { return '#/repo/' + encodeURIComponent(r.owner) + '/' + encodeURIComponent(r.name); }

  function rank(r) { return r ? (RANK[r] || 0) : 0; }
  function higher(a, b) { return rank(b) > rank(a) ? b : a; }
  function can(role, level) { return rank(role) >= rank(level); }
  // Issue operations use the explicit role lists of REQ-5 rather than a cumulative ladder.
  function canIssueWrite(role) { return role === 'write' || role === 'maintain' || role === 'admin'; }
  function canIssueManage(role) { return role === 'triage' || role === 'maintain' || role === 'admin'; }

  function repoRole(repo, usr) {
    if (!repo) return null;
    if (!usr) return repo.visibility === 'public' ? 'read' : null;
    if (repo.ownerType === 'user' && repo.owner === usr.name) return 'admin';
    if (repo.ownerType === 'org' && memberRole(repo.owner, usr.name) === 'owner') return 'admin';
    let best = null;
    for (const g of (S().grants || [])) {
      if (g.repo !== repo.id) continue;
      let ok = false;
      if (g.subjectType === 'user') ok = g.subject === usr.name;
      else { const t = teamById(g.subject); ok = !!(t && (t.members || []).indexOf(usr.name) >= 0); }
      if (ok) best = higher(best, g.role);
    }
    if (best) return best;
    return repo.visibility === 'public' ? 'read' : null;
  }
  function visibleRepos(usr) { return repos().filter(function (r) { return repoRole(r, usr) !== null; }); }
  function canWriteRepo(repo, role) { return !!repo && !repo.archived && can(role, 'write'); }

  function branches(repoId) { return (S().branches || []).filter(function (b) { return b.repo === repoId; }); }
  function branchOf(repoId, name) { return (S().branches || []).find(function (b) { return b.repo === repoId && b.name === name; }) || null; }
  function filesOf(repoId, br) { return (S().files || []).filter(function (f) { return f.repo === repoId && f.branch === br; }); }
  function fileAt(repoId, br, path) { return (S().files || []).find(function (f) { return f.repo === repoId && f.branch === br && f.path === path; }) || null; }
  function commitsOf(repoId, br) {
    let list = (S().commits || []).filter(function (c) { return c.repo === repoId && (!br || c.branch === br); });
    return list;
  }
  function commitById(id) { return (S().commits || []).find(function (c) { return c.id === id; }) || null; }
  function issuesOf(repoId) { return (S().issues || []).filter(function (i) { return i.repo === repoId; }); }
  function issueByNumber(repoId, num) { return issuesOf(repoId).find(function (i) { return String(i.number) === String(num); }) || null; }
  function commentsOf(issueId) { return (S().issueComments || []).filter(function (c) { return c.issue === issueId; }); }
  function reactionsOf(issueId) { return (S().reactions || []).filter(function (r) { return r.issue === issueId; }); }
  function labelsOf(repoId) { return (S().labels || []).filter(function (l) { return l.repo === repoId; }); }
  function milestonesOf(repoId) { return (S().milestones || []).filter(function (m) { return m.repo === repoId; }); }
  function prsOf(repoId) { return (S().prs || []).filter(function (p) { return p.repo === repoId; }); }
  function prByNumber(repoId, num) { return prsOf(repoId).find(function (p) { return String(p.number) === String(num); }) || null; }
  function protectionsOf(repoId) { return (S().protections || []).filter(function (p) { return p.repo === repoId; }); }
  function protectionFor(repoId, br) { return protectionsOf(repoId).find(function (p) { return p.pattern === br; }) || null; }
  function checksOf(repoId, prNum) { return (S().checks || []).filter(function (c) { return c.repo === repoId && String(c.pr) === String(prNum); }); }
  function releasesOf(repoId) { return (S().releases || []).filter(function (r) { return r.repo === repoId; }); }
  function releaseByTag(repoId, tag) { return releasesOf(repoId).find(function (r) { return r.tag === tag; }) || null; }
  function auditEventsOf(orgName) { return (S().auditEvents || []).filter(function (e) { return e.org === orgName; }); }

  function setErrs(page, list) { ui().err = { page: page, list: list }; save(); }
  function errList(page) { const e = ui().err; return (e && e.page === page) ? (e.list || []) : []; }
  function errHtml(page) {
    return errList(page).map(function (t) {
      return '<p class="msg error" role="alert">' + esc(t) + '</p>';
    }).join('');
  }
  function setOk(page, text) { ui().ok = { page: page, text: text }; save(); }
  function okHtml(page) {
    const e = ui().ok;
    if (!e || e.page !== page || !e.text) return '';
    return '<p class="msg ok" role="status">' + esc(e.text) + '</p>';
  }

  function validUsername(v) {
    const s = String(v == null ? '' : v);
    if (s.length < 1 || s.length > 39) return false;
    if (!/^[a-z0-9_-]+$/.test(s)) return false;
    if (/^[-_]/.test(s) || /[-_]$/.test(s)) return false;
    if (/[-_]{2}/.test(s)) return false;
    return true;
  }
  function validEmail(v) {
    const s = String(v == null ? '' : v).trim();
    if (s.length > 254) return false;
    const parts = s.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1];
    if (!domain || domain.indexOf('.') < 0) return false;
    return domain.split('.').every(function (x) { return x.length > 0; });
  }
  function validPassword(v) {
    const s = String(v == null ? '' : v);
    if (s.length < 12 || s.length > 128) return false;
    if (/\s/.test(s)) return false;
    if (!/[A-Z]/.test(s)) return false;
    if (!/[a-z]/.test(s)) return false;
    if (!/[0-9]/.test(s)) return false;
    if (!/[^A-Za-z0-9]/.test(s)) return false;
    return true;
  }
  function validBranchName(v) {
    const s = String(v == null ? '' : v);
    if (!s || s.length > 255) return false;
    if (!/^[A-Za-z0-9._\/-]+$/.test(s)) return false;
    if (/[\/.]$/.test(s)) return false;
    if (s.indexOf('..') >= 0) return false;
    if (s.indexOf('//') >= 0) return false;
    return true;
  }
  function uid(prefix) { return ARC.uid(prefix || 'id'); }

  function repoNav(r) {
    const base = repoHref(r);
    return '<nav class="repo-nav">' +
      '<a href="' + base + '">Code</a> ' +
      '<a href="' + base + '/issues">Issues</a> ' +
      '<a href="' + base + '/pulls">Pull requests</a> ' +
      '<a href="' + base + '/releases">Releases</a> ' +
      '<a href="' + base + '/settings">Settings</a>' +
      '</nav>';
  }
  function orgDisplayOf(owner) {
    const o = orgByName(owner);
    return o ? o.display : owner;
  }
  function repoHead(r) {
    const base = repoHref(r);
    const vis = r.visibility === 'public' ? 'Public' : 'Private';
    const ownerLink = orgByName(r.owner)
      ? '<a href="#/org/' + esc(r.owner) + '">' + esc(orgDisplayOf(r.owner)) + '</a>'
      : esc(r.owner);
    let html = '<h1>' + esc(r.owner + '/' + r.name) + '</h1>';
    html += '<p class="repo-meta"><span class="marker">' + vis + '</span> ' + ownerLink + '</p>';
    html += '<p>' + esc(r.description || '') + '</p>';
    html += '<p class="muted">Default branch: ' + esc(r.defaultBranch) + '</p>';
    html += '<p class="status-line">Status: ' + (r.archived ? '<span class="marker">Archived</span>' : 'Active') + '</p>';
    if (r.forkOf) {
      const src = repoById(r.forkOf);
      if (src) html += '<p class="forked">Forked from <a href="' + repoHref(src) + '">' + esc(src.name) + '</a></p>';
    }
    html += repoNav(r);
    return html;
  }

  function treeEntries(repoId, br, prefix) {
    const list = filesOf(repoId, br);
    const dirs = [];
    const out = [];
    for (const f of list) {
      let p = f.path;
      if (prefix) {
        if (p.indexOf(prefix + '/') !== 0) continue;
        p = p.slice(prefix.length + 1);
      }
      if (p.indexOf('/') >= 0) {
        const d = p.slice(0, p.indexOf('/'));
        if (dirs.indexOf(d) < 0) dirs.push(d);
      } else if (p.length) {
        out.push(p);
      }
    }
    dirs.sort();
    out.sort();
    return { dirs: dirs, files: out };
  }

  function reviewSummary(pr) {
    let html = '<h2>Reviews</h2>';
    html += (pr.reviews || []).map(function (rv) {
      const label = rv.decision === 'approved' ? 'Approved'
        : (rv.decision === 'changes_requested' ? 'Changes requested'
          : (rv.decision === 'ready_for_review' ? 'Ready for review' : 'Commented'));
      return '<article class="review"><p>' + esc(label) + '</p>' +
        (rv.summary ? '<p>' + esc(rv.summary) + '</p>' : '') +
        '<p class="muted">' + esc(rv.author) + '</p></article>';
    }).join('') || '<p>No reviews.</p>';
    const pend = ui().pendingReview;
    if (pend && pend.pr === pr.id) {
      html += '<p>Pending review</p>';
      html += '<article class="comment"><p>' + esc(pend.body) + '</p><p class="muted">' + esc(pend.author) + ' · Pending review</p></article>';
    }
    return html;
  }

  function highlightContent(content, q) {
    const text = String(content == null ? '' : content);
    const needle = String(q == null ? '' : q);
    if (!needle) return esc(text);
    const find = needle.toLowerCase();
    if (text.toLowerCase().indexOf(find) < 0) return esc(text);
    const out = [];
    let rest = text;
    let low = text.toLowerCase();
    while (rest) {
      const at = low.indexOf(find);
      if (at < 0) { out.push(esc(rest)); break; }
      out.push(esc(rest.slice(0, at)));
      out.push('<mark>' + esc(rest.slice(at, at + needle.length)) + '</mark>');
      rest = rest.slice(at + needle.length);
      low = low.slice(at + needle.length);
    }
    return out.join('');
  }

  function prEligibility(r, pr) {
    const prot = protectionFor(r.id, pr.target);
    const reasons = [];
    const approvers = (pr.reviews || []).filter(function (rv) { return rv.decision === 'approved' && rv.author !== pr.author && rv.commit === pr.sourceCommit; });
    if (prot) {
      if (prot.requireApprovals) {
        if (approvers.length < prot.requireApprovals) reasons.push('Review required by branch protection');
      }
      if (prot.requireStatus) {
        const chk = checksOf(r.id, pr.number).find(function (c) { return c.name === prot.requireStatus; });
        if (!chk || chk.status !== 'success') reasons.push('Status check `' + prot.requireStatus + '` has not succeeded');
      }
    }
    const changesRequested = (pr.reviews || []).some(function (rv) { return rv.decision === 'changes_requested' && rv.commit === pr.sourceCommit; });
    if (changesRequested) reasons.push('Changes requested by a reviewer');
    if (pr.status === 'draft') reasons.push('Draft pull request');
    if (pr.status !== 'open') reasons.push('Pull request is not open');
    return { ok: reasons.length === 0, reasons: reasons };
  }

  window.LAYOUT = {
    brand: 'ArcHub',
    nav: [{ label: 'Home', hash: '#/' }],
    sidebar: [{ label: 'Home', hash: '#/' }, { label: 'Explore', hash: '#/search/' }],
    footer: 'ArcHub collaboration platform.',
    search: function () {
      return '<form class="global-search" data-action="global-search">' +
        '<input id="global-q" name="q" type="search" aria-label="Search" placeholder="Search">' +
        '</form>';
    },
    account: function (u) {
      if (!u) return '';
      return '<span class="who">' + esc(u.name) + '</span>' +
        '<button type="button" data-action="account-menu" aria-label="Account menu">Account menu</button>';
    }
  };

  const APP = {
    helpers: {
      me: me, byLogin: byLogin, byName: byName, findAccount: findAccount,
      orgs: orgs, orgByName: orgByName,
      orgMembers: orgMembers, memberRole: memberRole, orgTeams: orgTeams, teamById: teamById,
      teamByName: teamByName, repos: repos, repoByPath: repoByPath, repoById: repoById, repoHref: repoHref,
      repoRole: repoRole, visibleRepos: visibleRepos, can: can, rank: rank, canWriteRepo: canWriteRepo,
      canIssueWrite: canIssueWrite, canIssueManage: canIssueManage,
      branches: branches, branchOf: branchOf, filesOf: filesOf, fileAt: fileAt,
      commitsOf: commitsOf, commitById: commitById, issuesOf: issuesOf, issueByNumber: issueByNumber,
      commentsOf: commentsOf, reactionsOf: reactionsOf, labelsOf: labelsOf, milestonesOf: milestonesOf,
      prsOf: prsOf, prByNumber: prByNumber, protectionsOf: protectionsOf, protectionFor: protectionFor,
      checksOf: checksOf, releasesOf: releasesOf, releaseByTag: releaseByTag, auditEventsOf: auditEventsOf,
      uid: uid, validBranchName: validBranchName, prEligibility: prEligibility,
      reviewSummary: reviewSummary
    },

    screen: function (route) {
      const fn = this.screens[route.name] || this.screens.home;
      return fn.call(this, route);
    },

    // The branch a repository page shows is part of its address, so a reload restores it.
    afterRender: function (route) {
      if (!route || route.name !== 'repo' || route.params.length !== 2) return;
      const r = this.repoByPath(route.params[0], route.params[1]);
      if (!r) return;
      if (this.repoRole(r, this.me()) === null) return;
      const hash = '#/repo/' + encodeURIComponent(r.owner) + '/' + encodeURIComponent(r.name) +
        '/tree/' + encodeURIComponent(r.defaultBranch);
      if ((location.hash || '#/') === hash) return;
      try { history.replaceState(null, '', hash); ARC._renderedHash = hash; } catch (e) { /* ignore */ }
    },

    screens: {
      /* ------------------------------ home ------------------------------ */
      home: function () {
        const u = this.me();
        const rs = this.visibleRepos(u);
        let html = '<h1>Home</h1>';
        if (!u) html += '<p class="signed-out"><a href="#/login">Sign in</a></p>';
        html += '<p><a href="#/search/">Explore repositories</a></p>';
        if (u) html += '<p><a href="#/new">New repository</a></p>';
        const anchor = rs.find(function (r) { return r.visibility === 'public'; }) || rs[0];
        html += '<p class="quick-links">' +
          (anchor ? '<a href="' + repoHref(anchor) + '/issues">Issues</a> ' +
            '<a href="' + repoHref(anchor) + '/pulls">Pull requests</a> ' : '') +
          '<a href="#/releases">Releases</a></p>';
        html += '<h2>Repositories</h2>';
        html += rs.map(function (r) {
          return '<article class="repo-card">' +
            '<h3><a href="' + repoHref(r) + '">' + esc(r.name) + '</a></h3>' +
            '<p class="muted">' + esc(r.owner + '/' + r.name) + ' · ' + (r.visibility === 'public' ? 'Public' : 'Private') + '</p>' +
            '<p>' + esc(r.description || '') + '</p>' +
            '</article>';
        }).join('') || '<p>No repositories.</p>';

        html += '<h2>Organizations</h2>';
        html += orgs().map(function (o) {
          return '<article class="org-card"><h3><a href="#/org/' + esc(o.name) + '">' + esc(o.display) + '</a></h3>' +
            '<p class="muted">' + esc(o.name) + '</p></article>';
        }).join('') || '<p>No organizations.</p>';

        const issueLinks = [];
        const prLinks = [];
        for (const r of rs) {
          for (const i of issuesOf(r.id)) {
            issueLinks.push('<li><a href="' + repoHref(r) + '/issues/' + i.number + '">' + esc(i.title) + '</a> <span class="muted">' + esc(r.name) + '#' + i.number + '</span></li>');
          }
          for (const p of prsOf(r.id)) {
            prLinks.push({ r: r, p: p });
          }
        }
        const issueTitles = {};
        for (const r of rs) for (const i of issuesOf(r.id)) issueTitles[i.title] = true;
        const prItems = prLinks.filter(function (x) { return !issueTitles[x.p.title]; });
        html += '<h2>Issues</h2><ul class="feed">' + (issueLinks.join('') || '<li>No issues.</li>') + '</ul>';
        html += '<h2>Pull requests</h2><ul class="feed">' +
          (prItems.map(function (x) {
            return '<li><a href="' + repoHref(x.r) + '/pulls/' + x.p.number + '">' + esc(x.p.title) + '</a> <span class="muted">' + esc(x.r.name) + '</span></li>';
          }).join('') || '<li>No pull requests.</li>') + '</ul>';
        return html;
      },

      /* ------------------------------ auth ------------------------------ */
      login: function () {
        const draft = ui().draft || {};
        return '<h1>Sign in</h1>' + errHtml('login') +
          '<form data-action="signin">' +
          '<label for="login-id">Username or email</label>' +
          '<input id="login-id" name="login" type="text" placeholder="Username or email" value="' + esc(draft.login || '') + '">' +
          '<label for="login-pw">Password</label>' +
          '<input id="login-pw" name="password" type="password" placeholder="Password">' +
          '<button type="submit">Sign in</button>' +
          '</form>' +
          '<p><a href="#/signup">Create an account</a></p>' +
          '<p><a href="#/forgot">Forgot password</a></p>';
      },

      signup: function () {
        const d = ui().draft || {};
        return '<h1>Create an account</h1>' + errHtml('signup') +
          '<form data-action="signup">' +
          '<label for="su-name">Username</label>' +
          '<input id="su-name" name="username" type="text" placeholder="Username" value="' + esc(d.username || '') + '">' +
          '<label for="su-email">Email</label>' +
          '<input id="su-email" name="email" type="text" placeholder="Email" value="' + esc(d.email || '') + '">' +
          '<label for="su-pw">Password</label>' +
          '<input id="su-pw" name="password" type="password" placeholder="Password">' +
          '<label for="su-pw2">Confirm password</label>' +
          '<input id="su-pw2" name="confirm" type="password" placeholder="Confirm password">' +
          '<label class="check"><input id="su-terms" type="checkbox" name="terms"> Agree to the terms</label>' +
          '<button type="submit">Create account</button>' +
          '</form>';
      },

      forgot: function (route) {
        const step = route.params[0] === 'reset' ? 'reset' : 'email';
        if (step === 'reset') {
          const email = ui().forgotEmail || '';
          return '<h1>Reset your password</h1>' + errHtml('forgot') + okHtml('forgot') +
            '<p class="code">' + '123456' + '</p>' +
            '<form data-action="forgot-reset">' +
            '<label for="fp-email2">Email</label>' +
            '<input id="fp-email2" name="email" type="text" value="' + esc(email) + '">' +
            '<label for="fp-code">Verification code</label>' +
            '<input id="fp-code" name="code" type="text">' +
            '<label for="fp-new">New password</label>' +
            '<input id="fp-new" name="newPassword" type="password">' +
            '<label for="fp-conf">Confirm password</label>' +
            '<input id="fp-conf" name="confirm" type="password">' +
            '<button type="submit">Reset password</button>' +
            '</form>';
        }
        return '<h1>Forgot password</h1>' + errHtml('forgot') +
          '<form data-action="forgot-send">' +
          '<label for="fp-email">Email</label>' +
          '<input id="fp-email" name="email" type="text">' +
          '<button type="submit">Send reset link</button>' +
          '</form>';
      },

      settings: function (route) {
        const u = this.me();
        if (!u) return '<h1>Settings</h1><p><a href="#/login">Sign in</a></p>';
        const sub = route.params[0];
        if (sub === 'password') {
          return '<h1>Password and authentication</h1>' + errHtml('password') + okHtml('password') +
            '<form data-action="password-update">' +
            '<label for="pw-cur">Current password</label>' +
            '<input id="pw-cur" name="current" type="password">' +
            '<label for="pw-new">New password</label>' +
            '<input id="pw-new" name="next" type="password">' +
            '<label for="pw-conf">Confirm password</label>' +
            '<input id="pw-conf" name="confirm" type="password">' +
            '<button type="submit">Update password</button>' +
            '</form>';
        }
        if (sub === 'sessions') {
          const cur = currentSessionId();
          const list = (S().sessions || []).filter(function (x) { return x.user === u.id; });
          let html = '<h1>Active sessions</h1>';
          html += '<p class="muted">Signing out ends only the browser session that signs out.</p>';
          html += list.map(function (x) {
            const isCurrent = cur !== null && x.id === cur;
            const inactive = x.active === false;
            let row = '<article class="session-row">';
            row += '<h2 class="device">' + esc(x.device) + '</h2>';
            row += '<p>Last active: ' + esc(x.lastActive) + '</p>';
            row += '<p class="session-flags">' + (isCurrent ? '<span class="marker">Current session</span>' : '') +
              (inactive ? ' <span class="state">Inactive</span>' : '') + '</p>';
            if (!isCurrent && !inactive) {
              row += '<button type="button" data-action="session-revoke" data-session="' + esc(x.id) + '">Revoke session</button>';
            }
            row += '</article>';
            return row;
          }).join('') || '<p>No sessions.</p>';
          return html;
        }
        return '<h1>Settings</h1><ul>' +
          '<li><a href="#/settings/password">Password and authentication</a></li>' +
          '<li><a href="#/settings/sessions">Active sessions</a></li>' +
          '</ul>';
      },

      /* ------------------------------ organizations ------------------------------ */
      orgs: function (route) {
        const u = this.me();
        if (!u) return '<h1>Your organizations</h1><p><a href="#/login">Sign in</a></p>';
        if (route.params[0] === 'new') {
          const d = ui().draft || {};
          return '<h1>New organization</h1>' + errHtml('orgnew') +
            '<form data-action="org-create">' +
            '<label for="on-name">Organization name</label>' +
            '<input id="on-name" name="name" type="text" value="' + esc(d.orgName || '') + '">' +
            '<label for="on-display">Display name</label>' +
            '<input id="on-display" name="display" type="text" value="' + esc(d.orgDisplay || '') + '">' +
            '<button type="submit">Create organization</button>' +
            '</form>';
        }
        const mine = orgs().filter(function (o) { return memberRole(o.name, u.name) !== null; });
        let html = '<h1>Your organizations</h1><p><a href="#/orgs/new">New organization</a></p>';
        html += mine.map(function (o) {
          return '<article class="org-card"><h3><a href="#/org/' + esc(o.name) + '">' + esc(o.display) + '</a></h3></article>';
        }).join('') || '<p>No organizations yet.</p>';
        return html;
      },

      org: function (route) {
        const p = route.params;
        const o = orgByName(p[0]);
        if (!o) return '<h1>Organization not found</h1>';
        const u = this.me();
        const section = (p[1] === 'audit' && u && memberRole(o.name, u.name) === 'owner') ? 'audit' : (p[1] || 'repositories');
        const isOwner = u && memberRole(o.name, u.name) === 'owner';
        const isMember = u && memberRole(o.name, u.name) !== null;
        let html = '<h1>' + esc(o.name) + '</h1><p class="muted">' + esc(o.display) + '</p>';
        html += '<nav class="org-nav">' +
          '<a href="#/org/' + esc(o.name) + '/repositories">Repositories</a> ' +
          '<a href="#/org/' + esc(o.name) + '/people">People</a> ' +
          '<a href="#/org/' + esc(o.name) + '/teams">Teams</a>' +
          (isOwner ? ' <a href="#/org/' + esc(o.name) + '/audit">Audit log</a>' : '') +
          '</nav>';

        if (section === 'audit') {
          html += '<h2>Audit log</h2>';
          const all = auditEventsOf(o.name);
          const actions = ['All'];
          for (const e of all) if (actions.indexOf(e.action) < 0) actions.push(e.action);
          const filter = ui().auditFilter || 'All';
          html += ARC.combobox({ label: 'Filter action', name: 'action', options: actions, value: filter, change: 'audit-filter' });
          const rows = all.filter(function (e) { return filter === 'All' || e.action === filter; });
          html += '<table class="audit-table"><thead><tr><th>Actor</th><th>Action</th><th>Target</th><th>Timestamp</th></tr></thead><tbody>';
          html += rows.map(function (e) {
            return '<tr><td class="audit-actor">' + esc(e.actor) + '</td><td class="audit-action">' + esc(e.action) +
              '</td><td class="audit-target">' + esc(e.target) + '</td><td class="audit-timestamp">' + esc(e.timestamp) + '</td></tr>';
          }).join('');
          html += '</tbody></table>';
          return html;
        }

        if (section === 'people') {
          html += '<h2>People</h2>';
          if (isOwner) {
            if (ui().peopleForm) {
              html += '<form data-action="people-add">' +
                '<label for="pm-user">Username or email</label>' +
                '<input id="pm-user" name="login" type="text">' +
                ARC.combobox({ label: 'Role', name: 'role', options: ['Member', 'Owner'], value: 'Member' }) +
                '<button type="submit">Add member</button>' +
                ' <button type="button" data-action="people-add-close">Cancel</button>' +
                '</form>';
            } else {
              html += '<button type="button" data-action="people-add-open">Add member</button>';
            }
          }
          html += errHtml('people');
          const members = orgMembers(o.name);
          html += '<table class="access-table people-table"><thead><tr><th>Username</th><th>Role</th><th>Action</th></tr></thead><tbody>';
          html += members.map(function (m) {
            let row = '<tr data-member="' + esc(m.user) + '">' +
              '<td class="member-name">' + esc(m.user) + '</td>' +
              '<td class="role">' + (m.role === 'owner' ? 'Owner' : 'Member') + '</td>' +
              '<td class="member-action">';
            if (isOwner) {
              row += '<button type="button" data-action="people-menu" data-user="' + esc(m.user) + '" aria-label="Member menu ' + esc(m.user) + '">Member menu ' + esc(m.user) + '</button>';
            }
            row += '</td></tr>';
            return row;
          }).join('');
          html += '</tbody></table>';
          if (!members.length) html += '<p>No members.</p>';
          return html;
        }

        if (section === 'teams') {
          if (p[2] === 'new') {
            return html + '<h2>New team</h2>' + errHtml('teamnew') +
              '<form data-action="team-create">' +
              '<label for="nt-name">Team name</label>' +
              '<input id="nt-name" name="name" type="text">' +
              '<button type="submit">Create team</button>' +
              '</form>';
          }
          if (p[2]) {
            const t = teamByName(o.name, p[2]);
            if (!t) return html + '<h2>Team not found</h2>';
            const sub = p[3] || 'members';
            let out = '<h2>' + esc(t.name) + '</h2>' +
              '<nav class="team-nav"><a href="#/org/' + esc(o.name) + '/teams/' + esc(t.name) + '">Members</a> ' +
              '<a href="#/org/' + esc(o.name) + '/teams/' + esc(t.name) + '/settings">Settings</a></nav>';
            if (sub === 'settings') {
              const opts = orgTeams(o.name).filter(function (x) { return x.id !== t.id; }).map(function (x) { return x.name; });
              out += errHtml('teamsettings');
              out += '<form data-action="team-parent">' +
                ARC.combobox({ label: 'Parent team', name: 'parent', options: [''].concat(opts), value: t.parent ? (teamById(t.parent) || {}).name : '' }) +
                '<button type="submit">Save</button></form>';
              return html + out;
            }
            out += errHtml('teammembers');
            if (ui().teamAdd) {
              out += '<form data-action="team-member-add" data-team="' + esc(t.id) + '">' +
                '<label for="tm-user">Username</label>' +
                '<input id="tm-user" name="login" type="text">' +
                '<button type="submit">Add member</button> ' +
                '<button type="button" data-action="team-add-close">Cancel</button>' +
                '</form>';
            } else {
              out += '<button type="button" data-action="team-add-open">Add member</button>';
            }
            out += '<ul class="member-list">' + (t.members || []).map(function (m) {
              return '<li><span>' + esc(m) + '</span> <button type="button" data-action="team-member-remove" data-team="' + esc(t.id) + '" data-user="' + esc(m) + '">Remove ' + esc(m) + '</button></li>';
            }).join('') + '</ul>';
            return html + out;
          }
          html += '<h2>Teams</h2><p><a href="#/org/' + esc(o.name) + '/teams/new">New team</a></p>';
          html += orgTeams(o.name).map(function (t) {
            return '<article class="team-row"><h3><a href="#/org/' + esc(o.name) + '/teams/' + esc(t.name) + '">' + esc(t.name) + '</a></h3></article>';
          }).join('') || '<p>No teams.</p>';
          return html;
        }

        // repositories
        html += '<h2>Repositories</h2>';
        html += '<label for="org-find">Find a repository</label>' +
          '<input id="org-find" name="find" type="text" placeholder="Find a repository" data-change="filter-org-repos"> ';
        html += ARC.combobox({ label: 'Visibility', name: 'visibility', options: ['All', 'Public', 'Private'], value: (ui().orgVis || 'All'), change: 'org-visibility' });
        const list = repos().filter(function (r) {
          if (r.owner !== o.name) return false;
          return repoRole(r, u) !== null;
        }).filter(function (r) {
          const v = ui().orgVis || 'All';
          if (v === 'Public') return r.visibility === 'public';
          if (v === 'Private') return r.visibility === 'private';
          return true;
        });
        html += list.map(function (r) {
          return '<article class="repo-card" data-repo-row data-name="' + esc(r.name) + '">' +
            '<h3><a href="' + repoHref(r) + '">' + esc(r.name) + '</a></h3>' +
            '<p class="muted">' + (r.visibility === 'public' ? 'Public' : 'Private') + ' · ' + esc(r.description || '') + '</p>' +
            '<p class="muted">Updated 2 days ago</p></article>';
        }).join('') || '<p>No repositories.</p>';
        return html;
      },

      search: function (route) {
        const q = route.params[0] || '';
        const u = this.me();
        const needle = String(q).toLowerCase();
        const rs = this.visibleRepos(u).filter(function (r) {
          if (!needle) return true;
          if (r.name.toLowerCase().indexOf(needle) >= 0) return true;
          return String(r.description || '').toLowerCase().indexOf(needle) >= 0;
        });
        let html = '<h1>Search results</h1>';
        html += '<p class="muted">Query: ' + esc(q) + '</p>';
        if (!rs.length) html += '<p>No results</p>';
        html += rs.map(function (r) {
          return '<article class="repo-card"><h3><a href="' + repoHref(r) + '">' + esc(r.name) + '</a></h3>' +
            '<p class="muted">' + esc(r.owner + '/' + r.name) + ' · ' + (r.visibility === 'public' ? 'Public' : 'Private') + '</p>' +
            '<p>' + esc(r.description || '') + '</p></article>';
        }).join('');
        return html;
      },

      /* ------------------------------ repositories ------------------------------ */
      new: function () {
        const u = this.me();
        if (!u) return '<h1>New repository</h1><p><a href="#/login">Sign in</a></p>';
        const d = ui().draft || {};
        const owners = [u.name].concat(orgs().filter(function (o) { return memberRole(o.name, u.name) === 'owner'; }).map(function (o) { return o.name; }));
        return '<h1>New repository</h1>' + errHtml('newrepo') +
          '<form data-action="repo-create">' +
          ARC.combobox({ label: 'Owner', name: 'owner', options: owners, value: d.owner || u.name }) +
          '<label for="nr-name">Repository name</label>' +
          '<input id="nr-name" name="name" type="text" value="' + esc(d.name || '') + '">' +
          '<label for="nr-desc">Description</label>' +
          '<input id="nr-desc" name="description" type="text" value="' + esc(d.description || '') + '">' +
          '<label class="radio"><input type="radio" name="visibility" value="public"> Public</label>' +
          '<label class="radio"><input type="radio" name="visibility" value="private" checked> Private</label>' +
          '<label class="check"><input type="checkbox" name="readme"> Add a README file</label>' +
          '<button type="submit">Create repository</button>' +
          '</form>';
      },

      releases: function () {
        const u = this.me();
        const rows = [];
        for (const r of this.visibleRepos(u)) {
          for (const rel of releasesOf(r.id)) rows.push({ r: r, rel: rel });
        }
        let html = '<h1>Releases</h1>';
        html += rows.map(function (x) {
          return '<article class="release-row"><h3><a href="' + repoHref(x.r) + '/releases/' + encodeURIComponent(x.rel.tag) + '">' + esc(x.rel.tag) + '</a></h3>' +
            '<p class="muted">' + esc(x.r.owner + '/' + x.r.name) + ' · Target branch: ' + esc(x.rel.target) + '</p></article>';
        }).join('') || '<p>No releases.</p>';
        return html;
      },

      repo: function (route) {
        const p = route.params;
        const r = this.repoByPath(p[0], p[1]);
        if (!r) return '<h1>Repository not found</h1>';
        const u = this.me();
        const role = this.repoRole(r, u);
        if (!role) return '<h1>Access denied</h1><p>You do not have access to this repository.</p>';
        const sub = p[2] || 'code';

        if (sub === 'issues') return this.repoIssues(r, role, p.slice(3));
        if (sub === 'pulls') return this.repoPulls(r, role, p.slice(3));
        if (sub === 'releases') return this.repoReleases(r, role, p.slice(3));
        if (sub === 'settings') return this.repoSettings(r, role, p.slice(3));
        if (sub === 'commits') return this.repoCommits(r, p[3], p.slice(4).join('/'));
        if (sub === 'commit') return this.repoCommitDetail(r, p[3]);
        if (sub === 'search') return this.repoSearch(r, p.slice(3).join('/'));
        if (sub === 'tree') return this.repoCode(r, role, p[3], p.slice(4).join('/'));
        if (sub === 'blob') return this.repoBlob(r, role, p[3], p.slice(4).join('/'));
        if (sub === 'newfile') return this.repoNewFile(r, role, p[3]);
        if (sub === 'fork') return this.forkForm(r, role);
        return this.repoCode(r, role, r.defaultBranch, '');
      },

      repoCode: function (r, role, br, path) {
        const branch = this.branchOf(r.id, br) ? br : r.defaultBranch;
        let html = repoHead(r);
        html += '<div class="code-toolbar">';
        html += '<button type="button" data-action="branch-menu" data-repo="' + esc(r.id) + '" data-branch="' + esc(branch) + '">Branch ' + esc(branch) + '</button> ';
        html += '<span class="menu-host" data-host><button type="button" data-action="clone-menu" data-repo="' + esc(r.id) + '">Code</button></span> ';
        if (this.canWriteRepo(r, role)) {
          html += '<button type="button" data-action="addfile-menu">Add file</button> ';
        }
        html += '<button type="button" data-action="fork-start" data-repo="' + esc(r.id) + '">Fork</button> ';
        html += '<a href="' + repoHref(r) + '/commits/' + encodeURIComponent(branch) + '">Commits</a>';
        html += '</div>';
        html += '<form class="repo-search" data-action="repo-search" data-repo="' + esc(r.id) + '">' +
          '<label for="repo-q">Search</label>' +
          '<input id="repo-q" name="q" type="search" aria-label="Search" placeholder="Search">' +
          '<button type="submit">Search</button></form>';
        if (this.canWriteRepo(r, role)) {
          html += '<p><a href="' + repoHref(r) + '/newfile/' + encodeURIComponent(branch) + '">Add file path</a></p>';
        }
        html += errHtml('repofile');
        html += this.repoTrees(r, branch, path);
        return html;
      },

      repoTrees: function (r, branch, path) {
        const e = treeEntries(r.id, branch, path);
        const base = repoHref(r);
        const parts = path ? path.split('/') : [];
        let crumbs = '<p class="crumbs"><a href="' + base + '/tree/' + encodeURIComponent(branch) + '">' + esc(r.name) + '</a>';
        let acc = '';
        for (const part of parts) {
          acc = acc ? acc + '/' + part : part;
          crumbs += ' / <a href="' + base + '/tree/' + encodeURIComponent(branch) + '/' + acc.split('/').map(encodeURIComponent).join('/') + '">' + esc(part) + '</a>';
        }
        crumbs += '</p>';
        let html = crumbs;
        html += e.dirs.map(function (d) {
          const next = (path ? path + '/' : '') + d;
          return '<div class="entry"><a href="' + base + '/tree/' + encodeURIComponent(branch) + '/' + next.split('/').map(encodeURIComponent).join('/') + '">' + esc(d) + '</a></div>';
        }).join('');
        html += e.files.map(function (f) {
          const next = (path ? path + '/' : '') + f;
          return '<div class="entry"><a href="' + base + '/blob/' + encodeURIComponent(branch) + '/' + next.split('/').map(encodeURIComponent).join('/') + '">' + esc(f) + '</a></div>';
        }).join('');
        html += '<h2>Last commit</h2>' + (commitsOf(r.id, branch).map(function (c) {
          return '<article class="commit-row"><a href="' + repoHref(r) + '/commit/' + encodeURIComponent(c.id) + '">' + esc(c.message) + '</a> <span class="muted">' + esc(c.author) + ' · ' + esc(c.date) + '</span></article>';
        }).join('') || '<p>No commits yet.</p>');
        return html;
      },

      repoBlob: function (r, role, branch, path) {
        const f = fileAt(r.id, branch, path);
        const base = repoHref(r);
        let html = repoHead(r);
        html += '<p class="crumbs">' + esc(r.name) + ' / ' + path.split('/').map(function (x) { return esc(x); }).join(' / ') + '</p>';
        if (!f) { html += '<p>File not found</p>'; return html; }
        html += '<p class="crumbs"><a href="' + base + '/blob/' + encodeURIComponent(branch) + '/' + path.split('/').map(encodeURIComponent).join('/') + '">' + esc(path.split('/').pop()) + '</a></p>';
        html += '<p class="muted">Branch ' + esc(branch) + '</p>';
        html += '<pre class="file-content">' + highlightContent(f.content, ui().searchQuery) + '</pre>';
        html += '<p><a href="' + base + '/commits/' + encodeURIComponent(branch) + '/' + path.split('/').map(encodeURIComponent).join('/') + '">Commits</a></p>';
        return html;
      },

      repoNewFile: function (r, role, branch) {
        if (!this.canWriteRepo(r, role)) return repoHead(r) + '<h1>Access denied</h1>';
        let html = repoHead(r);
        html += '<h2>Create new file</h2>' + errHtml('repofile');
        html += '<form data-action="file-create" data-branch="' + esc(branch) + '">' +
          '<label for="nf-name">File name</label><input id="nf-name" name="path" type="text">' +
          '<label for="nf-body">File contents</label><textarea id="nf-body" name="content"></textarea>' +
          '<label for="nf-msg">Commit message</label><input id="nf-msg" name="message" type="text">' +
          '<button type="submit">Commit changes</button></form>';
        return html;
      },

      forkForm: function (r, role) {
        const u = this.me();
        let html = repoHead(r);
        if (!u) { html += '<p><a href="#/login">Sign in</a></p>'; return html; }
        html += '<h2>Fork ' + esc(r.name) + '</h2>' + errHtml('fork');
        html += '<form data-action="fork-create" data-repo="' + esc(r.id) + '">' +
          ARC.combobox({ label: 'Owner', name: 'owner', options: [u.name], value: u.name }) +
          '<label for="fk-name">Repository name</label>' +
          '<input id="fk-name" name="name" type="text" value="' + esc(r.name) + '">' +
          '<label class="radio"><input type="radio" name="visibility" value="public"> Public</label>' +
          '<label class="radio"><input type="radio" name="visibility" value="private" checked> Private</label>' +
          '<button type="submit">Create fork</button></form>';
        return html;
      },

      repoCommits: function (r, branch, path) {
        const br = branch && this.branchOf(r.id, branch) ? branch : r.defaultBranch;
        let list = commitsOf(r.id, br);
        if (path) list = list.filter(function (c) { return (c.files || []).some(function (f) { return f.path === path; }); });
        let html = repoHead(r);
        html += '<h2>Commits</h2>';
        html += '<p class="muted">Branch ' + esc(br) + (path ? ' · ' + esc(path) : '') + '</p>';
        html += list.map(function (c) {
          return '<article class="commit-row"><h3><a href="' + repoHref(r) + '/commit/' + encodeURIComponent(c.id) + '">' + esc(c.message) + '</a></h3>' +
            '<p class="muted"><span class="commit-author">' + esc(c.author) + '</span> · <span class="commit-date">' + esc(c.date) + '</span></p></article>';
        }).join('') || '<p>No commits.</p>';
        return html;
      },

      repoCommitDetail: function (r, id) {
        const c = commitById(id);
        let html = repoHead(r);
        if (!c) { html += '<p>Commit not found</p>'; return html; }
        html += '<h2>' + esc(c.message) + '</h2>';
        html += '<p class="muted">' + esc(c.author) + ' · ' + esc(c.date) + '</p>';
        const adds = (c.files || []).reduce(function (n, f) { return n + (f.additions || 0); }, 0);
        const dels = (c.files || []).reduce(function (n, f) { return n + (f.deletions || 0); }, 0);
        html += '<h2>Changed files</h2>';
        html += '<p class="muted"><span class="add">+' + adds + '</span> <span class="del">-' + dels + '</span></p>';
        html += '<ul>' + (c.files || []).map(function (f) {
          return '<li><span class="path">' + esc(f.path) + '</span> <span class="add">+' + f.additions + '</span> <span class="del">-' + f.deletions + '</span></li>';
        }).join('') + '</ul>';
        return html;
      },

      repoSearch: function (r, q) {
        const branch = r.defaultBranch;
        let html = '<h1>' + esc(r.owner + '/' + r.name) + '</h1>';
        html += '<p class="repo-meta"><span class="marker">' + (r.visibility === 'public' ? 'Public' : 'Private') + '</span> ' +
          '<a href="' + repoHref(r) + '">' + esc(r.name) + '</a></p>';
        html += '<form class="repo-search" data-action="repo-search" data-repo="' + esc(r.id) + '">' +
          '<label for="repo-q">Search</label>' +
          '<input id="repo-q" name="q" type="search" aria-label="Search" placeholder="Search" value="' + esc(q) + '">' +
          '<button type="submit">Search</button></form>';
        html += '<nav class="search-nav"><a href="' + repoHref(r) + '/search/' + encodeURIComponent(q) + '">Code</a></nav>';
        const needle = String(q || '').toLowerCase();
        const matches = filesOf(r.id, branch).filter(function (f) { return needle && String(f.content).toLowerCase().indexOf(needle) >= 0; });
        if (!matches.length) {
          html += '<p class="msg">No results</p><p class="msg">No code results</p>';
        }
        html += matches.map(function (f) {
          const parts = f.path.split('/');
          const name = parts.pop();
          return '<article class="search-hit"><h3><a href="' + repoHref(r) + '/blob/' + encodeURIComponent(branch) + '/' + f.path.split('/').map(encodeURIComponent).join('/') + '">' + esc(name) + '</a></h3>' +
            '<p class="muted">' + esc(f.path) + '</p><pre class="snippet">' + highlightContent(f.content, q) + '</pre></article>';
        }).join('');
        return html;
      },

      /* ------------------------------ releases ------------------------------ */
      repoReleases: function (r, role, rest) {
        if (rest[0] === 'new') return this.releaseNew(r, role);
        if (rest[0]) {
          const rel = releaseByTag(r.id, rest[0]);
          let html = repoHead(r);
          if (!rel) { html += '<h1>Release not found</h1>'; return html; }
          html += '<h1>' + esc(rel.tag) + '</h1>';
          html += '<p class="release-title">' + esc(rel.title) + '</p>';
          html += '<p class="release-body">' + esc(rel.description || '') + '</p>';
          html += '<p class="release-target">Target branch: ' + esc(rel.target) + '</p>';
          return html;
        }
        let html = repoHead(r);
        html += '<h2>Releases</h2>';
        if (this.canWriteRepo(r, role)) html += '<p><a href="' + repoHref(r) + '/releases/new">New release</a></p>';
        html += releasesOf(r.id).map(function (rel) {
          return '<article class="release-row"><h3><a href="' + repoHref(r) + '/releases/' + encodeURIComponent(rel.tag) + '">' + esc(rel.tag) + '</a></h3>' +
            '<p class="muted">' + esc(rel.title) + ' · Target branch: ' + esc(rel.target) + '</p></article>';
        }).join('') || '<p>No releases.</p>';
        return html;
      },

      releaseNew: function (r, role) {
        if (!this.canWriteRepo(r, role)) return repoHead(r) + '<h1>Access denied</h1>';
        let html = repoHead(r);
        html += '<h2>New release</h2>' + errHtml('release');
        html += '<form data-action="release-create" data-repo="' + esc(r.id) + '">' +
          '<label for="rel-tag">Tag name</label><input id="rel-tag" name="tag" type="text">' +
          '<label for="rel-title">Release title</label><input id="rel-title" name="title" type="text">' +
          '<label for="rel-desc">Description</label><textarea id="rel-desc" name="description"></textarea>' +
          ARC.combobox({ label: 'Target branch', name: 'target', options: branches(r.id).map(function (b) { return b.name; }), value: r.defaultBranch }) +
          '<button type="submit">Publish release</button></form>';
        return html;
      },

      /* ------------------------------ issues ------------------------------ */
      repoIssues: function (r, role, rest) {
        if (rest[0] === 'new') return this.issueNew(r, role);
        if (rest[0] && rest[0] !== 'open' && rest[0] !== 'closed') {
          const iss = this.issueByNumber(r.id, rest[0]);
          if (!iss) return repoHead(r) + '<h1>Issue not found</h1>';
          return this.issueDetail(r, role, iss);
        }
        const status = rest[0] === 'closed' ? 'closed' : (rest[0] === 'open' ? 'open' : 'all');
        let html = repoHead(r);
        html += '<h2>Issues</h2>';
        html += '<nav class="issue-filters"><a href="' + repoHref(r) + '/issues/open">Open</a> <a href="' + repoHref(r) + '/issues/closed">Closed</a></nav>';
        html += '<label for="issue-q">Search issues</label>' +
          '<input id="issue-q" type="search" placeholder="Search issues" aria-label="Search issues" data-change="filter-issues">';
        if (this.canIssueWrite(role) && !r.archived) html += '<p><a href="' + repoHref(r) + '/issues/new">New issue</a></p>';
        const list = issuesOf(r.id).filter(function (i) {
          if (status === 'open') return i.status === 'open';
          if (status === 'closed') return i.status === 'closed';
          return true;
        });
        html += list.map(function (i) {
          return '<article class="issue-row" data-issue-row data-title="' + esc(i.title.toLowerCase()) + '">' +
            '<h3><a href="' + repoHref(r) + '/issues/' + i.number + '">' + esc(i.title) + '</a></h3>' +
            '<p class="muted">#' + i.number + ' · <span class="state">' + (i.status === 'open' ? 'Open' : 'Closed') + '</span> · ' + esc(i.author) + '</p>' +
            '<p class="muted">' + (i.labels || []).map(function (l) { return '<span class="label">' + esc(l) + '</span>'; }).join(' ') + '</p>' +
            '</article>';
        }).join('') || '<p>No issues.</p>';
        return html;
      },

      issueNew: function (r, role) {
        if (!this.canIssueWrite(role) || r.archived) return repoHead(r) + '<h1>Access denied</h1>';
        return repoHead(r) + '<h2>New issue</h2>' + errHtml('newissue') +
          '<form data-action="issue-create" data-repo="' + esc(r.id) + '">' +
          '<label for="ni-title">Title</label><input id="ni-title" name="title" type="text">' +
          '<label for="ni-desc">Description</label><textarea id="ni-desc" name="description"></textarea>' +
          '<button type="submit">Submit new issue</button></form>';
      },

      issueDetail: function (r, role, iss) {
        const u = this.me();
        const canEdit = canIssueWrite(role);
        const canManage = canIssueManage(role);
        const plusOnes = reactionsOf(iss.id).filter(function (x) { return x.type === '+1'; });
        const mine = !!u && plusOnes.some(function (x) { return x.user === u.name; });
        let html = repoHead(r);
        html += '<h1>' + esc(iss.title) + '</h1>';
        html += '<p><span class="state">' + (iss.status === 'open' ? 'Open' : 'Closed') + '</span></p>';
        html += '<div class="reactions">';
        html += '<span class="reaction-type">+1</span> <span class="reaction-count">' + plusOnes.length + ' reaction' + (plusOnes.length === 1 ? '' : 's') + '</span>';
        if (u) {
          if (mine) html += ' <button type="button" data-action="reaction-remove" data-issue="' + esc(iss.id) + '" data-reaction="+1">Remove +1 reaction</button>';
          else html += ' <button type="button" data-action="reaction-open" data-issue="' + esc(iss.id) + '">Add reaction</button>';
        }
        html += '</div>';
        html += '<div class="issue-meta">';
        if (canManage) {
          html += '<button type="button" data-action="assignees-open" data-issue="' + esc(iss.id) + '">Assignees</button> ';
          html += '<button type="button" data-action="labels-open" data-issue="' + esc(iss.id) + '">Labels</button> ';
          html += '<button type="button" data-action="milestone-open" data-issue="' + esc(iss.id) + '">Milestone</button> ';
        }
        html += '<span class="chips">' + (iss.assignees || []).map(function (a) { return '<span class="chip">' + esc(a) + '</span>'; }).join('') + '</span>';
        html += '<span class="chips">' + (iss.labels || []).map(function (l) { return '<span class="label">' + esc(l) + '</span>'; }).join('') + '</span>';
        if (iss.milestone) html += '<span class="chip">' + esc(iss.milestone) + '</span>';
        html += '</div>';
        if (canEdit) {
          html += errHtml('edittitle');
          if (ui().editTitle) {
            html += '<form data-action="issue-title-save" data-issue="' + esc(iss.id) + '">' +
              '<label for="et-title">Issue title</label><input id="et-title" name="title" type="text" value="' + esc(iss.title) + '">' +
              '<button type="submit">Save issue title</button></form>';
          } else {
            html += '<button type="button" data-action="issue-title-open">Edit issue title</button> ';
          }
          html += errHtml('editdesc');
          if (ui().editDesc) {
            html += '<form data-action="issue-desc-save" data-issue="' + esc(iss.id) + '">' +
              '<label for="ed-desc">Issue description</label><textarea id="ed-desc" name="description">' + esc(iss.description) + '</textarea>' +
              '<button type="submit">Save issue description</button></form>';
          } else {
            html += '<button type="button" data-action="issue-desc-open">Edit issue description</button>';
          }
        }
        html += '<p class="description">' + esc(iss.description) + '</p>';
        if (canManage) {
          if (iss.status === 'open') html += '<button type="button" data-action="issue-close" data-issue="' + esc(iss.id) + '">Close issue</button>';
          else html += '<button type="button" data-action="issue-reopen" data-issue="' + esc(iss.id) + '">Reopen issue</button>';
        }
        html += '<h2>Comments</h2>';
        html += commentsOf(iss.id).map(function (c) {
          return '<article class="comment"><p>' + esc(c.body) + '</p><p class="muted">' + esc(c.author) + ' · ' + esc(c.created) + '</p></article>';
        }).join('');
        html += '<article class="comment"><p>Activity: this issue was created for ' + esc(r.name) + '.</p></article>';
        if (canEdit) {
          html += errHtml('comment');
          html += '<form data-action="issue-comment" data-issue="' + esc(iss.id) + '">' +
            '<label for="ic-body">Comment</label><textarea id="ic-body" name="body"></textarea>' +
            '<button type="submit">Comment</button></form>';
        }
        return html;
      },

      /* ------------------------------ pull requests ------------------------------ */
      repoPulls: function (r, role, rest) {
        if (rest[0] === 'new') return this.prCompare(r, role);
        if (rest[0] && rest[0] !== 'open' && rest[0] !== 'closed') {
          const pr = this.prByNumber(r.id, rest[0]);
          if (!pr) return repoHead(r) + '<h1>Pull request not found</h1>';
          const tab = rest[1] || 'conversation';
          return this.prDetail(r, role, pr, tab);
        }
        const status = rest[0] === 'closed' ? 'closed' : 'open';
        let html = repoHead(r);
        html += '<h2>Pull requests</h2>';
        html += '<nav class="pr-filters"><a href="' + repoHref(r) + '/pulls/open">Open</a> <a href="' + repoHref(r) + '/pulls/closed">Closed</a></nav>';
        if (this.can(role, 'write') && !r.archived) html += '<p><a href="' + repoHref(r) + '/pulls/new">New pull request</a></p>';
        const list = prsOf(r.id).filter(function (p) {
          if (status === 'closed') return p.status === 'closed' || p.status === 'merged';
          return p.status === 'open' || p.status === 'draft';
        });
        html += list.map(function (p) {
          return '<article class="pr-row"><h3><a href="' + repoHref(r) + '/pulls/' + p.number + '">' + esc(p.title) + '</a></h3>' +
            '<p class="muted">#' + p.number + ' · ' + esc(p.author) + ' · ' + esc(p.source) + ' → ' + esc(p.target) + ' · <span class="state">' + esc(statusLabel(p.status)) + '</span></p></article>';
        }).join('') || '<p>No pull requests.</p>';
        return html;
      },

      prCompare: function (r, role) {
        if (!this.can(role, 'write') || r.archived) return repoHead(r) + '<h1>Access denied</h1>';
        const names = branches(r.id).map(function (b) { return b.name; });
        const d = ui().compare || {};
        const base = d.base || r.defaultBranch;
        const compare = d.compare || (names.filter(function (n) { return n !== base; })[0] || base);
        let html = repoHead(r);
        html += '<h2>Compare changes</h2>';
        html += '<form data-action="compare" data-repo="' + esc(r.id) + '">' +
          ARC.combobox({ label: 'Base', name: 'base', options: names, value: base, change: 'compare-pick' }) +
          ARC.combobox({ label: 'Compare', name: 'compare', options: names, value: compare, change: 'compare-pick' }) +
          '<button type="submit">Compare changes</button></form>';
        if (d.done) {
          if (base === compare) {
            html += '<p class="msg">No differences between these branches.</p>';
            html += '<form data-action="pr-create" data-repo="' + esc(r.id) + '" data-base="' + esc(base) + '" data-compare="' + esc(compare) + '">' +
              '<label for="pr-title">Title</label><input id="pr-title" name="title" type="text">' +
              '<label for="pr-desc">Description</label><textarea id="pr-desc" name="description"></textarea>' +
              '<button type="submit" disabled>Create pull request</button> ' +
              '<button type="button" disabled data-action="pr-draft">Create draft pull request</button></form>';
          } else {
            const changed = (commitById((branchOf(r.id, compare) || {}).head) || {}).files || [{ path: 'src/search.ts', additions: 12, deletions: 3 }];
            html += '<h3>Changed files</h3><ul>' + changed.map(function (f) {
              return '<li><span class="path">' + esc(f.path) + '</span> <span class="add">+' + f.additions + '</span> <span class="del">-' + f.deletions + '</span></li>';
            }).join('') + '</ul>';
            html += '<p class="muted">Commit ' + esc((branchOf(r.id, compare) || {}).head || 'head') + '</p>';
            html += errHtml('prnew');
            html += '<form data-action="pr-create" data-repo="' + esc(r.id) + '" data-base="' + esc(base) + '" data-compare="' + esc(compare) + '">' +
              '<label for="pr-title">Title</label><input id="pr-title" name="title" type="text">' +
              '<label for="pr-desc">Description</label><textarea id="pr-desc" name="description"></textarea>' +
              '<button type="submit">Create pull request</button> ' +
              '<button type="button" data-action="pr-draft">Create draft pull request</button></form>';
          }
        }
        return html;
      },

      prDetail: function (r, role, pr, tab) {
        const u = this.me();
        const base = repoHref(r);
        let html = repoHead(r);
        html += '<h1>' + esc(pr.title) + '</h1>';
        html += '<p><span class="state">' + esc(statusLabel(pr.status)) + '</span> ' +
          '<span class="branch">' + esc(pr.source) + '</span> → <span class="branch">' + esc(pr.target) + '</span> ' +
          '<span class="muted">' + esc(pr.author) + ' wants to merge ' + esc(pr.source) + ' into ' + esc(pr.target) + '</span></p>';
        html += '<nav class="pr-nav"><a href="' + base + '/pulls/' + pr.number + '">Conversation</a> ' +
          '<a href="' + base + '/pulls/' + pr.number + '/commits">Commits</a> ' +
          '<a href="' + base + '/pulls/' + pr.number + '/files">Files changed</a> ' +
          '<a href="' + base + '/pulls/' + pr.number + '/checks">Checks</a></nav>';
        html += errHtml('pr');

        if (tab === 'commits') {
          html += '<h2>Commits</h2>';
          html += (pr.commits || []).map(function (c) {
            return '<article class="commit-row"><h3><span class="commit-message">' + esc(c.message) + '</span></h3>' +
              '<p class="muted"><span class="commit-sha">' + esc(c.sha) + '</span> · ' +
              '<span class="commit-author">' + esc(c.author) + '</span> · ' +
              '<span class="commit-date">' + esc(c.date) + '</span></p>' +
              '<ul class="commit-files">' + (pr.changedFiles || []).map(function (f) {
                return '<li><span class="path">' + esc(f.path) + '</span> <span class="add">+' + f.additions + '</span> <span class="del">-' + f.deletions + '</span></li>';
              }).join('') + '</ul></article>';
          }).join('') || '<p>No commits.</p>';
          return html;
        }
        if (tab === 'files') {
          html += '<h2>Files changed</h2>';
          const adds = (pr.changedFiles || []).reduce(function (n, f) { return n + f.additions; }, 0);
          const dels = (pr.changedFiles || []).reduce(function (n, f) { return n + f.deletions; }, 0);
          html += '<p class="summary"><strong>Changed files</strong> <span class="add">+' + adds + '</span> <span class="del">-' + dels + '</span></p>';
          html += '<ul>' + (pr.changedFiles || []).map(function (f) {
            return '<li><span class="path">' + esc(f.path) + '</span> <span class="add">+' + f.additions + '</span> <span class="del">-' + f.deletions + '</span></li>';
          }).join('') + '</ul>';
          if (u && this.can(role, 'write') && pr.author !== u.name) {
            html += '<button type="button" data-action="pr-comment-open" data-pr="' + esc(pr.id) + '">Add comment</button>';
            if (ui().prCommentOpen === pr.id) {
              html += '<form data-action="pr-comment-single" data-pr="' + esc(pr.id) + '">' +
                '<label for="pc-body">Comment</label><textarea id="pc-body" name="body"></textarea>' +
                '<button type="submit">Add single comment</button> ' +
                '<button type="button" data-action="pr-comment-start">Start a review</button></form>';
            }
            html += '<p><button type="button" data-action="pr-review-open" data-pr="' + esc(pr.id) + '">Review changes</button></p>';
            if (ui().prReviewOpen === pr.id) {
              html += '<form data-action="pr-review-submit" data-pr="' + esc(pr.id) + '">' +
                '<label class="radio"><input type="radio" name="decision" value="approve"> Approve</label>' +
                '<label class="radio"><input type="radio" name="decision" value="changes_requested"> Request changes</label>' +
                '<label for="pr-summary">Summary</label><textarea id="pr-summary" name="summary"></textarea>' +
                '<button type="submit">Submit review</button></form>';
            }
          }
          html += '<h2>Comments</h2>';
          html += (pr.comments || []).map(function (c) {
            return '<article class="comment"><p>' + esc(c.body) + '</p><p class="muted">' + esc(c.author) + (c.outdated ? ' · Outdated' : '') + '</p></article>';
          }).join('') || '<p>No comments.</p>';
          html += this.reviewSummary(pr);
          return html;
        }
        if (tab === 'checks') {
          html += '<h2>Checks</h2>' + this.checksBlock(r, pr, role);
          return html;
        }

        // conversation
        html += '<p class="description">' + esc(pr.description || '') + '</p>';
        html += this.checksBlock(r, pr, role);
        const el = this.prEligibility(r, pr);
        if (u && this.can(role, 'maintain')) {
          html += '<div class="merge-method"><label class="radio"><input type="radio" name="mergeMethod" value="merge" checked> Create a merge commit</label></div>';
          html += '<p><button type="button" data-action="pr-merge" data-pr="' + esc(pr.id) + '"' + (el.ok ? '' : ' disabled') + '>Merge pull request</button></p>';
          if (!el.ok) html += '<p class="msg error">' + esc(el.reasons[0]) + '</p>';
          if (ui().mergeConfirm === pr.id) {
            html += '<div class="confirm"><p>Confirm merge with a merge commit.</p>' +
              '<button type="button" data-action="pr-merge-confirm" data-pr="' + esc(pr.id) + '">Confirm merge</button> ' +
              '<button type="button" data-action="pr-merge-cancel">Cancel</button></div>';
          }
        }
        if (u && !this.can(role, 'maintain') && pr.status === 'draft') {
          html += '<p><button type="button" disabled>Merge pull request</button></p>';
        }
        const isAuthor = u && pr.author === u.name;
        const mayClose = u && (isAuthor || this.can(role, 'maintain'));
        if (mayClose && pr.status !== 'merged') {
          if (pr.status === 'closed') html += '<p><button type="button" data-action="pr-reopen" data-pr="' + esc(pr.id) + '">Reopen pull request</button></p>';
          else html += '<p><button type="button" data-action="pr-close" data-pr="' + esc(pr.id) + '">Close pull request</button></p>';
        }
        if (isAuthor && pr.status === 'draft') {
          html += '<p><button type="button" data-action="pr-ready" data-pr="' + esc(pr.id) + '">Ready for review</button></p>';
        }
        if (u && (isAuthor || this.can(role, 'maintain'))) {
          html += '<p><button type="button" data-action="reviewers-open" data-pr="' + esc(pr.id) + '" data-repo="' + esc(r.id) + '">Reviewers</button></p>';
          html += '<p class="chips">' + (pr.reviewers || []).map(function (rv) {
            return '<span class="chip"><span>' + esc(rv) + '</span> <button type="button" data-action="reviewer-remove" data-pr="' + esc(pr.id) + '" data-user="' + esc(rv) + '">Remove ' + esc(rv) + '</button></span>';
          }).join('') + '</p>';
        }
        html += this.reviewSummary(pr);
        if (pr.merged) {
          html += '<p class="merginfo">Merged by ' + esc(pr.mergedBy) + ' · ' + esc(pr.mergedAt) + ' · commit ' + esc(pr.mergedCommit || '') + '</p>';
        }
        return html;
      },

      checksBlock: function (r, pr, role) {
        const list = checksOf(r.id, pr.number);
        const admin = this.can(role, 'admin');
        let html = '<h3>Checks</h3>';
        html += list.map(function (c) {
          return '<article class="check-row"><span class="check-name">' + esc(c.name) + '</span> <span class="state">' + esc(c.status) + '</span>' +
            (c.actor ? ' <span class="muted">' + esc(c.actor) + '</span>' : '') + '</article>';
        }).join('') || '<p>No checks.</p>';
        if (admin) {
          html += list.map(function (c) {
            return '<form data-action="check-save" data-repo="' + esc(r.id) + '" data-pr="' + esc(pr.number) + '" data-check="' + esc(c.id) + '">' +
              ARC.combobox({ label: 'test', name: 'test', options: ['pending', 'success', 'failure'], value: c.status, change: 'check-change' }) +
              '<button type="submit">Save</button></form>';
          }).join('');
        }
        return html;
      },

      /* ------------------------------ repository settings ------------------------------ */
      repoSettings: function (r, role, rest) {
        const u = this.me();
        const section = rest[0] || 'general';
        let html = repoHead(r);
        if (!u) { html += '<p><a href="#/login">Sign in</a></p>'; return html; }
        html += '<nav class="settings-nav"><a href="' + repoHref(r) + '/settings">General</a> ' +
          '<a href="' + repoHref(r) + '/settings/branches">Branches</a> ' +
          '<a href="' + repoHref(r) + '/settings/access">Manage access</a></nav>';

        if (section === 'general') {
          html += '<h2>General</h2>';
          html += '<p>Visibility: ' + (r.visibility === 'public' ? 'Public' : 'Private') + '</p>';
          html += '<p>Status: ' + (r.archived ? 'Archived' : 'Active') + '</p>';
          if (this.can(role, 'admin')) {
            html += '<p><button type="button" data-action="visibility-open" data-repo="' + esc(r.id) + '">Change visibility</button></p>';
            if (r.archived) {
              html += '<p><button type="button" data-action="restore-open" data-repo="' + esc(r.id) + '">Restore repository</button></p>';
            } else {
              html += '<p><button type="button" data-action="archive-open" data-repo="' + esc(r.id) + '">Archive repository</button></p>';
            }
          }
          return html;
        }

        if (section === 'branches') {
          html += '<h2>Branches</h2>';
          if (this.can(role, 'admin')) {
            html += '<h3>Default branch</h3>' + errHtml('branches');
            html += '<form data-action="default-branch-save" data-repo="' + esc(r.id) + '">' +
              ARC.combobox({ label: 'Default branch', name: 'defaultBranch', options: branches(r.id).map(function (b) { return b.name; }), value: r.defaultBranch }) +
              '<button type="submit">Update</button></form>';
            if (ui().branchConfirm === r.id) {
              html += '<div class="confirm"><p>Update the default branch to ' + esc(ui().branchConfirmTo) + '?</p>' +
                '<button type="button" data-action="default-branch-confirm" data-repo="' + esc(r.id) + '">Confirm</button> ' +
                '<button type="button" data-action="default-branch-cancel">Cancel</button></div>';
            }
            html += '<h3>Branch protection rules</h3>';
            html += protectionsOf(r.id).map(function (p) {
              return '<article class="protection-row"><strong>' + esc(p.pattern) + '</strong> ' +
                (p.requireApprovals ? '<span>' + p.requireApprovals + ' approval</span> ' : '') +
                (p.requireStatus ? '<span>Require status check ' + esc(p.requireStatus) + '</span>' : '') + '</article>';
            }).join('');
            if (ui().protectForm) {
              html += '<form data-action="protect-create" data-repo="' + esc(r.id) + '">' +
                '<label for="bp-pattern">Branch name pattern</label><input id="bp-pattern" name="pattern" type="text">' +
                '<label class="check"><input type="checkbox" name="approvals"> Require 1 approval</label>' +
                '<label class="check"><input type="checkbox" name="status"> Require status check test</label>' +
                '<button type="submit">Create</button></form>';
            } else {
              html += '<button type="button" data-action="protect-open">Add branch protection rule</button>';
            }
          } else {
            html += '<p>You do not have permission to change branch settings.</p>';
          }
          return html;
        }

        if (section === 'access') {
          html += '<h2>Manage access</h2>';
          html += errHtml('access');
          if (this.can(role, 'admin')) {
            html += '<button type="button" data-action="access-open" data-repo="' + esc(r.id) + '">Add people or teams</button>';
          }
          const gs = (S().grants || []).filter(function (g) { return g.repo === r.id; });
          html += '<table class="access-table"><thead><tr><th>Name</th><th>Role</th><th>Action</th></tr></thead><tbody>';
          html += gs.map(function (g) {
            const name = g.subjectType === 'team' ? ((teamById(g.subject) || {}).name || g.subject) : g.subject;
            let row = '<tr data-access="' + esc(name) + '">' +
              '<td class="access-name">' + esc(name) + '</td>' +
              '<td class="role">' + esc(cap(g.role)) + '</td>' +
              '<td>';
            if (this.can(role, 'admin')) {
              row += '<form data-action="access-save" data-grant="' + esc(g.id) + '">' +
                ARC.combobox({ label: 'Role', name: 'role', options: ['Read', 'Triage', 'Write', 'Maintain', 'Admin'], value: cap(g.role) }) +
                '<button type="submit">Save</button></form>';
            }
            row += '</td></tr>';
            return row;
          }.bind(this)).join('');
          html += '</tbody></table>';
          if (!gs.length) html += '<p>No direct access.</p>';
          return html;
        }
        return html;
      }
    },

    actions: {
      /* ------------------------------ auth ------------------------------ */
      'signin': function (ctx) {
        const form = ctx.form || {};
        const u = findAccount(form.login);
        if (!u || u.password !== form.password) {
          ui().draft = { login: form.login || '' };
          setErrs('login', ['Invalid credentials']);
          ARC.render();
          return;
        }
        const sid = uid('sess');
        if (!Array.isArray(S().sessions)) S().sessions = [];
        S().sessions.push({ id: sid, user: u.id, device: deviceLabel(), lastActive: 'just now', active: true });
        S().session = { user: u.id, sid: sid };
        ui().err = null; ui().ok = null; ui().draft = {};
        save();
        ARC.navigate('#/');
      },
      'signup': function (ctx) {
        const form = ctx.form || {};
        const errs = [];
        const uname = String(form.username || '').trim();
        const email = String(form.email || '').trim();
        if (!validUsername(uname)) {
          if (byName(uname)) errs.push('Username already exists');
          else errs.push('Username format is invalid');
        } else if (byName(uname)) {
          errs.push('Username already exists');
        }
        if (!validEmail(email)) {
          errs.push('Email format is invalid');
        }
        if (!validPassword(form.password)) errs.push('Password requirements are not satisfied');
        if (form.password !== form.confirm) errs.push('Password requirements are not satisfied');
        if (!form.terms) errs.push('Agree to terms is required');
        if (errs.length) {
          ui().draft = { username: uname, email: email };
          setErrs('signup', dedupe(errs));
          ARC.render();
          return;
        }
        S().users.push({ id: uid('u'), name: uname, email: email, password: form.password });
        ui().draft = {}; ui().err = null;
        save();
        ARC.navigate('#/login');
      },
      'forgot-send': function (ctx) {
        ui().forgotEmail = (ctx.form || {}).email || '';
        ui().err = null;
        save();
        ARC.navigate('#/forgot/reset');
      },
      'forgot-reset': function (ctx) {
        const f = ctx.form || {};
        const target = byLogin(f.email);
        if (f.code !== '123456') {
          setErrs('forgot', ['Verification code is invalid']);
          ARC.render();
          return;
        }
        if (!validPassword(f.newPassword) || f.newPassword !== f.confirm) {
          setErrs('forgot', ['Password requirements are not satisfied']);
          ARC.render();
          return;
        }
        if (target) target.password = f.newPassword;
        ui().err = null;
        setOk('forgot', 'Password updated');
        save();
        ARC.render();
      },
      'account-menu': function (ctx) {
        const u = me();
        if (!u) return;
        const mine = orgs().filter(function (o) { return memberRole(o.name, u.name) !== null; });
        const html = '<div role="menu" aria-label="Account menu">' +
          '<a href="#/orgs">Your organizations</a>' +
          mine.map(function (o) { return '<a href="#/org/' + esc(o.name) + '">' + esc(o.display) + '</a>'; }).join('') +
          '<a href="#/settings">Settings</a>' +
          '<a href="#/" data-action="signout-start">Sign out</a>' +
          '</div>';
        ARC.openPopover(ctx.el, html);
      },
      'signout-start': function () {
        ARC.openDialog('<p>Signing out ends only this browser session.</p>' +
          '<button type="button" data-action="signout-confirm">Confirm sign out</button> ' +
          '<button type="button" data-action="arc:close">Cancel</button>', { title: 'Sign out' });
      },
      'signout-confirm': function () {
        const sid = currentSessionId();
        const rec = sid ? (S().sessions || []).find(function (x) { return x.id === sid; }) : null;
        if (rec) rec.active = false;
        S().session = null;
        ui().err = null; ui().ok = null;
        save();
        ARC.closeDialog();
        ARC.navigate('#/');
      },
      'password-update': function (ctx) {
        const u = me();
        if (!u) return;
        const f = ctx.form || {};
        if (!f.current) { setErrs('password', ['Current password is required']); ARC.render(); return; }
        if (u.password !== f.current) { setErrs('password', ['Current password is incorrect']); ARC.render(); return; }
        if (f.next !== f.confirm) { setErrs('password', ['Password confirmation does not match']); ARC.render(); return; }
        if (!validPassword(f.next)) { setErrs('password', ['Password requirements are not satisfied']); ARC.render(); return; }
        u.password = f.next;
        ui().err = null;
        setOk('password', 'Password updated');
        save();
        ARC.render();
      },
      'session-revoke': function (ctx) {
        const rec = (S().sessions || []).find(function (x) { return x.id === ctx.el.dataset.session; });
        if (rec) rec.active = false;
        save();
        ARC.render();
      },

      /* ------------------------------ organizations ------------------------------ */
      'org-create': function (ctx) {
        const u = me();
        if (!u) return;
        const f = ctx.form || {};
        const name = String(f.name || '').trim().toLowerCase();
        const display = String(f.display || '').trim();
        const errs = [];
        if (orgByName(name)) errs.push('Organization name already exists');
        else if (!validUsername(name)) errs.push('Organization name format is invalid');
        if (!display) errs.push('Display name is required');
        if (errs.length) {
          ui().draft = { orgName: String(f.name || '').trim(), orgDisplay: display };
          setErrs('orgnew', errs);
          ARC.render();
          return;
        }
        S().orgs.push({ id: uid('org'), name: name, display: display, description: '' });
        S().orgMembers.push({ org: name, user: u.name, role: 'owner' });
        ui().draft = {}; ui().err = null;
        save();
        ARC.navigate('#/org/' + encodeURIComponent(name));
      },
      'people-add-open': function () { ui().peopleForm = true; save(); ARC.render(); },
      'people-add-close': function () { ui().peopleForm = false; save(); ARC.render(); },
      'people-add': function (ctx) {
        const p = ARC.route().params;
        const orgName = p[0];
        const f = ctx.form || {};
        const login = String(f.login || '').trim();
        const target = byLogin(login);
        if (!target) { setErrs('people', ['Account not found']); ARC.render(); return; }
        if (memberRole(orgName, target.name)) { setErrs('people', ['Account is already a member']); ARC.render(); return; }
        S().orgMembers.push({ org: orgName, user: target.name, role: (f.role === 'Owner' ? 'owner' : 'member') });
        ui().err = null; ui().peopleForm = false;
        save();
        ARC.render();
      },
      'people-menu': function (ctx) {
        const user = ctx.el.dataset.user;
        ARC.openPopover(ctx.el, [{
          label: 'Remove from organization',
          action: 'people-remove-start',
          extra: 'data-user="' + esc(user) + '"'
        }], { kind: 'menu' });
      },
      'people-remove-start': function (ctx) {
        const user = ctx.el.dataset.user || ctx.id;
        ARC.openDialog('<p>Remove ' + esc(user) + ' from this organization?</p>' +
          '<button type="button" data-action="people-remove" data-user="' + esc(user) + '">Remove</button> ' +
          '<button type="button" data-action="arc:close">Cancel</button>', { title: 'Remove member' });
      },
      'people-remove': function (ctx) {
        const orgName = ARC.route().params[0];
        const user = ctx.el.dataset.user;
        const remainingOwners = orgMembers(orgName).filter(function (m) {
          return m.role === 'owner' && m.user !== user;
        });
        const targetIsOwner = memberRole(orgName, user) === 'owner';
        if (targetIsOwner && remainingOwners.length === 0) {
          setErrs('people', ['Organization must keep at least one owner']);
          ARC.closeDialog();
          ARC.render();
          return;
        }
        const idx = (S().orgMembers || []).findIndex(function (m) { return m.org === orgName && m.user === user; });
        if (idx >= 0) S().orgMembers.splice(idx, 1);
        for (const t of allTeams()) {
          if (t.org !== orgName) continue;
          t.members = (t.members || []).filter(function (m) { return m !== user; });
        }
        S().grants = (S().grants || []).filter(function (g) {
          if (g.subjectType !== 'user' || g.subject !== user) return true;
          const r = repoById(g.repo);
          return !(r && r.owner === orgName);
        });
        save();
        ARC.closeDialog();
        ARC.render();
      },
      'audit-filter': function (ctx) {
        ui().auditFilter = ctx.value;
        save();
        ARC.render();
      },

      'team-create': function (ctx) {
        const orgName = ARC.route().params[0];
        const f = ctx.form || {};
        const name = String(f.name || '').trim();
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 50) {
          setErrs('teamnew', ['Team name is invalid']);
          ARC.render();
          return;
        }
        if (teamByName(orgName, name)) { setErrs('teamnew', ['Team name is invalid']); ARC.render(); return; }
        S().teams.push({ id: uid('team'), org: orgName, name: name, parent: null, members: [] });
        ui().err = null;
        save();
        ARC.navigate('#/org/' + encodeURIComponent(orgName) + '/teams/' + encodeURIComponent(name));
      },
      'team-add-open': function () { ui().teamAdd = true; save(); ARC.render(); },
      'team-add-close': function () { ui().teamAdd = false; save(); ARC.render(); },
      'team-member-add': function (ctx) {
        const team = teamById(ctx.el.dataset.team);
        const orgName = ARC.route().params[0];
        const login = String((ctx.form || {}).login || '').trim();
        const target = byLogin(login);
        if (!target || memberRole(orgName, target.name) === null) {
          setErrs('teammembers', ['Account not found']);
          ARC.render();
          return;
        }
        team.members = team.members || [];
        if (team.members.indexOf(target.name) < 0) team.members.push(target.name);
        ui().err = null; ui().teamAdd = false;
        save();
        ARC.render();
      },
      'team-member-remove': function (ctx) {
        const team = teamById(ctx.el.dataset.team);
        const user = ctx.el.dataset.user;
        team.members = (team.members || []).filter(function (m) { return m !== user; });
        save();
        ARC.render();
      },
      'team-parent': function (ctx) {
        const orgName = ARC.route().params[0];
        const teamName = ARC.route().params[2];
        const t = teamByName(orgName, teamName);
        const parentName = (ctx.form || {}).parent || '';
        const parent = parentName ? teamByName(orgName, parentName) : null;
        let cur = parent;
        let cyclic = false;
        while (cur) {
          if (cur.id === t.id) { cyclic = true; break; }
          cur = cur.parent ? teamById(cur.parent) : null;
        }
        if (cyclic) {
          setErrs('teamsettings', ['Cyclic team hierarchy is not allowed']);
          ARC.render();
          return;
        }
        t.parent = parent ? parent.id : null;
        ui().err = null;
        save();
        ARC.render();
      },

      /* ------------------------------ repository creation ------------------------------ */
      'repo-create': function (ctx) {
        const u = me();
        if (!u) return;
        const f = ctx.form || {};
        const name = String(f.name || '').trim();
        const owner = f.owner || u.name;
        ui().draft = { owner: owner, name: name, description: f.description || '' };
        if (!name) { setErrs('newrepo', ['Repository name is required']); ARC.render(); return; }
        const existing = repos().find(function (r) { return r.owner === owner && r.name === name; });
        if (existing) { setErrs('newrepo', ['Repository name already exists']); ARC.render(); return; }
        const ownerType = orgByName(owner) ? 'org' : 'user';
        const id = uid('repo');
        const visibility = f.visibility === 'public' ? 'public' : 'private';
        S().repos.push({
          id: id, owner: owner, ownerType: ownerType, name: name, visibility: visibility,
          description: f.description || '', defaultBranch: 'main', forkOf: null, archived: false
        });
        S().branches.push({ id: id + ':main', repo: id, name: 'main', head: 'c-' + id });
        if (f.readme) {
          S().files.push({ id: id + ':main:README.md', repo: id, branch: 'main', path: 'README.md', content: '# ' + name });
          S().commits.push({
            id: 'c-' + id, repo: id, branch: 'main', message: 'Initial commit', author: u.name,
            date: 'just now', files: [{ path: 'README.md', additions: 1, deletions: 0 }]
          });
        }
        ui().draft = {}; ui().err = null;
        save();
        ARC.navigate('#/repo/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name));
      },
      'fork-create': function (ctx) {
        const u = me();
        if (!u) return;
        const src = repoById(ctx.el.dataset.repo);
        const f = ctx.form || {};
        const name = String(f.name || '').trim();
        const owner = f.owner || u.name;
        if (!name) { setErrs('fork', ['Repository name is required']); ARC.render(); return; }
        if (repos().some(function (r) { return r.owner === owner && r.name === name; })) {
          setErrs('fork', ['Repository name already exists']);
          ARC.render();
          return;
        }
        const id = uid('repo');
        const visibility = src.visibility === 'private' ? 'private' : (f.visibility === 'public' ? 'public' : 'private');
        S().repos.push({
          id: id, owner: owner, ownerType: orgByName(owner) ? 'org' : 'user', name: name,
          visibility: visibility, description: src.description, defaultBranch: 'main', forkOf: src.id, archived: false
        });
        S().branches.push({ id: id + ':main', repo: id, name: 'main', head: (branchOf(src.id, 'main') || {}).head });
        for (const fl of filesOf(src.id, 'main')) {
          S().files.push({ id: id + ':main:' + fl.path, repo: id, branch: 'main', path: fl.path, content: fl.content });
        }
        for (const c of commitsOf(src.id, 'main')) {
          S().commits.push({ id: id + ':' + c.id, repo: id, branch: 'main', message: c.message, author: c.author, date: c.date, files: c.files });
        }
        ui().err = null;
        save();
        ARC.navigate('#/repo/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name));
      },

      /* ------------------------------ repository browsing ------------------------------ */
      'global-search': function (ctx) {
        const q = String((ctx.form || {}).q || '').trim();
        ARC.navigate('#/search/' + encodeURIComponent(q));
      },
      'repo-search': function (ctx) {
        const r = repoById(ctx.el.dataset.repo) || currentRepo();
        const q = String((ctx.form || {}).q || '').trim();
        ui().searchQuery = q;
        save();
        ARC.navigate(repoHref(r) + '/search/' + encodeURIComponent(q));
      },
      'fork-start': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        if (!r) return;
        ARC.navigate(repoHref(r) + '/fork');
      },
      'filter-org-repos': function (ctx) {
        const q = String(ctx.el.value || '').trim().toLowerCase();
        const rows = document.querySelectorAll('#app [data-repo-row]');
        for (const row of rows) {
          const name = (row.getAttribute('data-name') || '').toLowerCase();
          row.hidden = !!q && name.indexOf(q) < 0;
        }
      },
      'org-visibility': function (ctx) {
        ui().orgVis = ctx.value;
        save();
        ARC.render();
      },
      'filter-issues': function (ctx) {
        const q = String(ctx.el.value || '').trim().toLowerCase();
        const rows = document.querySelectorAll('#app [data-issue-row]');
        for (const row of rows) {
          const title = (row.getAttribute('data-title') || '');
          row.hidden = !!q && title.indexOf(q) < 0;
        }
      },
      'branch-menu': function (ctx) {
        const repoId = ctx.el.dataset.repo;
        const role = repoRole(repoById(repoId), me());
        const names = branches(repoId).map(function (b) { return b.name; });
        const opts = names.map(function (n) {
          return '<div role="option" tabindex="-1" data-action="branch-pick" data-branch="' + esc(n) + '">' + esc(n) + '</div>';
        }).join('');
        const html = '<label for="find-branch">Find branch</label>' +
          '<input id="find-branch" type="text" placeholder="Find branch" data-change="branch-filter" data-repo="' + esc(repoId) + '" data-cancreate="' + (canWriteRepo(repoById(repoId), role) ? '1' : '') + '">' +
          '<div class="listbox" role="listbox" aria-label="Branches">' + opts +
          '<div role="option" tabindex="-1" data-create hidden></div></div>' +
          '<p class="msg" data-nomatch hidden>No matching branch</p>' +
          '<p class="msg error" data-invalid hidden>Invalid branch</p>';
        ARC.openPopover(ctx.el, html);
      },
      'branch-filter': function (ctx) {
        const el = ctx.el;
        const repoId = el.dataset.repo;
        const q = String(el.value || '').trim();
        const wrap = el.closest('[data-popover]');
        if (!wrap) return;
        const opts = wrap.querySelectorAll('[role="option"][data-branch]');
        let visible = 0;
        for (const o of opts) {
          const match = !q || o.dataset.branch.toLowerCase().indexOf(q.toLowerCase()) >= 0;
          o.hidden = !match;
          if (match) visible++;
        }
        const valid = validBranchName(q) && !branchOf(repoId, q) && el.dataset.cancreate === '1';
        const create = wrap.querySelector('[data-create]');
        if (create) {
          if (valid) { create.hidden = false; create.textContent = 'Create branch: ' + q; }
          else { create.hidden = true; create.textContent = ''; }
        }
        const invalid = !!q && !validBranchName(q);
        wrap.querySelector('[data-invalid]').hidden = !invalid;
        wrap.querySelector('[data-nomatch]').hidden = !(q && !visible && !invalid && !valid);
      },
      'branch-pick': function (ctx) {
        const r = currentRepo();
        ARC.navigate(repoHref(r) + '/tree/' + encodeURIComponent(ctx.el.dataset.branch));
      },
      'clone-menu': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        const base = 'https://arhub.local/' + r.owner + '/' + r.name + '.git';
        const ssh = 'git@arhub.local:' + r.owner + '/' + r.name + '.git';
        const html = '<div role="tablist">' +
          '<button type="button" role="tab" aria-selected="true" data-action="clone-tab" data-proto="https">HTTPS</button>' +
          '<button type="button" role="tab" aria-selected="false" data-action="clone-tab" data-proto="ssh">SSH</button></div>' +
          '<p class="clone-url" data-proto-url="https">' + esc(base) + '</p>' +
          '<button type="button" data-action="clone-copy" data-value="' + esc(base) + '">Copy</button>';
        ARC.openPopover(ctx.el.closest('[data-host]') || ctx.el, html);
      },
      'clone-tab': function (ctx) {
        const wrap = ctx.el.closest('[data-popover]');
        const proto = ctx.el.dataset.proto;
        const r = currentRepo();
        const base = 'https://arhub.local/' + r.owner + '/' + r.name + '.git';
        const ssh = 'git@arhub.local:' + r.owner + '/' + r.name + '.git';
        for (const tab of wrap.querySelectorAll('[role="tab"]')) {
          tab.setAttribute('aria-selected', tab.dataset.proto === proto ? 'true' : 'false');
        }
        const url = wrap.querySelector('.clone-url');
        url.textContent = proto === 'ssh' ? ssh : base;
        const copy = wrap.querySelector('[data-action="clone-copy"]');
        copy.dataset.value = proto === 'ssh' ? ssh : base;
      },
      'clone-copy': function (ctx) {
        const value = ctx.el.dataset.value || '';
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).catch(function () {});
        } catch (e) { /* clipboard not available */ }
        ARC.notify('Copied');
      },
      'addfile-menu': function (ctx) {
        ARC.openPopover(ctx.el, [{ label: 'Create new file', action: 'newfile-open' }]);
      },
      'newfile-open': function () {
        const r = currentRepo();
        const br = currentBranch(r);
        ARC.navigate(repoHref(r) + '/newfile/' + encodeURIComponent(br));
      },
      'file-create': function (ctx) {
        const r = currentRepo();
        const branch = ctx.el.dataset.branch || r.defaultBranch;
        const f = ctx.form || {};
        const path = String(f.path || '').trim();
        const message = String(f.message || '').trim();
        if (!path || path.indexOf('/') === 0 || path.split('/').indexOf('..') >= 0) {
          setErrs('repofile', ['Invalid file path']);
          ARC.render();
          return;
        }
        if (!message) { setErrs('repofile', ['Commit message is required']); ARC.render(); return; }
        if (fileAt(r.id, branch, path)) { setErrs('repofile', ['Invalid file path']); ARC.render(); return; }
        const u = me();
        S().files.push({ id: uid('file'), repo: r.id, branch: branch, path: path, content: f.content || '' });
        S().commits.unshift({
          id: uid('c'), repo: r.id, branch: branch, message: message, author: u ? u.name : 'anonymous',
          date: 'just now', files: [{ path: path, additions: 1, deletions: 0 }]
        });
        ui().err = null;
        save();
        ARC.navigate(repoHref(r) + '/blob/' + encodeURIComponent(branch) + '/' + path.split('/').map(encodeURIComponent).join('/'));
      },

      /* ------------------------------ releases ------------------------------ */
      'release-create': function (ctx) {
        const r = repoById(ctx.el.dataset.repo) || currentRepo();
        const f = ctx.form || {};
        const tag = String(f.tag || '').trim();
        if (!tag) { setErrs('release', ['Tag name is required']); ARC.render(); return; }
        if (releaseByTag(r.id, tag)) { setErrs('release', ['Tag already exists']); ARC.render(); return; }
        const u = me();
        S().releases.push({
          id: uid('rel'), repo: r.id, tag: tag, title: String(f.title || '').trim(),
          description: f.description || '', target: f.target || r.defaultBranch,
          author: u ? u.name : 'anonymous', created: 'just now'
        });
        ui().err = null;
        save();
        ARC.navigate(repoHref(r) + '/releases/' + encodeURIComponent(tag));
      },

      /* ------------------------------ visibility, archive, protection ------------------------------ */
      'visibility-open': function (ctx) {
        ARC.openDialog('<p>Change repository visibility</p>' +
          '<label class="radio"><input type="radio" name="visibility" value="public"> Public</label>' +
          '<label class="radio"><input type="radio" name="visibility" value="private" checked> Private</label>' +
          '<button type="button" data-action="visibility-confirm" data-repo="' + esc(ctx.el.dataset.repo) + '">Confirm visibility</button> ' +
          '<button type="button" data-action="arc:close">Cancel</button>', { title: 'Change visibility' });
      },
      'visibility-confirm': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        const root = document.getElementById('dialog-root');
        const picked = root.querySelector('input[name="visibility"]:checked');
        r.visibility = picked && picked.value === 'public' ? 'public' : 'private';
        save();
        ARC.closeDialog();
        ARC.render();
      },
      'archive-open': function (ctx) {
        ARC.openDialog('<p>Archiving makes this repository read-only. It can be restored later.</p>' +
          '<button type="button" data-action="archive-confirm" data-repo="' + esc(ctx.el.dataset.repo) + '">Confirm archive</button> ' +
          '<button type="button" data-action="arc:close">Cancel</button>', { title: 'Archive repository' });
      },
      'archive-confirm': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        if (r) r.archived = true;
        save();
        ARC.closeDialog();
        ARC.navigate(r ? repoHref(r) : '#/');
      },
      'restore-open': function (ctx) {
        ARC.openDialog('<p>Restoring returns this repository to Active. Files, issues, branches and permissions stay unchanged.</p>' +
          '<button type="button" data-action="restore-confirm" data-repo="' + esc(ctx.el.dataset.repo) + '">Confirm restore</button> ' +
          '<button type="button" data-action="arc:close">Cancel</button>', { title: 'Restore repository' });
      },
      'restore-confirm': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        if (r) r.archived = false;
        save();
        ARC.closeDialog();
        ARC.navigate(r ? repoHref(r) : '#/');
      },
      'protect-open': function () { ui().protectForm = true; save(); ARC.render(); },
      'protect-create': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        const f = ctx.form || {};
        S().protections.push({
          id: uid('prot'), repo: r.id, pattern: String(f.pattern || '').trim() || 'main',
          requireApprovals: f.approvals ? 1 : 0, requireStatus: f.status ? 'test' : null
        });
        ui().protectForm = false;
        save();
        ARC.render();
      },
      'default-branch-save': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        const val = (ctx.form || {}).defaultBranch;
        ui().branchConfirm = r.id;
        ui().branchConfirmTo = val;
        save();
        ARC.render();
      },
      'default-branch-confirm': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        r.defaultBranch = ui().branchConfirmTo || r.defaultBranch;
        ui().branchConfirm = null;
        save();
        ARC.render();
      },
      'default-branch-cancel': function () { ui().branchConfirm = null; save(); ARC.render(); },

      'access-open': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        const teams = orgTeams(r.owner).map(function (t) { return t.name; });
        const members = orgMembers(r.owner).map(function (m) { return m.user; });
        const people = members.concat(teams).map(function (n) {
          return '<div role="option" tabindex="-1" data-action="access-pick" data-subject="' + esc(n) + '">' + esc(n) + '</div>';
        }).join('');
        ARC.openDialog('<label for="acc-search">Search</label>' +
          '<input id="acc-search" type="text" placeholder="Search" data-change="access-filter">' +
          '<div class="listbox" role="listbox" aria-label="People and teams">' + people + '</div>' +
          '<p class="msg" data-nomatch hidden>No matches</p>' +
          ARC.combobox({ label: 'Role', name: 'role', options: ['Read', 'Triage', 'Write', 'Maintain', 'Admin'], value: 'Write' }) +
          '<button type="button" data-action="access-add" data-repo="' + esc(r.id) + '">Add</button> ' +
          '<button type="button" data-action="arc:close">Cancel</button>', { title: 'Add people or teams' });
      },
      'access-filter': function (ctx) {
        const q = String(ctx.el.value || '').trim().toLowerCase();
        const wrap = document.getElementById('dialog-root');
        let visible = 0;
        for (const o of wrap.querySelectorAll('[role="option"][data-subject]')) {
          const match = !q || o.dataset.subject.toLowerCase().indexOf(q) >= 0;
          o.hidden = !match;
          if (match) visible++;
        }
        wrap.querySelector('[data-nomatch]').hidden = visible > 0;
      },
      'access-pick': function (ctx) {
        const wrap = document.getElementById('dialog-root');
        wrap.dataset.subject = ctx.el.dataset.subject;
        for (const o of wrap.querySelectorAll('[role="option"][data-subject]')) {
          o.setAttribute('aria-selected', o === ctx.el ? 'true' : 'false');
        }
      },
      'access-add': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        const wrap = document.getElementById('dialog-root');
        const subject = wrap.dataset.subject;
        if (!subject) return;
        const roleSel = wrap.querySelector('select[name="role"]');
        const role = roleSel ? roleSel.value.toLowerCase() : 'write';
        const team = teamByName(r.owner, subject);
        S().grants.push({
          id: uid('g'), repo: r.id, subject: team ? team.id : subject,
          subjectType: team ? 'team' : 'user', role: role
        });
        save();
        ARC.closeDialog();
        ARC.render();
      },
      'access-save': function (ctx) {
        const g = (S().grants || []).find(function (x) { return x.id === ctx.el.dataset.grant; });
        if (!g) return;
        g.role = String((ctx.form || {}).role || g.role).toLowerCase();
        save();
        ARC.render();
      },

      /* ------------------------------ issues ------------------------------ */
      'issue-create': function (ctx) {
        const r = repoById(ctx.el.dataset.repo);
        const f = ctx.form || {};
        const title = String(f.title || '').trim();
        if (!title) { setErrs('newissue', ['Title is required']); ARC.render(); return; }
        const nums = issuesOf(r.id).map(function (i) { return i.number; });
        const number = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
        const u = me();
        S().issues.push({
          id: r.id + ':issue:' + number, repo: r.id, number: number, title: title, status: 'open',
          description: f.description || '', author: u ? u.name : 'anonymous', labels: [], assignees: [], milestone: null
        });
        ui().err = null;
        save();
        ARC.navigate(repoHref(r) + '/issues/' + number);
      },
      'issue-title-open': function () { ui().editTitle = true; save(); ARC.render(); },
      'issue-desc-open': function () { ui().editDesc = true; save(); ARC.render(); },
      'issue-title-save': function (ctx) {
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        const title = String((ctx.form || {}).title || '').trim();
        if (!title) { setErrs('edittitle', ['Title is required']); ARC.render(); return; }
        iss.title = title;
        ui().editTitle = false; ui().err = null;
        save();
        ARC.render();
      },
      'issue-desc-save': function (ctx) {
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        iss.description = (ctx.form || {}).description || '';
        ui().editDesc = false;
        save();
        ARC.render();
      },
      'issue-comment': function (ctx) {
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        const body = String((ctx.form || {}).body || '');
        if (!body.trim()) { setErrs('comment', ['Comment is required']); ARC.render(); return; }
        const u = me();
        S().issueComments.push({ id: uid('ic'), issue: iss.id, author: u ? u.name : 'anonymous', body: body, created: 'just now' });
        ui().err = null;
        save();
        ARC.render();
      },
      'issue-close': function (ctx) {
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        iss.status = 'closed';
        const u = me();
        S().issueComments.push({ id: uid('ic'), issue: iss.id, author: u ? u.name : 'anonymous', body: 'closed this issue', created: 'just now' });
        save();
        ARC.render();
      },
      'issue-reopen': function (ctx) {
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        iss.status = 'open';
        const u = me();
        S().issueComments.push({ id: uid('ic'), issue: iss.id, author: u ? u.name : 'anonymous', body: 'reopened this issue', created: 'just now' });
        save();
        ARC.render();
      },
      'reaction-open': function (ctx) {
        ARC.openPopover(ctx.el, [{
          label: '+1',
          action: 'reaction-add',
          extra: 'data-issue="' + esc(ctx.el.dataset.issue) + '" data-reaction="+1"'
        }], { kind: 'menu', label: 'Add reaction' });
      },
      'reaction-add': function (ctx) {
        const u = me();
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        if (!u || !iss) return;
        const type = ctx.el.dataset.reaction || '+1';
        if (!Array.isArray(S().reactions)) S().reactions = [];
        const already = S().reactions.some(function (x) { return x.issue === iss.id && x.user === u.name && x.type === type; });
        if (!already) S().reactions.push({ id: uid('rx'), issue: iss.id, user: u.name, type: type });
        save();
        ARC.render();
      },
      'reaction-remove': function (ctx) {
        const u = me();
        if (!u) return;
        const issueId = ctx.el.dataset.issue;
        const type = ctx.el.dataset.reaction || '+1';
        S().reactions = (S().reactions || []).filter(function (x) {
          return !(x.issue === issueId && x.user === u.name && x.type === type);
        });
        save();
        ARC.render();
      },
      'assignees-open': function (ctx) {
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        const r = repoById(iss.repo);
        const eligible = orgMembers(r.owner).map(function (m) { return m.user; });
        const opts = eligible.map(function (n) {
          return '<div role="option" tabindex="-1" data-action="assignee-toggle" data-issue="' + esc(iss.id) + '" data-user="' + esc(n) + '">' + esc(n) + '</div>';
        }).join('');
        ARC.openPopover(ctx.el, '<label for="search-assignees">Search assignees</label>' +
          '<input id="search-assignees" type="text" placeholder="Search assignees" data-change="option-filter">' +
          '<div class="listbox" role="listbox" aria-label="Assignees">' + opts + '</div>');
      },
      'option-filter': function (ctx) {
        const el = ctx.el;
        const wrap = el.closest('[data-popover]');
        if (!wrap) return;
        const q = String(el.value || '').trim().toLowerCase();
        for (const o of wrap.querySelectorAll('[role="option"]')) {
          const text = (o.textContent || '').toLowerCase();
          o.hidden = !!q && text.indexOf(q) < 0;
        }
      },
      'assignee-toggle': function (ctx) {
        const issueId = ctx.el.dataset.issue;
        const target = (S().issues || []).find(function (i) { return i.id === issueId; });
        if (!target) return;
        const user = ctx.el.dataset.user;
        target.assignees = target.assignees || [];
        const idx = target.assignees.indexOf(user);
        if (idx >= 0) target.assignees.splice(idx, 1);
        else target.assignees.push(user);
        save();
        ARC.render();
      },
      'labels-open': function (ctx) {
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        const r = repoById(iss.repo);
        const opts = labelsOf(r.id).map(function (l) {
          return '<div role="option" tabindex="-1" data-action="label-toggle" data-issue="' + esc(iss.id) + '" data-label="' + esc(l.name) + '">' + esc(l.name) + '</div>';
        }).join('');
        ARC.openPopover(ctx.el, '<div class="listbox" role="listbox" aria-label="Labels">' + opts + '</div>');
      },
      'label-toggle': function (ctx) {
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        const name = ctx.el.dataset.label;
        iss.labels = iss.labels || [];
        const idx = iss.labels.indexOf(name);
        if (idx >= 0) iss.labels.splice(idx, 1);
        else iss.labels.push(name);
        save();
        ARC.render();
      },
      'milestone-open': function (ctx) {
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        const r = repoById(iss.repo);
        const opts = milestonesOf(r.id).map(function (m) {
          return '<div role="option" tabindex="-1" data-action="milestone-pick" data-issue="' + esc(iss.id) + '" data-milestone="' + esc(m.title) + '">' + esc(m.title) + '</div>';
        }).join('');
        ARC.openPopover(ctx.el, '<div class="listbox" role="listbox" aria-label="Milestones">' + opts + '</div>');
      },
      'milestone-pick': function (ctx) {
        const iss = (S().issues || []).find(function (i) { return i.id === ctx.el.dataset.issue; });
        iss.milestone = ctx.el.dataset.milestone;
        save();
        ARC.render();
      },

      /* ------------------------------ pull requests ------------------------------ */
      'compare': function (ctx) {
        const f = ctx.form || {};
        ui().compare = { base: f.base, compare: f.compare, done: true };
        ui().draftPr = false;
        save();
        ARC.render();
      },
      'compare-pick': function (ctx) {
        const formEl = ctx.el.closest ? ctx.el.closest('form') : null;
        const data = formEl ? Object.fromEntries(new FormData(formEl).entries()) : {};
        ui().compare = { base: data.base, compare: data.compare, done: true };
        ui().draftPr = false;
        save();
        ARC.render();
      },
      'pr-create': function (ctx) { createPr(ctx, !!ui().draftPr); },
      'pr-draft': function (ctx) { ui().draftPr = true; save(); createPr(ctx, true); },
      'pr-ready': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ctx.el.dataset.pr; });
        const u = me();
        pr.status = 'open';
        pr.reviews = pr.reviews || [];
        pr.reviews.push({ id: uid('rv'), author: u ? u.name : 'author', decision: 'ready_for_review', summary: 'Ready for review', commit: pr.sourceCommit });
        save();
        ARC.render();
      },
      'pr-close': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ctx.el.dataset.pr; });
        pr.status = 'closed';
        save();
        ARC.render();
      },
      'pr-reopen': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ctx.el.dataset.pr; });
        pr.status = 'open';
        save();
        ARC.render();
      },
      'pr-merge': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ctx.el.dataset.pr; });
        ui().mergeConfirm = pr.id;
        save();
        ARC.render();
      },
      'pr-merge-cancel': function () { ui().mergeConfirm = null; save(); ARC.render(); },
      'pr-merge-confirm': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ctx.el.dataset.pr; });
        const r = repoById(pr.repo);
        const el = prEligibility(r, pr);
        if (!el.ok) { ui().mergeConfirm = null; save(); ARC.render(); return; }
        const u = me();
        const head = branchOf(r.id, pr.target);
        const mergeId = sha();
        if (head) {
          S().commits.push({
            id: mergeId, repo: r.id, branch: pr.target, message: 'Merge pull request #' + pr.number + ' from ' + pr.source,
            author: u ? u.name : 'maintainer', date: 'just now',
            files: (pr.changedFiles || []).map(function (f) { return { path: f.path, additions: f.additions, deletions: f.deletions }; })
          });
          head.head = mergeId;
        }
        pr.status = 'merged';
        pr.merged = true;
        pr.mergedBy = u ? u.name : 'maintainer';
        pr.mergedAt = 'just now';
        pr.mergedCommit = mergeId;
        ui().mergeConfirm = null;
        save();
        ARC.render();
      },
      'pr-comment-open': function (ctx) { ui().prCommentOpen = ctx.el.dataset.pr; save(); ARC.render(); },
      'pr-comment-single': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ctx.el.dataset.pr; });
        const body = String((ctx.form || {}).body || '');
        if (!body.trim()) return;
        const u = me();
        pr.comments = pr.comments || [];
        pr.comments.push({ author: u ? u.name : 'reviewer', body: body, path: ((pr.changedFiles || [])[0] || {}).path, line: 1, outdated: false });
        ui().prCommentOpen = null;
        save();
        ARC.render();
      },
      'pr-comment-start': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ui().prCommentOpen; });
        if (!pr) return;
        const body = String((document.getElementById('pc-body') || {}).value || '');
        if (!body.trim()) return;
        const u = me();
        ui().pendingReview = { pr: pr.id, body: body, author: u ? u.name : 'reviewer' };
        ui().prCommentOpen = null;
        save();
        ARC.render();
      },
      'pr-review-open': function (ctx) { ui().prReviewOpen = ctx.el.dataset.pr; save(); ARC.render(); },
      'pr-review-submit': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ctx.el.dataset.pr; });
        const f = ctx.form || {};
        const decision = f.decision || 'approve';
        const u = me();
        pr.reviews = pr.reviews || [];
        pr.reviews.push({
          id: uid('rv'), author: u ? u.name : 'reviewer',
          decision: decision === 'approve' ? 'approved' : 'changes_requested',
          summary: f.summary || '', commit: pr.sourceCommit
        });
        ui().prReviewOpen = null;
        save();
        ARC.render();
      },
      'reviewers-open': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ctx.el.dataset.pr; });
        const r = repoById(pr.repo);
        const eligible = orgMembers(r.owner).map(function (m) { return m.user; });
        const opts = eligible.map(function (n) {
          return '<div role="option" tabindex="-1" data-action="reviewer-pick" data-pr="' + esc(pr.id) + '" data-user="' + esc(n) + '">' + esc(n) + '</div>';
        }).join('');
        ARC.openPopover(ctx.el, '<label for="reviewer-search">Search</label>' +
          '<input id="reviewer-search" type="text" placeholder="Search" data-change="option-filter">' +
          '<div class="listbox" role="listbox" aria-label="Reviewers">' + opts + '</div>');
      },
      'reviewer-pick': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ctx.el.dataset.pr; });
        pr.reviewers = pr.reviewers || [];
        if (pr.reviewers.indexOf(ctx.el.dataset.user) < 0) pr.reviewers.push(ctx.el.dataset.user);
        save();
        ARC.render();
      },
      'reviewer-remove': function (ctx) {
        const pr = (S().prs || []).find(function (p) { return p.id === ctx.el.dataset.pr; });
        pr.reviewers = (pr.reviewers || []).filter(function (n) { return n !== ctx.el.dataset.user; });
        save();
        ARC.render();
      },
      'check-change': function (ctx) {
        ui().pendingCheck = { value: ctx.value, name: ctx.name };
        save();
      },
      'check-save': function (ctx) {
        const chk = (S().checks || []).find(function (c) { return c.id === ctx.el.dataset.check; });
        const u = me();
        const pending = ui().pendingCheck;
        if (pending && pending.name === 'test') chk.status = pending.value;
        chk.actor = u ? u.name : null;
        ui().pendingCheck = null;
        save();
        ARC.render();
      }
    }
  };

  function dedupe(arr) {
    const out = [];
    for (const x of arr) if (out.indexOf(x) < 0) out.push(x);
    return out;
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function sha() {
    let s = '';
    while (s.length < 8) s += Math.floor(Math.random() * 16).toString(16);
    return s.slice(0, 8);
  }
  function statusLabel(s) {
    if (s === 'open') return 'Open';
    if (s === 'closed') return 'Closed';
    if (s === 'merged') return 'Merged';
    if (s === 'draft') return 'Draft';
    return s;
  }
  function currentRepo() {
    const p = ARC.route().params;
    return repoByPath(p[0], p[1]);
  }
  function currentBranch(r) {
    const p = ARC.route().params;
    if (p[2] === 'tree' || p[2] === 'blob' || p[2] === 'newfile') return p[3] || r.defaultBranch;
    return r.defaultBranch;
  }
  function createPr(ctx, draft) {
    const r = repoById(ctx.el.dataset.repo) || currentRepo();
    const formEl = ctx.el.closest ? ctx.el.closest('form') : null;
    const f = ctx.form || (formEl ? Object.fromEntries(new FormData(formEl).entries()) : {});
    const title = String(f.title || '').trim();
    if (!title) { setErrs('prnew', ['Title is required']); ARC.render(); return; }
    const cmp = ui().compare || {};
    const base = ctx.el.dataset.base || cmp.base || r.defaultBranch;
    const compare = ctx.el.dataset.compare || cmp.compare || r.defaultBranch;
    const nums = prsOf(r.id).map(function (p) { return p.number; });
    const number = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    const u = me();
    const head = (branchOf(r.id, compare) || {}).head;
    const changed = (commitById(head) || {}).files || [{ path: 'src/search.ts', additions: 1, deletions: 0 }];
    S().prs.push({
      id: uid('pr'), repo: r.id, number: number, title: title,
      status: draft ? 'draft' : 'open', author: u ? u.name : 'anonymous',
      source: compare, target: base, description: f.description || '', created: 'just now',
      sourceCommit: head, baseCommit: (branchOf(r.id, base) || {}).head,
      changedFiles: changed,
      commits: [{ sha: head, message: 'Changes on ' + compare, author: u ? u.name : 'anonymous', date: 'just now' }],
      reviewers: [], reviews: [], comments: [], merged: null, mergedBy: null, mergedAt: null
    });
    ui().err = null; ui().compare = null; ui().draftPr = false;
    save();
    ARC.navigate(repoHref(r) + '/pulls/' + number);
  }

  // The create-branch option inside the branch selector.
  document.addEventListener('click', function (ev) {
    const create = ev.target.closest('[data-create]');
    if (!create) return;
    const wrap = create.closest('[data-popover]');
    const input = wrap && wrap.querySelector('#find-branch');
    if (!input) return;
    const repoId = input.dataset.repo;
    const r = repoById(repoId);
    const name = String(input.value || '').trim();
    if (!validBranchName(name) || branchOf(repoId, name)) return;
    if (!canWriteRepo(r, repoRole(r, me()))) return;
    const head = (branchOf(repoId, r.defaultBranch) || {}).head;
    S().branches.push({ id: repoId + ':' + name, repo: repoId, name: name, head: head });
    save();
    ev.preventDefault();
    ev.stopPropagation();
    ARC.navigate(repoHref(r) + '/tree/' + encodeURIComponent(name));
  }, true);

  window.APP = APP;
})();

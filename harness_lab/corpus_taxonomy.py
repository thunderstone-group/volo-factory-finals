#!/usr/bin/env python3
"""Mechanically classify every test() in the ARC-Bench official corpus.

Run with a python that has PyYAML, e.g.
  ~/projects/volo-factory/.venv/bin/python classify.py
Read-only: touches nothing outside the corpus and the keep run report.
"""
import json, os, re, sys, collections

ROOT = "~/projects/arcbench-campaign/upstream/arc-bench/arc-bench/webapp"
APPS = ["keep", "bookstack", "stackoverflow", "prestashop", "12306", "ctrip"]
KEEP_REPORTS = ["~/projects/volo-factory/runs/2026-09-14-keep-full-5/report-keep-hosted.json",
                "~/projects/volo-factory/runs/2026-09-14-keep-full-5/report-keep-repo.json"]

import yaml

# ---------------------------------------------------------------- requirements
def atomics(app):
    """id -> {name, description, then, when, given} for every ATOMIC requirement."""
    p = os.path.join(ROOT, app, "requirements", "requirements.yaml")
    doc = yaml.safe_load(open(p))
    out = {}
    def walk(n):
        if not isinstance(n, dict):
            return
        if n.get("type") == "ATOMIC":
            steps = collections.defaultdict(list)
            for sc in n.get("scenarios") or []:
                for st in sc.get("steps") or []:
                    steps[st.get("keyword", "")].append(str(st.get("content", "")))
            out[n["id"]] = {
                "name": n.get("name", ""),
                "desc": n.get("description", "") or "",
                "given": " ".join(steps["GIVEN"]),
                "when": " ".join(steps["WHEN"]),
                "then": " ".join(steps["THEN"]),
            }
        for c in n.get("children") or []:
            walk(c)
    walk(doc)
    return out

# ---------------------------------------------------------------------- specs
TEST_RE = re.compile(r"^test\(\s*(['\"`])(.*?)\1", re.M)

def specs(app):
    """One record per test() case."""
    d = os.path.join(ROOT, app, "tests")
    recs = []
    for fn in sorted(os.listdir(d)):
        if not (fn.startswith("REQ-") and fn.endswith(".spec.ts")):
            continue
        src = open(os.path.join(d, fn)).read()
        m = re.search(r"//\s*requirement:\s*(\S+)", src)
        rid = m.group(1) if m else fn[:-8]
        m = re.search(r"//\s*fixtures:\s*(.*)", src)
        fixtures = [x.strip() for x in (m.group(1) if m else "").split(",") if x.strip()]
        hits = list(TEST_RE.finditer(src))
        for i, h in enumerate(hits):
            body = src[h.end(): hits[i + 1].start() if i + 1 < len(hits) else len(src)]
            title = h.group(2)
            scen = title.split(":", 1)[1].strip() if ":" in title else title
            recs.append({
                "app": app, "file": fn, "req": rid, "title": title, "scenario": scen,
                "fixtures": fixtures, "body": body,
                "helpers": sorted(set(re.findall(r"h\.([A-Za-z_][A-Za-z0-9_]*)", body))),
            })
    return recs

# ------------------------------------------------------------ behaviour rules
# (label, regex over the haystack). Order below is the tie-break priority.
BEHAVIOUR = [
 ("认证与会话", r"\b(log ?in|login|log ?out|logout|sign ?in|sign ?out|sign ?up|signup|register(s|ed|ing|ation)?|password|verification code|captcha|authenticat\w*|unauthori[sz]\w*|permission denied|not logged in|session|account security|reset password|forgot password)\b"),
 ("多步业务流程", r"\b(checkout|check out|place (an )?order|payment|pay\b|cart\b|booking|book (a |the )?(ticket|flight|hotel|room)|select seat|seat selection|submit (the )?order|order confirmation|purchase|itinerary|countdown)\b"),
 ("数据持久化", r"\b(persist\w*|still (visible|present|shown|there)|remains? (visible|saved|after)|saved after|sign\w* back in|round ?trip)\b"),
 ("时间相关", r"\b(date picker|calendar|departure date|return date|ride date|select (a |the )?date|date range|check-?in date|check-?out date|ARC_TEST_DATE|dateOffset|tomorrow|today'?s date|time slot)\b"),
 ("删除", r"\b(delete(s|d|ing)?|deletion|remove(s|d|ing)?|removal|discard(s|ed|ing)?|trash|clear (the )?(history|list|cart)|cancel (the )?(order|booking|reservation)|withdraw\w*)\b"),
 ("状态切换", r"\b(archiv\w+|unarchiv\w+|pin\b|pinned|unpin\w*|favorite\w*|favourite\w*|collect\b|bookmark\w*|publish\w*|unpublish\w*|toggle\w*|enable\w*|disable\w*|activat\w+|deactivat\w+|mark as|set (as )?default|switch (to|between)|expand\w*|collapse\w*|vote\w*|upvote\w*|downvote\w*|accept (the )?answer|subscrib\w+|wish ?list)\b"),
 ("创建", r"\b(create(s|d|ing)?|creation|add(s|ed|ing)?\b|new (note|book|shelf|page|chapter|question|answer|comment|address|traveler|passenger|contact|invoice|post|label|wishlist)|ask (a )?question|post (a|an) (answer|comment)|compose\w*|upload\w*)\b"),
 ("更新/编辑", r"\b(update(s|d|ing)?|edit(s|ed|ing)?|modif\w+|rename\w*|revise\w*|replace\w*|save(s|d|ing)?\b|adjust\w*|change(s|d)?\b|changing)\b"),
 ("搜索/筛选/排序", r"\b(search\w*|filter\w*|sort\w*|quer\w+|keyword\w*|autocomplete|suggestion\w*|pagination|paginate|page number)\b"),
 ("表单校验与错误提示", r"\b(invalid|required field|missing|must be|cannot be empty|error message|validation|reject(s|ed|ing)?|not allowed|mismatch\w*|too (short|weak)|already (exists|registered|taken)|incorrect|wrong)\b"),
 ("导航/入口可达", r"\b(navigat\w+|open (the|a) |enter (the )?(website|system|page)|entry|go to|jump to|return to|back to|breadcrumb\w*|menu|sidebar|tab\b|link to|redirect\w*|visit\w*|homepage|home page|reachable)\b"),
 ("读取/列表展示", r"\b(display\w*|show(s|n|ing)?\b|list\w*|view(s|ing)?\b|render\w*|present\w*|detail\w*|overview|content|information|section|layout|visible|contains)\b"),
]
# helper-name evidence that outranks prose for a few labels
HELPER_HINT = {
 "认证与会话": r"^(login|loginAs|submitLogin|openLoginPage|openSignIn|openSignupPage|signOutAndOpenLogin|fillLoginForm|fillRegistrationForm|openRegistrationPage|ensurePasswordLogin|ensureCodeLogin|fillPasswordLogin|openAccountSecurity|openSecurityForm|openForgotPasswordPage|fillForgotPasswordStepOne|reachRegistrationPasswordStep)$",
 "多步业务流程": r"^(startCheckoutWithProduct|addProductToCart|openCart|openCartWithProduct|reachPaymentPage|openBookingForm|openBookingPage|selectPassengerForBooking|openOrderCenter|openTicketOrders|openOrderHistory)$",
 "删除": r"^(deleteNote|deletablePassengerRows)$",
 "状态切换": r"^(archiveNote|unarchiveNote|pinNote|unpinNote|toggleView|setCheckbox|setRadio|openArchive|openTrash)$",
 "搜索/筛选/排序": r"^(search|openSearchResults|assertFilterInteraction|assertResultsPage|assertTransferSortToggle|openFlightSearch|openFlightResults|expectFlightResults)$",
 "表单校验与错误提示": r"^(expectErrorFeedback)$",
 "时间相关": r"^(dateOffset|date|returnDate|TEST_DATE)$",
 "数据持久化": r"^(signOutAndOpenLogin)$",
}

def classify(rec, req):
    hay = " ".join([rec["scenario"], req.get("name", ""), req.get("desc", ""),
                    req.get("when", ""), req.get("then", "")]).lower()
    scored = []
    for i, (label, rx) in enumerate(BEHAVIOUR):
        n = len(re.findall(rx, hay, re.I))
        hint = HELPER_HINT.get(label)
        if hint and any(re.match(hint, h) for h in rec["helpers"]):
            n += 3
        # scenario-title hits weigh double: the title is the requirement's own summary
        n += len(re.findall(rx, rec["scenario"].lower(), re.I)) * 2
        if n:
            scored.append((-n, i, label))
    scored.sort()
    if not scored:
        return "其它", ""
    labels_ranked = [l for _, _, l in scored]
    t = rec["scenario"].lower()
    # the scenario title is the requirement's own one-line summary: a bare verb in it wins
    for rx, lab in ((r"\b(delete|remove|discard|deletion)\w*\b", "删除"),
                    (r"\b(create|add|new)\b", "创建"),
                    (r"\b(edit|update|modify|rename|save)\w*\b", "更新/编辑"),
                    (r"\b(search|filter|sort)\w*\b", "搜索/筛选/排序"),
                    (r"\b(log ?in|log ?out|sign ?in|sign ?out|sign ?up|register|password)\w*\b", "认证与会话")):
        if re.search(rx, t) and lab in labels_ranked:
            labels_ranked.remove(lab); labels_ranked.insert(0, lab); break
    main = labels_ranked[0]
    second = labels_ranked[1] if len(labels_ranked) > 1 else ""
    return main, second

# ------------------------------------------------------- verification method
def verification(rec):
    b = rec["body"]; hs = rec["helpers"]; tags = []
    if re.search(r"expectTexts?Visible|expectAnyVisible|expectTextAbsent|getByText|expectNoteVisible|expectVisible\(", b) or any(h.startswith("expectText") for h in hs):
        tags.append("断言文本出现")
    if re.search(r"getByRole|toBeChecked|toBeEnabled|toBeDisabled|expectFieldValue|toHaveValue|setCheckbox|setRadio|expectRegistrationForm|expectLoginForm", b):
        tags.append("断言元素角色/状态")
    if re.search(r"toHaveCount|countVisibleNamed|expectFewerVisibleNamed|expectCartCount|\.length|visibleDataRowTexts", b):
        tags.append("断言计数")
    if re.search(r"expectErrorFeedback|expectSuccessFeedback|expectDialog|confirmDialog|clickDialogAction|toast|getByRole\('alert'|getByRole\('status'", b):
        tags.append("断言 toast/对话框/消息")
    # cross-page: a navigation helper fires AFTER a mutating helper in the same test
    MUT = r"h\.(fill\w*|click\w*|create\w*|delete\w*|set\w*|add\w*|archive\w*|unarchive\w*|pin\w*|unpin\w*|toggle\w*|choose\w*|press\w*|submit\w*|login|loginAs|confirmDialog)\("
    NAV = r"h\.(open\w+|returnHomeByLogo|signOutAndOpenLogin|reach\w+)\("
    muts = [m.start() for m in re.finditer(MUT, b)]
    navs = [m.start() for m in re.finditer(NAV, b)]
    if muts and navs and max(navs) > min(muts):
        tags.append("断言跨页面")
    if re.search(r"reload\(|signOutAndOpenLogin|openHome\(page\)[\s\S]*openHome\(page\)", b):
        tags.append("断言持久化(重入)")
    return tags or ["断言文本出现"]

# ------------------------------------------------------------- prerequisites
def prereq(rec):
    fx = [f for f in rec["fixtures"] if f]
    tags = []
    if not fx or fx == ["public_homepage"]:
        tags.append("纯UI无seed")
    else:
        tags.append("依赖seed数据")
    if re.search(r"FIXTURES\.accounts|h\.login|loginAs|submitLogin|ensurePasswordLogin|ensureCodeLogin|fillPasswordLogin|signOutAndOpenLogin", rec["body"]) or any(
            re.match(r"^(login|loginAs|submitLogin|ensurePasswordLogin|ensureCodeLogin|fillPasswordLogin)$", h) for h in rec["helpers"]):
        tags.append("依赖登录态")
    if re.search(r"(fillField|fillPageEditor|fillBookForm|createNote|openComposer|fillMarkdownBody|addProductToCart|fillPassengerForm|fillShelfForm|fillChapterForm)", rec["body"]) and \
       re.search(r"(expect|toBe|toHave)", rec["body"]):
        tags.append("同测试内前序动作")
    return tags

# ----------------------------------------------------------------------- main
def main():
    rows = []
    for app in APPS:
        reqs = atomics(app)
        for rec in specs(app):
            req = reqs.get(rec["req"], {})
            m, s = classify(rec, req)
            rows.append({**{k: rec[k] for k in ("app", "file", "req", "title", "scenario", "helpers", "fixtures")},
                         "main": m, "second": s,
                         "verify": verification(rec), "prereq": prereq(rec),
                         "nhelper": len(re.findall(r"h\.[A-Za-z]", rec["body"])),
                         "nassert": len(re.findall(r"h\.expect|expect\(", rec["body"])),
                         "nreload": len(re.findall(r"\.reload\(", rec["body"]))})
    labels = [l for l, _ in BEHAVIOUR] + ["其它"]

    def table(title, counter_by_app, labels, total_n):
        print(f"\n### {title}")
        print("| 行为类型 | " + " | ".join(APPS) + " | 合计 | 占比 |")
        print("|---|" + "---|" * (len(APPS) + 2))
        for l in labels:
            c = [counter_by_app[a][l] for a in APPS]
            t = sum(c)
            if t == 0: continue
            print(f"| {l} | " + " | ".join(str(x) for x in c) + f" | {t} | {t/total_n*100:.1f}% |")
        print("| **合计** | " + " | ".join(str(sum(counter_by_app[a].values())) for a in APPS) + f" | {total_n} | 100% |")

    by_app = {a: collections.Counter() for a in APPS}
    for r in rows: by_app[r["app"]][r["main"]] += 1
    table("主类分布", by_app, labels, len(rows))

    by_app2 = {a: collections.Counter() for a in APPS}
    for r in rows:
        if r["second"]: by_app2[r["app"]][r["second"]] += 1
    table("副类分布", by_app2, labels, sum(sum(c.values()) for c in by_app2.values()))

    print("\n### 每类代表用例（该类里第一个 app 序、req 序的用例）")
    seen = {}
    for r in rows:
        seen.setdefault(r["main"], r)
    for l in labels:
        if l in seen:
            r = seen[l]
            print(f"- {l}: {r['app']} / {r['req']} / {r['title']}")

    print("\n### 验证方式分布（多标签）")
    vc = collections.Counter()
    vapp = collections.defaultdict(collections.Counter)
    for r in rows:
        for t in r["verify"]:
            vc[t] += 1; vapp[t][r["app"]] += 1
    print("| 验证方式 | " + " | ".join(APPS) + " | 合计 | 覆盖率 |")
    print("|---|" + "---|" * (len(APPS) + 2))
    for t, n in vc.most_common():
        print(f"| {t} | " + " | ".join(str(vapp[t][a]) for a in APPS) + f" | {n} | {n/len(rows)*100:.0f}% |")

    print("\n### 前置依赖分布（多标签）")
    pc = collections.Counter(); papp = collections.defaultdict(collections.Counter)
    for r in rows:
        for t in r["prereq"]:
            pc[t] += 1; papp[t][r["app"]] += 1
    print("| 前置依赖 | " + " | ".join(APPS) + " | 合计 | 覆盖率 |")
    print("|---|" + "---|" * (len(APPS) + 2))
    for t, n in pc.most_common():
        print(f"| {t} | " + " | ".join(str(papp[t][a]) for a in APPS) + f" | {n} | {n/len(rows)*100:.0f}% |")

    # ---------------------------------------------------------- keep crossing
    for KEEP_REPORT in KEEP_REPORTS:
        if not os.path.exists(KEEP_REPORT):
            print(f"\n(missing {KEEP_REPORT})"); continue
        rep = json.load(open(KEEP_REPORT))
        status = {}
        def walk(s):
            for sp in s.get("suites", []): walk(sp)
            for sp in s.get("specs", []):
                ok = all(t.get("status") == "expected" for t in sp.get("tests", []))
                status[sp["title"]] = "PASS" if ok else "FAIL"
        for s_ in rep.get("suites", []): walk(s_)
        st = rep.get("stats", {})
        print(f"\n### Keep 交叉：{os.path.basename(KEEP_REPORT)}  (expected={st.get('expected')}, unexpected={st.get('unexpected')})")
        kc = collections.Counter(); kf = collections.Counter(); fails = []
        for r in rows:
            if r["app"] != "keep": continue
            sv = status.get(r["title"])
            if sv is None: continue
            kc[r["main"]] += 1
            if sv == "FAIL":
                kf[r["main"]] += 1; fails.append(r)
        print("| 行为类型 | Keep 测试数 | 失败数 | 失败率 |")
        print("|---|---|---|---|")
        for l in labels:
            if kc[l]:
                print(f"| {l} | {kc[l]} | {kf[l]} | {kf[l]/kc[l]*100:.0f}% |")
        print(f"| **合计** | {sum(kc.values())} | {sum(kf.values())} | {sum(kf.values())/max(1,sum(kc.values()))*100:.0f}% |")
        for r in fails:
            print(f"- {r['req']} / {r['title']} [{r['main']}" + (f"/{r['second']}" if r['second'] else "") + "]")

    # ------------------------------------------------- per-app structure stats
    print("\n### 结构差异")
    print("| 指标 | " + " | ".join(APPS) + " |")
    print("|---|" + "---|" * len(APPS))
    def line(name, fn):
        print(f"| {name} | " + " | ".join(fn(a) for a in APPS) + " |")
    ra = {a: [r for r in rows if r["app"] == a] for a in APPS}
    line("测试数", lambda a: str(len(ra[a])))
    line("多步业务流程(主+副)", lambda a: f"{sum(1 for r in ra[a] if '多步业务流程' in (r['main'], r['second']))} ({sum(1 for r in ra[a] if '多步业务流程' in (r['main'], r['second']))/len(ra[a])*100:.0f}%)")
    line("认证与会话(主+副)", lambda a: f"{sum(1 for r in ra[a] if '认证与会话' in (r['main'], r['second']))} ({sum(1 for r in ra[a] if '认证与会话' in (r['main'], r['second']))/len(ra[a])*100:.0f}%)")
    line("搜索/筛选/排序(主+副)", lambda a: f"{sum(1 for r in ra[a] if '搜索/筛选/排序' in (r['main'], r['second']))} ({sum(1 for r in ra[a] if '搜索/筛选/排序' in (r['main'], r['second']))/len(ra[a])*100:.0f}%)")
    line("写操作(创建/更新/删除/切换,主类)", lambda a: f"{sum(1 for r in ra[a] if r['main'] in ('创建','更新/编辑','删除','状态切换'))} ({sum(1 for r in ra[a] if r['main'] in ('创建','更新/编辑','删除','状态切换'))/len(ra[a])*100:.0f}%)")
    line("纯读(读取/导航,主类)", lambda a: f"{sum(1 for r in ra[a] if r['main'] in ('读取/列表展示','导航/入口可达'))} ({sum(1 for r in ra[a] if r['main'] in ('读取/列表展示','导航/入口可达'))/len(ra[a])*100:.0f}%)")
    line("平均 helper 调用数/测试", lambda a: f"{sum(len(re.findall(r'h[.]', r_['body'])) for r_ in []) if False else sum(r['nhelper'] for r in ra[a])/len(ra[a]):.1f}")
    line("平均断言数/测试", lambda a: f"{sum(r['nassert'] for r in ra[a])/len(ra[a]):.1f}")
    line("用 expectErrorFeedback 的测试", lambda a: str(sum(1 for r in ra[a] if 'expectErrorFeedback' in r['helpers'])))
    line("跨会话持久化验证(signOut+重登)", lambda a: str(sum(1 for r in ra[a] if 'signOutAndOpenLogin' in r['helpers'])))
    line("含 page.reload 的测试", lambda a: str(sum(1 for r in ra[a] if r['nreload'])))
    line("不同 fixture 名数", lambda a: str(len({f for r in ra[a] for f in r['fixtures']})))

    # dump for manual review
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rows.json")
    json.dump([{k: v for k, v in r.items()} for r in rows], open(out, "w"), ensure_ascii=False, indent=1)
    print(f"\n(rows -> {out}; N={len(rows)})", file=sys.stderr)

main()

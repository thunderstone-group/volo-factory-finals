import sys, re, json, importlib.util
from pathlib import Path
WT = Path("~/projects/volo-factory-worktrees/lite-first-20260922/oneshot")
MAIN = Path("~/projects/volo-factory/oneshot")
def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path / "main.py")
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod
wt = load(WT, "wt_main"); mn = load(MAIN, "main_main")
B = Path("~/projects/arcbench-campaign/upstream/arc-bench/arc-bench/webapp")
LITE = Path("~/projects/volo-factory-worktrees/lite-first-20260922/runs/lite-goal-20260922/corpus")
tasks = {f"web-{t}": B / t / "requirements" / "requirements.yaml" for t in ["12306","ctrip","prestashop","stackoverflow","keep","bookstack"]}
for t in ["keep","bookstack"]:
    cands = list((LITE / t).rglob("requirements.yaml"))
    if cands: tasks[f"lite-{t}"] = cands[0]
def prompt(mod, req):
    user = ((mod.HERE / "dialect.md").read_text(encoding="utf-8") + "\n\n" + mod.CONTRACT + mod.vocabulary_table(req) +
            "\n\n## Requirements (the application to build)\n```yaml\n" + req + "\n```")
    scaffold = mod.read_template(mod.SCAFFOLD_DIR)
    user += mod.scaffold_context(scaffold)
    return len(mod.SYSTEM) + len(user)
rows = []
for name, p in tasks.items():
    req = p.read_text(encoding="utf-8")
    ids = len(re.findall(r"(?m)^\s*-?\s*id:\s*", req))
    atomic = len(re.findall(r"(?m)^\s*type:\s*ATOMIC\s*$", req))
    quoted = len({m.group(1).lower() for m in wt.QUOTED.finditer(req)})
    ctl = len(wt.quoted_control_phrases(req))
    sc = wt.semantic_contracts(req)
    sc_sizes = {k: (len(v) if hasattr(v, "__len__") else v) for k, v in sc.items()}
    rows.append(dict(task=name, req_chars=len(req), ids=ids, atomic=atomic, quoted=quoted, control_phrases=ctl,
                     prompt_wt=prompt(wt, req), prompt_main=prompt(mn, req), contracts=sc_sizes, path=str(p)))
for r in rows:
    print(json.dumps(r, ensure_ascii=False))

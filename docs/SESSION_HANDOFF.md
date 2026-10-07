# 2026-10-07 09:30 决赛：最终包 7896620e（提交 3dcb23f5c62e）循环重跑中；保底 977c 50/60、S 98.82

先读本页、AGENTS.md、`docs/reference/finals-roadmap.md`（第 2 节须知、第 4.5 节最终包与判据、F2-real）。git 和 CLI 是现状真源。E3=`~/projects/arcbench-campaign/evidence/2026-10-06-finals`，L=`~/projects/arcbench-campaign/finals-local`。CLI 前先 `export ARCBENCH_ENV_FILE=$HOME/.config/arcbench/volo.env`。

## 用户原话与授权
- 10-06 12:20：「arc 我们进决赛了，可以开始猛攻决赛了，你跟 gpt6astra max 一起」。Codex 走 codex-dispatch。
- 练习额度与正式试跑已授权直接跑；volo-factory PR 验收后自己合；包里不写题名和答案；代理暗题位置不进派发单与仓库。
- 10-06 22:29：「说中文，看不懂」：一律中文回复。
- 10-07 02:21：「授权，更差的提交你直接删」（比当时最好成绩差的决赛提交可直接删）。
- 10-07 02:26 / 02:34：去掉无意义过拟合，判据「没有隐藏测试，认真的工程师只读需求还会不会这么做」；「数学期望仍然是冠军」；冠军会被邀请上台讲 agent 设计。

## 现状
- 最终包：feat/finals-named-messages 5c24eb4（包 7896620e，`E3/placed-5c24eb4.zip`）= 干净版加 + 命名修正 + 位置修正。为什么换、判据和本地读数见路线图 4.5。
- 正式提交 `3dcb23f5c62e`（包 7896620e，08:20 起）两题循环重跑，各最多 40 次（`rerun_loop.sh 3dcb23f5c62e github|sheet 40`，nohup，活过 /clear）。日志 `E3/reruns-3dcb23f5c62e-<task>.log`，停用 `touch E3/STOP-github` / `STOP-sheet`（STOP 按题不按提交）。09:17 读数：GitHub 19（1.852 元），Sheet 27、27（约 1.1 元），组合 46/60、S 92.15，榜第 1（Orchestro 49 条 S 89.73，Limitless' 47 条 S 82.87）。GitHub 首样本页头搜索已在；剩下的失败是 REQ-4-5、REQ-5-5（官方要「1 reaction」「Target branch: …」等需求没写的文字，不改）、REQ-1-4、REQ-2-4、REQ-3-5 场景 3。
- 保底：`977c79cf0389` 50/60、3.636 元、S 98.82。新包费用约 3 元，组合到 50/60 即约 S 100.9 超过保底，49/60 约 98.73 不够。
- 75e（干净版加）收尾：GitHub 15、20、21，Sheet 29、28、23、26，最好 50/60、3.766 元、S 98.48，08:25 已按授权删除（`E3/deletions.log`）。现存决赛提交：3dcb（最新）、977c、8aac（最早，24/60）。
- 额度：决赛 10-07 01:33 剩 175.02 元（`arcbench registration hackathon-evolution`）；练习今天又花约 10 元。

## 下一步
1. 每隔一两个小时跑 `python3 E3/best_combo.py 3dcb23f5c62e 977c79cf0389`，比 S，不比条数。
2. 删提交：`~/.local/share/uv/tools/arcbench-cli/bin/python` 里 `OfficialClient(SubmitConfig.from_env(load_env(~/.config/arcbench/volo.env))).request('DELETE', '/submissions/<id>')`，删后 `GET /submissions` 核对。
3. 10-08 中午新提交最好组合 S 仍不超过 98.82：touch 两个 STOP，等在跑的结束，删新提交（和 75e），让 977c 回到最新。
4. 10-08 16:30 起不再起新的 GitHub 运行（一次 30–60 分钟），截止 18:00 平台停在跑容器。
5. 截止后写 agent 设计说明（上台用），以 `docs/reports/2026-10-07-generalization-audit.md` 为底：起草、按需求自写测试、修复环；两道确定性检查（旧行为守卫、需求位置核对）以及它们必须和自写测试对齐（10-07 的页头搜索教训）；证据晋升（官方报告、代理校准、消融）；拒绝做的事。

## 坑
- **zsh 不拆字符串变量**：`RUNS="a b"; for r in $RUNS` 只循环一次，列表一律显式写。
- 网关会退化（10-06 22:00–23:45），退化时不起正式运行；探测：一次短请求加一次 2000 token 流式，正常约 3 s / 9 s。
- 本地 `stdout.log` 块缓冲，进度看 `L/runs/<run>/.oneshot-*/progress.json`。
- 官方报告在 run 下载包 `template/.arc/playwright-report.json`；判分用 `L/run_local.py github-real|sheet-real <包> <标签>`，读数在 `L/runs/<task>-<标签>/proxy.json`（status 为 pass/fail）。
- 练习赛官方测试包在 `E3/packs/`，可用 `gyataro/arcbench-runner:local-base` 镜像在本地对产物复现（本会话的脚本在 scratchpad，思路同 `finals-proxy/scripts/container_proxy.py`）。
- 同一题同一时刻只能有一个正式运行（409）；正式运行按 run 计费、并发不串费用；练习赛（self_funded）并发时费用列虚高。

# 2026-10-06 22:15 决赛进行中：最新有效提交 50/60，候选二在验证

先读本页、AGENTS.md、`docs/reference/finals-roadmap.md`（决赛真源：第 2 节赛制与须知、F2-real、F3 候选与读数）。git 和 CLI 是现状真源。E3=`~/projects/arcbench-campaign/evidence/2026-10-06-finals`，L=`~/projects/arcbench-campaign/finals-local`。

## 目标与约束（用户原话与授权）
- 10-06 12:20：「arc 我们进决赛了，可以开始猛攻决赛了，你跟 gpt6astra max 一起」。Codex 走 codex-dispatch skill。
- 练习额度与正式试跑已授权直接跑；volo-factory PR 验收后自己合；包里不写题名和答案；代理暗题位置不写进派发单与本仓库（跑法见 `~/projects/arcbench-campaign/acceptance-hidden/README.md`）。
- 10-06 20:03 用户：报名「你直接用 Open CLI 或者其他操作浏览器的去搞吧。我现在不在电脑旁」——核实时报名已是 registered=True，未动浏览器。

## 决赛事实
- 截止 10-08 18:00，截止时停在跑容器；最新有效提交上榜，同一提交内每题可重跑取最好；计分同初赛 S = p / (b/0.8p)^0.1。额度 200 元，22:03 剩 194.07。
- 官方报告在 run 下载包 `template/.arc/playwright-report.json`（逐条报错 + 测试代码片段），是诊断主依据。
- 本地代理 v2（`run_local.py github-real|sheet-real <包> <标签>`，判分在 finals-proxy 的 github-real/sheet-real）在官方两份产物上 60/60 逐条一致。

## 提交记录
| 提交 | 包 | GitHub | Sheet | 备注 |
|---|---|---|---|---|
| 8aac3a380e0c | 9293a251（main 决赛包 v2） | 3 | 21 | 入口位置不符 |
| 977c79cf0389 | a7066b2e（区域候选 f6778ac） | 21 | 29 | 当前最新有效之前的最好 |
| 0a76ab46dad8 | 3c0294d9（候选二 d548d71） | 在跑 b312805e05ee | 在跑 8608f0617139 | 22:03 起，现在是最新提交 |

## 下一步
1. 等 E3/finals-r3-final.jsonl（后台等待）与本地 `L/runs/github-real-place3c0294d9-s{1,2}`。若 0a76ab46dad8 合计 ≥ 50：保留，在它上面重跑 GitHub/Sheet 取最好（`arcbench run <提交> --task hackathon-evolution--github`，同题同时只能一个正式 run）；若更差：删掉它（平台允许删提交），让 977c79cf0389 回到最新。
2. 分支 feat/finals-region-contract（f6778ac + d548d71）过判据后 PR 合 main。
3. 剩余失分清单与可做的通用项见 finals-roadmap F3（「或」的替代文字只显示一个、恢复后的状态词可见）。
4. 截止前留足一次完整运行（GitHub 官方约 70 分钟）：最后一次新提交不晚于 10-08 14:00。

## 坑
- `arcbench source` 下载的文件会被秘钥脱敏改坏；可信起点用 E3/finals-open/initial-projects（官方基线下载，与 G79/Sheet87 逐字节一致）。
- 平台费用列在并发 run 时虚高；决赛额度看 `arcbench registration hackathon-evolution` 的 remaining。
- 旧回归判据剔除决赛改动的需求（Sheet REQ-2-1-3 的旧测试丢失属合法变化）。
- 本地 run_local.py 的 stdout.log 是块缓冲，进度看 `runs/<run>/.oneshot-*/progress.json`。
- 改浏览器机制默认开时，离线单测夹具要显式关掉；单测：`NODE_PATH=…/oneshot-playwright-test-1.57.0/node_modules .venv/bin/python -m unittest discover -s tests_oneshot`（326 条）。

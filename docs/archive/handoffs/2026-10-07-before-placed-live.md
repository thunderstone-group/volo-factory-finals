# 2026-10-07 08:00 决赛：最终包换为 7896620e，循环重跑中；保底 977c 50/60、S 98.82

先读本页、AGENTS.md、`docs/reference/finals-roadmap.md`（第 2 节须知、第 4.5 节最终包与判据、F2-real）。git 和 CLI 是现状真源。E3=`~/projects/arcbench-campaign/evidence/2026-10-06-finals`，L=`~/projects/arcbench-campaign/finals-local`。CLI 前先 `export ARCBENCH_ENV_FILE=$HOME/.config/arcbench/volo.env`。

## 用户原话与授权
- 10-06 12:20：「arc 我们进决赛了，可以开始猛攻决赛了，你跟 gpt6astra max 一起」。Codex 走 codex-dispatch。
- 练习额度与正式试跑已授权直接跑；volo-factory PR 验收后自己合；包里不写题名和答案；代理暗题位置不进派发单与仓库。
- 10-06 22:29：「说中文，看不懂」：一律中文回复。
- 10-07 02:21：「授权，更差的提交你直接删」（比当时最好成绩差的决赛提交可直接删）。
- 10-07 02:26 / 02:34：去掉无意义过拟合，判据「没有隐藏测试，认真的工程师只读需求还会不会这么做」；「数学期望仍然是冠军」；冠军会被邀请上台讲 agent 设计。

## 现状
- 最终包：feat/finals-named-messages 5c24eb4（包 7896620e，`E3/placed-5c24eb4.zip`）= 干净版加 + 命名修正 + 位置修正。为什么换、判据和本地读数见路线图 4.5。
- `E3/switch_to_placed.sh` 在后台：等 75e 两个循环收尾，上传正式提交（id 写进 `E3/placed-sub.txt`），起 `rerun_loop.sh <id> github 40` 与 `… sheet 40`。日志 `E3/reruns-<id>-<task>.log`，停用 `touch E3/STOP-github` / `STOP-sheet`（注意 STOP 按题不按提交）。
- 保底：`977c79cf0389` 50/60、3.636 元、S 98.82。75e（干净版加）收尾前为 GitHub 15、20，Sheet 29、28、23，S 96.97，不如保底。
- 额度：决赛 10-07 01:33 剩 175.02 元（`arcbench registration hackathon-evolution`）；练习今天又花约 10 元。

## 下一步
1. 确认新提交起跑（`cat E3/placed-sub.txt`，日志里有 start）。榜上只认最新有效提交，新提交两题各有一次完成前我们可能不在榜上，属正常。
2. 每隔一两个小时跑 `python3 E3/best_combo.py $(cat E3/placed-sub.txt) 977c79cf0389 75e1e32ba125`，比 S，不比条数。
3. 75e 的两个在跑运行结束后，若 75e 组合 S 仍 < 98.82，删 75e（它不是最新后删除不影响新提交）。删提交：用 arcbench_cli 的 OfficialClient 发 `DELETE /submissions/<id>`，按需重写。
4. 10-08 中午新提交最好组合 S 仍不超过 98.82：touch 两个 STOP，等在跑的结束，删新提交（和 75e），让 977c 回到最新。
5. 10-08 16:30 起不再起新的 GitHub 运行（一次 30–60 分钟），截止 18:00 平台停在跑容器。
6. PR：feat/finals-named-messages 合 main（练习判据证据在路线图 4.5），合后用 `scripts/package_oneshot.py` 确认 main 打出 7896620e。
7. 截止后写 agent 设计说明（上台用），以 `docs/reports/2026-10-07-generalization-audit.md` 为底：起草、按需求自写测试、修复环；两道确定性检查（旧行为守卫、需求位置核对）以及它们必须和自写测试对齐（10-07 的页头搜索教训）；证据晋升（官方报告、代理校准、消融）；拒绝做的事。

## 坑
- **zsh 不拆字符串变量**：`RUNS="a b"; for r in $RUNS` 只循环一次，列表一律显式写。
- 网关会退化（10-06 22:00–23:45），退化时不起正式运行；探测：一次短请求加一次 2000 token 流式，正常约 3 s / 9 s。
- 本地 `stdout.log` 块缓冲，进度看 `L/runs/<run>/.oneshot-*/progress.json`。
- 官方报告在 run 下载包 `template/.arc/playwright-report.json`；判分用 `L/run_local.py github-real|sheet-real <包> <标签>`，读数在 `L/runs/<task>-<标签>/proxy.json`（status 为 pass/fail）。
- 练习赛官方测试包在 `E3/packs/`，可用 `gyataro/arcbench-runner:local-base` 镜像在本地对产物复现（本会话的脚本在 scratchpad，思路同 `finals-proxy/scripts/container_proxy.py`）。
- 同一题同一时刻只能有一个正式运行（409）；正式运行按 run 计费、并发不串费用；练习赛（self_funded）并发时费用列虚高。

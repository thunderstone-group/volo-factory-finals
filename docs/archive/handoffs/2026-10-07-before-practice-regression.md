# 2026-10-07 06:00 决赛：最终包干净版加在循环重跑；榜上 50/60 第 1

先读本页、AGENTS.md、`docs/reference/finals-roadmap.md`（第 2 节须知、第 4.5 节最终包与消融表、F2-real）。git 和 CLI 是现状真源。E3=`~/projects/arcbench-campaign/evidence/2026-10-06-finals`，L=`~/projects/arcbench-campaign/finals-local`。

## 用户原话与授权
- 10-06 12:20：「arc 我们进决赛了，可以开始猛攻决赛了，你跟 gpt6astra max 一起」。Codex 走 codex-dispatch。
- 练习额度与正式试跑已授权直接跑；volo-factory PR 验收后自己合；包里不写题名和答案；代理暗题位置不进派发单与仓库。
- 10-06 22:29：「说中文，看不懂」——一律中文回复。
- 10-07 02:21：「授权，更差的提交你直接删」（比当时最好成绩差的决赛提交可直接删）。
- 10-07 02:26 / 02:34：去掉无意义过拟合，判据「没有隐藏测试，认真的工程师只读需求还会不会这么做」；「数学期望仍然是冠军」；冠军会被邀请上台讲 agent 设计（初赛是冠军，见 https://create.gosim.org/factory26/#qualified）。

## 现状
- 榜：`977c79cf0389`（包 a7066b2e）50/60，S 98.82，第 1（第 2 名 Orchestro 49.2）。但最新提交现在是 `75e1e32ba125`，它的运行完成后榜会改用它的最好组合。
- 最终包：干净版加（feat/finals-clean-plus 860349e，包 0b953076，`E3/cleanplus-860349e.zip`），正式提交 `75e1e32ba125`。
- 在跑：`E3/rerun_loop.sh 75e1e32ba125 github 30` 与 `… sheet 30`（nohup，活过 /clear；日志 `E3/reruns-75e1e32ba125-{github,sheet}.log`；`touch E3/STOP-github` / `STOP-sheet` 停）。练习 6 题回归（`E3/final-practice-ids.txt`）。
- 额度：决赛 10-07 01:33 剩 175.02 元（`arcbench registration hackathon-evolution`）；练习余额 209 元。

## 下一步
1. 看练习回归：`arcbench status $(cat E3/final-practice-ids.txt)`，合计 ≥ 37/38 就给 feat/finals-clean-plus 开 PR 合 main（它包含 feat/finals-clean 的 5 个审查提交 + 860349e），合后用 `scripts/package_oneshot.py` 确认 main 打出 0b953076。
2. 每隔一两个小时看重跑日志，算两题各自最好的和。超过 50 就是新最好；10-08 中午仍不超过 50，就删 `75e1e32ba125`（先 touch STOP 两个文件、等在跑的 run 完成或取消），让 `977c79cf0389` 回到最新。删提交脚本思路：用 arcbench_cli 的 OfficialClient 发 `DELETE /submissions/<id>`（例子在本机 scratchpad 已失效，重写即可）。
3. 10-08 16:30 起不再起新的 GitHub 重跑（一次 25–75 分钟），截止 18:00 时平台会停在跑容器。
4. 截止后写 agent 设计说明（给上台讲），以 feat/finals-clean 的 `docs/reports/2026-10-07-generalization-audit.md` 为底：链路（起草 → 按需求自写测试 → 修复环）、两道确定性检查（旧行为守卫、需求位置核对）、证据晋升（官方报告 → 代理校准 → 消融）、拒绝做的事。

## 坑
- **zsh 不拆字符串变量**：`RUNS="a b"; for r in $RUNS` 只循环一次；`set -- $x` 也不拆。列表一律显式写（10-07 因此白等两小时）。
- 网关会退化（10-06 22:00–23:45），退化时不起正式运行；探测：一次短请求 + 一次 2000 token 流式，正常约 3 s / 9 s。
- 本地 `stdout.log` 块缓冲，进度看 `L/runs/<run>/.oneshot-*/progress.json`。
- 旧回归判据剔除决赛改动的需求（Sheet REQ-2-1-3）。
- 官方报告在 run 下载包 `template/.arc/playwright-report.json`；本地代理 v3 在 10 份官方产物上 292/300 一致，判分用 `L/run_local.py github-real|sheet-real <包> <标签>`。

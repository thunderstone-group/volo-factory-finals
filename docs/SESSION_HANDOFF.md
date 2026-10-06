# 2026-10-06 12:45 决赛开工：练习进化基线在跑，代理暗题派给 Codex

先读本页、AGENTS.md 和 `docs/reference/finals-roadmap.md`；git 和 CLI 是当前状态真源。E3=`~/projects/arcbench-campaign/evidence/2026-10-06-finals`。

- 初赛已结束：终榜第 2（G79 `afc04ffe5b63` + Sheet87 `defb678bf0a1`，S104.96，提交 `12e3bab723fd`）。最后一对 run `9f40df0b587e`/`8c80a2b899ac` 只有 62/7，没替换成绩。10-05 组委会邮件通知入围决赛，安排另行通知。
- 决赛 = 平台竞赛 `hackathon-evolution`：从上面两份产物继续进化，2 题 60 条，尚未开放（403）。报名 registered=False、can_confirm=True，要甲方定。
- F1 第二轮（包 0a0ab9d7）：Web 进化 38/38、Lite 10/12，结果 E3/r2-final.jsonl。Light 编译器 Codex job `~/.codex-jobs/volo-factory/2026-10-06-light-compiler/`（worktree light-compiler，分支 feat/light-scenario-compiler，默认关）。
- F1 第一轮 8/8 死在发布（`template changed during generation`，平台运行期间写 `.arc/`），PR #121 修复，包 0a0ab9d7 第二轮在跑：提交 `e27ad83fd9c5`（arc-bench-evolution）、`30c220b9ce4d`（lite），run id 见 E3/r2-ids.txt，等待器写 E3/r2-wait.jsonl 与 r2-wait.exit。
- （第一轮记录）F1 练习基线：主分支 v11 包（cd0f5969，副本 E3/v11-main-cd0f5969.zip），模型 deepseek-v4-flash-vision-exp，练习额度。提交 `da8189ed3dd5`（arc-bench-evolution，run 12306 `6908dfd75b2b`、bookstack `41019cb9e0e1`、ctrip `f1a38fbc4e47`、keep `70b53c1fe2bb`、prestashop `5dbadb474c70`、stackoverflow `5ae9b83511a9`）与 `cba6094af823`（lite-evolution，bookstack `108d9b96822e`、keep `a6e70f4061d2`）。等待器 nohup 写 E3/baseline-wait.jsonl，结束写 E3/baseline-wait.exit。练习余额起跑前 356.99 元。
- F2 代理暗题：已交付（两题各 30 条，起点 0/30、参考实现 30/30×2、旧回归无丢失）。位置与跑法只记在主会话专用的 acceptance-hidden README，不写进本仓库。13:20 起用包 0a0ab9d7 在两题上本地各跑一次作代理基线。

- Light 场景编译器（F3 候选）已合 main，默认关（`ONESHOT_LIGHT_TESTS=1` 开）；报告 `reports/2026-10-06-light-compiler.md`。

- 15:30：代理基线、守卫、源码审查的现状见 finals-roadmap F2 读数与 F3 状态。在跑：守卫平台试跑 2（E3/guard2-ids.txt）、Codex 收紧守卫豁免（job `2026-10-06-regression-guard`）、源码审查消融（本地 finals-local/runs/*-nosr-s1）。

- 18:00：守卫在平台实测有效（宽松版找回 230 项）；源码审查进化模式下线（#127）。严格版守卫候选包 a64cd91e 在跑：平台 E3/cand-ids.txt，本地 finals-local/runs/*-cand-a64cd91e-s1；判据见 progress 18:00 节。

下一步：收 F1 八个终态并逐条归因（`arcbench download` 取产物，含起点应用）；搭 F4 本地回放；F2 交付后用它做 F3 候选的配对比较。

# 2026-10-06 12:45 决赛开工：练习进化基线在跑，代理暗题派给 Codex

先读本页、AGENTS.md 和 `docs/reference/finals-roadmap.md`；git 和 CLI 是当前状态真源。E3=`~/projects/arcbench-campaign/evidence/2026-10-06-finals`。

- 初赛已结束：终榜第 2（G79 `afc04ffe5b63` + Sheet87 `defb678bf0a1`，S104.96，提交 `12e3bab723fd`）。最后一对 run `9f40df0b587e`/`8c80a2b899ac` 只有 62/7，没替换成绩。10-05 组委会邮件通知入围决赛，安排另行通知。
- 决赛 = 平台竞赛 `hackathon-evolution`：从上面两份产物继续进化，2 题 60 条，尚未开放（403）。报名 registered=False、can_confirm=True，要甲方定。
- F1 练习基线：主分支 v11 包（cd0f5969，副本 E3/v11-main-cd0f5969.zip），模型 deepseek-v4-flash-vision-exp，练习额度。提交 `da8189ed3dd5`（arc-bench-evolution，run 12306 `6908dfd75b2b`、bookstack `41019cb9e0e1`、ctrip `f1a38fbc4e47`、keep `70b53c1fe2bb`、prestashop `5dbadb474c70`、stackoverflow `5ae9b83511a9`）与 `cba6094af823`（lite-evolution，bookstack `108d9b96822e`、keep `a6e70f4061d2`）。等待器 nohup 写 E3/baseline-wait.jsonl，结束写 E3/baseline-wait.exit。练习余额起跑前 356.99 元。
- F2 代理暗题：Codex job `~/.codex-jobs/volo-factory/2026-10-06-finals-proxy/`（brief.md、last-message.md），产物在 campaign 下的 finals-proxy 目录。主会话专用，路径不写进改进派发单。

下一步：收 F1 八个终态并逐条归因（`arcbench download` 取产物，含起点应用）；搭 F4 本地回放；F2 交付后用它做 F3 候选的配对比较。

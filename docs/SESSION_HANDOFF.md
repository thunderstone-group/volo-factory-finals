# 2026-10-06 升级草稿定点编辑候选：仅本地提交，默认关闭

先读本页、AGENTS.md、`reference/finals-roadmap.md` 第 4.5 节与 F3，再读 [本次报告](reports/2026-10-06-upgrade-patch-draft.md) 和 [证据 JSON](reports/2026-10-06-upgrade-patch-draft.json)。本轮仅在用户指定工作树实施，没有推送、合并或平台调用；main 的决赛包选择未改变。此前交接原样保存在 [归档](archive/handoffs/2026-10-06-before-upgrade-patch-draft.md)。

- `ONESHOT_UPGRADE_PATCH=1` 开启升级草稿 EDIT，默认 0，新建应用保持原路径。现有文件大于 4096 UTF-8 字节禁止 FILE；SEARCH 严格唯一命中，按回复内文件事务提交，失败集中纠正一次，截断不应用半个 hunk，残留失败继续原有检查和修复。
- 四组真实本地对照：BookStack、Keep、12306 的对应练习需求，以及 GitHub 起点配原样 Keep 练习需求。开启版 64/64 hunk，0 纠正/未命中/整份重写；双方自带验收各 24/24。GitHub 草稿具名函数开/关 78/78 与 12/78；关闭版经过两轮普通修复最终也恢复到 78/78，勿把草稿损失当最终交付结果。
- 八个运行、45 次网关调用、完整 usage，估算合计 CNY 4.279497（授权上限 15）。没有使用正式决赛需求、官方平台打分或独立旧行为验收，不能据此宣称决赛提升。所有 run 输出及 raw archive 留在 `runs/upgrade-patch/`，哈希见证据。
- 最终完整 one-shot 回归 345 项：342 通过、3 项完整 Chromium 条件跳过；legacy 226 项：214 通过、12 跳过。21 项新定向测试全部通过。关闭开关的提示词和续写请求体与基线逐字节一致。最终解包 parser 重放四份真实回复，64 hunk、32 文件与实跑草稿逐字节一致。
- 最终包 SHA-256 `6293670acb85669f24ff381e0700cada14229c467b2fa647a2b6b38ab9a28bd6`。实跑包与随后边界修正的区别在报告说明；不要把 mock 恢复测试说成真实模型纠正成功。

后续若决定推广，沿用 finals-roadmap F3 的独立配对验收判据；本任务到本地提交为止，不自动开启开关或提交平台。

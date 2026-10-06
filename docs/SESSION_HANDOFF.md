# 2026-10-07 独立通用性与合规清理完成

先读 [审查报告](reports/2026-10-07-generalization-audit.md) 和 [one-shot 边界](reference/oneshot.md)。这是 finals-clean 独立 worktree 的本地审查交付，不是正式包晋升或官方成绩更新。git 是分支和提交现状真源；上一轮重跑交接已原样存入 `archive/handoffs/2026-10-07-before-generalization-audit.md`。

- 用户要求：逐条 A/B/C/D 审查，去掉评测定位器耦合，保留明确需求位置检查。仅当前 worktree 可写；不推送、不调用真实模型、不用 ARC-Bench key、不上传、不读本地隐藏测试。
- 代码提交：`d89d194` metadata 边界，`5652e9c` 指导/诊断清理，`b395343` 原生控件，`ac4bcdc` 需求中的实体类型。报告列有完整原始行号表、标准来源、运行路径、掉分风险和消融建议。
- 已验证：指定 one-shot 327 项 OK（3 skip）；这 3 项因完整浏览器路径检查跳过，使用已安装 headless shell 补跑原断言后全部通过。legacy 226 项 OK（12 skip）。没有做真实生成或官方评分。
- 本地包：`runs/generalization-audit/oneshot-clean.zip`，SHA-256 `240b6b8d8a3732964b141d6227522ca8199811b7c47df23e7d6af6a04e71c65a`；24 文件，配套 manifest/测试日志仍在同目录，保留证据再清理 worktree。
- 关键边界：修掉了原先 copytree 遍历 .arc 的路径；包没有 OS 文件/网络沙箱，浏览器 CDN/外部资源/重定向不受统一白名单约束。报告不认证“技术上不可能读隐藏测试”，也不宣称获胜或已经证明泛化。
- 尚未进行：清理版模型生成、分数/费用消融、官方终局核验、合并/推送/上传。后续按报告的独立行为与多样本证据判断，不把单测或打包当成绩。

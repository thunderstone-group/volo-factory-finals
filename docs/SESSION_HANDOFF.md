# 2026-10-06：回归守卫豁免已收紧，保留平台 runtime 修复

先读本页、[豁免修订报告](reports/2026-10-06-regression-guard-exemptions.md) 和 `reference/finals-roadmap.md`。前一交接原文在 [归档](archive/handoffs/2026-10-06-before-exemption-tightening.md)。git 是当前分支与提交状态真源。

- 保留 `572e231` 的 Playwright／Chromium 准备与安装逻辑，运行时段逐字相同。`ONESHOT_REGRESSION_GUARD` 仍默认关闭。
- 场景提及、导航前缀、容器名称不再自动豁免。只允许具体对象的显式变更、同位置的新 CHANGE 描述契约，或有实际观察的选项／菜单／日期迁移。容器只在明确 remove/replace 时可豁免其真实后代；前面的导航页不被当作当前页面或 DOM 父容器。
- 10 条自建 CHANGE 的 G79 对照：1194 项，原样 0 发现／0 豁免，4/4 合成破坏检出；2 个明确全局改名豁免 119 个实例；改名后隐藏下游 Password 字段仍发现 2 项。同一输入旧规则豁免 701 项，文件链接丢失为 0 发现，新规则为 37。
- 六组恢复起点／原升级产物重新双 pass 和重放：355 告警，229 真回归、120 合法变化、6 噪声，unknown 0。噪声均值 1；合法变化加噪声为 126 项（21/应用），仍有告警精度限制，不能用“噪声达标”代替整体低误报结论。逐项分类和每条规则计数见报告与 JSON；原 Filters 整区豁免判断已撤回。
- 完整 one-shot 321（3 skip）、守卫 42/42、legacy 226（12 skip）无失败。23 文件包可重复、平铺导入通过；SHA `c1ac09988fb186d4e5cc2115554183d24e06722056670b502f600959f9943c41`。
- 本轮没有模型网关／平台调用、上传、推送或合并。只提交本 worktree，不晋升默认候选，也没有生成成本或官方得分改善结论。

完整观测保留在 `runs/regression-guard-exemptions/`，恢复起点仍在 `runs/regression-guard/recovered/`；长期证据 `docs/evidence/2026-10-06-regression-guard-exemptions.json` 包含所有发现、豁免理由、原始文件哈希及运行时保留证明。

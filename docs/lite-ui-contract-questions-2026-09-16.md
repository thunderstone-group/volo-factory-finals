# ARC-Bench-Lite 界面契约澄清草稿（未发送）

9 月 16 日回放已回应一般性需求／测试不一致和 Bookstack 定位时序问题，见
[答疑同步](official-qa-sync-2026-09-16.md)。目前只承诺检查，未证实具体修复；
下面的逐项契约仍未完全明确，不将本草稿当成待重复发送的整份问题清单。

官方源码固定到 `code-philia/arc-bench@1eb018367bedd618d3b9ced406ce07fb423d4956`。
两任务 72 个需求／测试文本文件与我们此前 API 获取的冻结版本逐字节一致。
以下只用于向主办方澄清，未进入生成提示，也未修改测试或分数。

1. Keep 的文字步骤是点击 “Take a note”，但官方 `create_note_home_page.png` 和
   `create_note_form.png` 显示 “Take a note...”；测试用精确名称匹配。
   应以哪种名称为准？建议在需求中给出明确的可访问名称，或允许参考图中的拼写。
2. Keep 创建步骤描述为展开表单，参考图不能证明 ARIA dialog 角色；测试明确在
   `dialog(name="Note editor")` 内找输入框。内联编辑器是否允许？如必须使用特定角色、
   容器名称及作用范围，能否将契约作为正式任务输入提供？Bookstack 创建书架参考图则明确呈现整页表单。
3. Keep 的侧栏导航、色彩／标签选择、菜单容器也存在测试对角色或 DOM 包含范围的具体要求。
   能否明确这些属于验收契约还是测试实现假设？我们不会将其偷偷做成全任务通用约定。
4. Bookstack `helpers.ts:firstVisible()` 使用 `isVisible({timeout:500})`；该方法不等待。
   我们在两份应用上自然复现了“先选中不存在的 button，而稍后实际 link 已可见”：
   4 次立即选择有 2 次失败；4 次等待真实链接后原 helper 点击均可执行，无人工网络延迟。
   是否考虑对可选定位器整体等待，或提供明确的页面就绪契约？

证据见 `runs/minimal-v1-quality/20260916/diagnostics/`；官方版本与文件对比、参考图见
`runs/minimal-v2-quality/20260916/official-github/`。诊断没有被用来改判原始业务分数。

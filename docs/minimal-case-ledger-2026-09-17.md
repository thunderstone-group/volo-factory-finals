# 极简版逐用例审计：为什么没有满分

日期：2026-09-17。核对范围为全部 Keep 32 条与 Bookstack 34 条：逐条读取完整需求、完整测试和选定全部样本的原始 errors 数组，再复核共同 helper 和重点实现。不是只按总分或第一条 timeout 分组。

**边界：逐条完成的是证据核对，不是逐条完成了独立根因复现。** 失败停在前置步骤时，后面的业务保持未验证；已通过只表示该用例断言通过。不会把测试额外约定自动当作合理通用需求。

Keep 使用最后有可用产物的 V1 Pro 三份；V2 两份都未交付，没有可供业务验收的代码。Bookstack 使用 V2 两份。跨版本结果不拼成同一候选分数。

| 审计对象 | 用例数 | 样本数 | 所有样本均通过 | 所有样本均失败 | 结果不一致 | 实际执行通过/总数 |
|---|---:|---:|---:|---:|---:|---:|
| keep V1 Pro (V2 no delivery) | 32 | 3 | 2 | 23 | 7 | 19/96 |
| bookstack V2 Pro | 34 | 2 | 15 | 18 | 1 | 31/68 |

## 关键判断

1. 生成可交付、界面可操作、业务状态一致、原始评分是不同层次。构建/health通过未覆盖保存、撤销、收藏与缓存一致性；现有运行修复不能凭这些检查发现大多数业务问题。
2. Bookstack 的两个新建书籍入口在需求与 helper 中名称相反，直接阻塞3个用例；另有Logo、标签展开、确认按钮、页面placeholder等额外界面假设。先纠清约定，不应把测试特殊答案写进skill。
3. Keep 的 openSidebar 用 button Notes 判断展开，面对链接导航会再次点击折叠，造成隐藏文字和后续入口失败。标签/颜色/创建流程也有固定容器或角色假设，不能由此算成所有业务功能缺失。
4. 真实缺陷同样存在：Bookstack第二份的服务器响应与前端状态解码层级不一致；书籍/书架收藏入口遗漏。即使解除UI阻塞，后面的业务仍要单独验证。
5. 目前不能给出“修N个根因就必达100%”的可信数字：解除前置阻塞可能暴露新缺陷；只修一处状态问题也可能被早先UI步骤挡住，无法立即反映为原套件提分。

## 逐条证据表

P=通过，F=failed/timedOut。顺序按原样本编号；原始类型完整保存在 reviewed-cases.json。每条结论对应同目录 case-source-ledger.json 的完整需求、spec和错误，及下列冻结输入路径。

### bookstack

| 用例 | 各次结果 | 分类 | 实际到达与失败位置 | 尚未证明／下一步 |
|---|---|---|---|---|
| REQ-1.1 Open Homepage | P/P | 已通过 | 两次首页通过。 | 只证明该断言。 |
| REQ-1.2 Back to Homepage from Other Pages | F/F | Logo角色／名称额外约定 | 两次固定 button BookStack logo 缺失；实际首页入口为 BookStack link。 | 导航本身仍需以真实入口验证；后续回首页依赖同一缺口。 |
| REQ-2.1 Enter Login Page | P/P | 已通过 | 两次登录入口通过。 | 不等于完整认证和持久会话已覆盖。 |
| REQ-2.2 Log In Successfully | F/F | 异步就绪待复现 | 两次在登录点击后立即选 heading BookStack User，后来未找到该 heading。 | 同批 dashboard 通过，登录不宜判完全失败；需用实际昵称出现时序复核 helper 的立即选择。 |
| REQ-3.1 Enter Authenticated Homepage | P/P | 已通过 | 两次登录后仪表盘指定分区通过。 | 其他仪表盘数据仍需独立检查。 |
| REQ-4.1 View Shelf List | P/P | 已通过 | 两次书架列表通过。 | 共用同步初始化和导航已体现收益。 |
| REQ-4.2.1 Enter Shelf Details Page | P/P | 已通过 | 两次书架详情通过。 | 详情中的全部操作尚不由此保证。 |
| REQ-4.3.1 Create Shelf | F/F | 标签字段呈现约定 | 两次 Name/Description 后找 button Shelf Tags 失败；应用是同名文本字段。 | 没有到 Save Shelf；创建及保存状态可能仍有隐藏缺陷。 |
| REQ-4.3.2 Cancel Creation | P/P | 已通过 | 两次取消创建通过。 | 该用例未填入新值再取消；覆盖范围有限。 |
| REQ-4.4.1 Confirm Delete Shelf | F/F | 确认按钮名称约定 | 两次到确认页后找 Confirm Delete 失败；实际确认按钮名 Delete。 | 需求只说确认删除；删除执行和返回列表尚未测到。 |
| REQ-4.4.2 Cancel Delete Shelf | P/P | 已通过 | 两次取消删除通过。 | 只覆盖取消路径。 |
| REQ-4.5.1 Save Shelf Edits | F/F | 标签前置＋已证实状态缺陷 | 原套件两次先卡 Shelf Tags button；第二份另经公开需求路径复现保存后读旧值。 | 前置UI问题与后端domain响应解码错误叠加；修后者不保证原套件能越过前者。 |
| REQ-4.5.2 Cancel Shelf Edits | P/P | 已通过 | 两次取消编辑通过。 | 测试未更改字段后取消，不能由此保证取消回滚所有输入。 |
| REQ-5.1 View Books List | P/P | 已通过 | 两次书籍列表通过。 | 不证明写操作正确。 |
| REQ-5.2.1 Enter Book Details Page through Book List Page | P/P | 已通过 | 两次从列表打开书籍详情通过。 | 旧主要导航阻塞已解除。 |
| REQ-5.2.2 Enter Book Details Page through Shelf Details Page | P/P | 已通过 | 两次从书架打开书籍详情通过。 | 覆盖已有关系，新增关联仍需检查。 |
| REQ-5.3.1 Fill out and Save Book | F/F | 需求与helper明确冲突 | 需求在书籍列表写 New Book；helper 208 要 Create New Book；两次在这里失败。 | 应用两份遵循需求；不能偷偷把相反的测试名称变为通用技能。 |
| REQ-5.3.2 Cancel Creating Book | F/F | 前置冲突 | 使用同一反向命名的创建前置，两次未进入创建页面。 | Cancel 自身未被测试，不能归成取消功能缺陷。 |
| REQ-5.4.1 Save Book Edits | F/F | 标签字段呈现约定 | 两次在 button Book Tags 阻塞；应用是同名文本字段。 | 尚未到保存；第二份与其他写操作共用的状态解码也可能影响此路径。 |
| REQ-5.4.2 Cancel Book Edits | P/P | 已通过 | 两次取消书籍编辑通过。 | 覆盖没有输入修改的取消路径。 |
| REQ-5.5.1 Confirm Delete Book | F/F | 确认按钮名称约定 | 两次等待 Confirm Delete；确认页实际 Delete。 | 删除执行、级联关系和结果未知。 |
| REQ-5.5.2 Cancel Delete Book | P/P | 已通过 | 两次取消删除书籍通过。 | 只覆盖取消。 |
| REQ-5.6.1 Fill out and Save Book with Shelf | F/F | 需求与helper明确冲突 | 需求在书架上下文写 Create New Book；helper 227 要 New Book；两次失败。 | 两份应用遵循需求，与5.3.1对调；新增书籍及关联未测到。 |
| REQ-6.1.1 Save Page | F/F | 标签与placeholder额外约定 | 两次在 getByPlaceholder(Page title) 失败；已有带该label的字段未给placeholder。 | 尚未填入正文或执行保存，不能宣称页面写入缺失。 |
| REQ-6.1.2 Save Draft | F/F | 页面字段前置阻塞 | 两次同样在 Page title placeholder 失败。 | 草稿保存/首页列表未到达；后续还可能遭遇Logo约定，不能预估净提分。 |
| REQ-6.1.3 Delete Draft | F/F | 路径步骤额外假定 | 点击草稿后已直接进入编辑器；helper仍要求再点 Edit，两次失败。 | 没有执行 Delete Draft；删除草稿业务未知。 |
| REQ-6.2.1 Create Chapter | P/F | 业务状态错误已复现 | 第一份通过，第二份保存章节后未见新标题；第二份共用mutate对domain层级解码错误。 | 本轮单点修正副本完整复测34项：15→16，唯一变化是本项失败→通过；其余18失败未变。原样本和成绩不覆盖。 |
| REQ-6.3.1 Enter Page Reading Page | P/P | 已通过 | 两次阅读页通过。 | 只覆盖指定页面可见性。 |
| REQ-6.3.2 Redirect to Page Edit Page | P/P | 已通过 | 两次从阅读页进入编辑通过。 | 不证明实际修改和保存正确。 |
| REQ-7.1 Add to Recently Viewed | F/F | 回首页前置阻塞 | 两次在固定 button BookStack logo 失败。 | 尚未断言最近浏览列表是否有新项。 |
| REQ-7.2 Quick Navigation from Recently Viewed | F/F | 回首页前置阻塞 | 两次同Logo失败，未点击最近浏览条目。 | 不将导航后续当作独立已定位缺陷。 |
| REQ-8.1 Favorite Items | F/F | 真实动作缺失／额外登录前提 | 两次缺Favorite：第一份仅登录用户显示；第二份书籍/书架动作未接favorite函数。 | 第二份明确遗漏需求入口；第一份需求本场景未要求登录，需修不当限制或澄清。 |
| REQ-8.2 Quick Navigation from Favorites | F/F | 多重前置阻塞 | 第一份收藏后卡Logo；第二份登录后仍找不到书籍Favorite入口。 | 同失败用例根因不同，最终收藏列表导航尚未完成。 |
| REQ-9.1 Quick Navigation from Recently Updated | F/F | 页面字段前置阻塞 | 两次卡 Page title placeholder，未保存页面。 | 最近更新列表和导航未被验证，后面还可能有Logo问题。 |

### keep

| 用例 | 各次结果 | 分类 | 实际到达与失败位置 | 尚未证明／下一步 |
|---|---|---|---|---|
| REQ-1.1 Enter Website | P/P/P | 已通过 | 三次首页检查通过。 | 只覆盖该用例断言，不代表其他页面正确。 |
| REQ-2.1 Note Listing | P/P/P | 已通过 | 三次均显示指定笔记及分区。 | 其他笔记、后续状态不由此证明。 |
| REQ-2.2 Create Note | F/F/F | 路径约定／状态待证 | 样本1/3在固定 Note editor 对话框中找不到 Title；样本2到保存后未找到新笔记。 | 先区分内联编辑器与固定对话框的输入缺口；样本2需观察保存响应及状态，不猜同一根因。 |
| REQ-2.3.1 Delete | P/P/F | 跨样本入口不一致 | 样本1/2通过；样本3在笔记 article 内找 More options 失败。 | 样本3尚未执行删除，不能判删除业务已实现或已损坏。 |
| REQ-2.3.2 Notification and Undo | P/P/F | 前置删除阻塞 | 样本1/2删除及撤销通过；样本3在 More options 处阻塞。 | 样本3的 Undo 尚未被测试。 |
| REQ-2.3.3 Trash list | F/F/F | 侧栏／前置阻塞 | 样本1/2在侧栏查找 button Trash；样本3尚未完成删除。 | 先解决导航角色和侧栏开闭；垃圾箱数据尚不能判定。 |
| REQ-2.4 Update Note | F/F/F | 编辑入口／容器约定 | 三次在固定对话框的 Note content 字段处失败；helper 点的是整个 article。 | 实际标题入口与整卡点击需分别观察，尚未进入内容保存验证。 |
| REQ-2.5.1 Archive | F/F/F | 操作名称／反馈待证 | 样本1/2找精确 Archive 按钮，实际有 Archive note；样本3失败于 Note archived 反馈。 | 后者可能为异步反馈/文案，不能将三次统一当作归档业务缺失。 |
| REQ-2.5.2 Archive Undo | F/F/P | 前置归档阻塞 | 样本1/2同归档按钮阻塞；样本3撤销通过。 | 不把前置失败误计为三个独立 Undo 缺陷。 |
| REQ-2.5.3 Show archived notes | F/F/F | 前置归档／导航约定 | 样本1/2卡在归档按钮；样本3找侧栏 button Archive，需求使用 Archived。 | 列表断言未到达，归档列表业务待证。 |
| REQ-2.5.4 Unarchive | F/F/F | 前置归档／导航约定 | 同上，三次尚未完成进入归档列表。 | 解除前置阻塞后才有证据分析 Unarchive。 |
| REQ-2.6.1 Change note color | F/F/F | 卡片动作范围 | 三次找卡片内 Change color 失败，未到颜色断言。 | 需求要调色能力；是否藏于其他菜单需实际路径复核，不能以不存在固定位置判调色算法失败。 |
| REQ-2.6.2 Choose note color when created | F/F/F | 创建编辑器范围 | 三次找固定 Note editor 内 Change color 失败。 | 未执行选色、保存和背景色比较。 |
| REQ-2.7.1 Assign label to a note | F/F/F | 标签容器／前置菜单 | 样本1/2要求 Note editor 内 Work checkbox；样本3更早在 More options 失败。 | 标签弹层与业务编辑器不是天然同一容器；不能直接认定标签写入失败。 |
| REQ-2.7.2 Remove label from a note | F/F/F | 标签容器／前置菜单 | 样本1/2在相同容器找 Work checkbox 取消选择；样本3 More options 阻塞。 | 尚未验证移除标签后的实体及侧栏一致性。 |
| REQ-2.7.3 Default label | F/F/F | 侧栏前置／隐藏目标 | 三次均最终等待隐藏的 Reminders；openSidebar 以 button Notes 判展开，链接导航会被错误切换。 | 本轮已在样本1真实复现：调用原helper前Notes链接可见且展开，调用后链接隐藏且折叠；不能归因为缺种子标签。 |
| REQ-2.7.4 Assign default label when creating note | F/F/F | 创建／标签容器 | 样本1/3在对话框 More options 失败；样本2在对话框 Reminders checkbox 失败。 | 未到最终带标签笔记保存检查。 |
| REQ-2.7.5 Edit labels | F/F/F | 侧栏／隐藏目标 | Edit labels 定位落到隐藏侧栏文字或隐藏对话框。 | 重命名输入和 Save 未执行；先看真实可见入口及范围。 |
| REQ-2.7.6.1 View list filtered by label | F/F/F | 侧栏角色约定 | 三次找 complementary 内 button Work 失败。 | 应用可使用链接；过滤状态与结果尚未测到。 |
| REQ-2.7.6.2 View all notes | F/F/F | 前置标签过滤阻塞 | 三次尚未通过 button Work 前置。 | 返回 Notes 和全量列表逻辑尚未被验证。 |
| REQ-2.7.6.3 View Reminders | F/F/F | 侧栏角色约定 | 三次找 complementary 内 button Reminders 失败。 | 标签是否存在与能否按当前 helper 操作是不同事实。 |
| REQ-2.8.1 Pin note | F/F/F | 状态呈现额外约定 | 三次已点置顶，但均缺 card.getByTitle(Pinned) 要求的 title 属性。 | 需求只要求显示置顶状态；需检验真实状态，不能由 tooltip 缺失宣称没有置顶。 |
| REQ-2.8.2 Unpin note | P/P/F | 跨样本状态／定位 | 样本1/2通过；样本3置顶后找 Unpin note 失败。 | 需区分状态没更新、按钮未重渲染与定位时序。 |
| REQ-2.8.3 Pin note when creating it | F/F/F | 创建容器／状态呈现 | 样本1/3卡对话框 Title；样本2到最终 Pinned title 断言失败。 | 共同最终目标不同于三个相同根因，标明每份到达位置。 |
| REQ-3.1 Initial suggested filters | F/F/F | 搜索角色／建议范围 | 样本1/3找 listbox 内 Reminders button；样本2搜索 textbox 本身未找到。 | 原生 searchbox、建议弹层角色与测试假设须分开；尚未验证过滤结果。 |
| REQ-3.2 Search by keyword | P/F/P | 跨样本字段角色 | 样本1/3搜索及高亮通过；样本2找 textbox Search 失败。 | 不能说全部样本搜索算法缺失。 |
| REQ-4.1 Setting options list | F/F/F | 设置菜单角色／入口 | 样本1/2找 menu 内 menuitem Settings；样本3入口 Settings button 失败。 | Help/feedback 等后续断言未到达，额外名称应核对输入来源。 |
| REQ-4.2 Detailed settings | F/F/F | 设置前置菜单阻塞 | 样本1/2卡 menuitem Settings；样本3入口失败。 | 设置表单内容与保存功能尚未被本用例验证。 |
| REQ-5.1 Toggle between list and grid views | F/P/P | 控件形态额外约定 | 样本1单按钮切换后找固定 List view button+aria-pressed 失败；样本2/3通过。 | 测试假定同时两个固定名称按钮；需求允许切换行为，不应自动将单按钮判错。 |
| REQ-5.2 Grid View by default | F/P/P | 控件形态额外约定 | 样本1 List view 没有 aria-pressed；样本2/3通过。 | 需观察实际网格布局；缺属性不是布局必错。 |
| REQ-6.1 Items and styling | F/F/F | 侧栏前置／隐藏目标 | 三次等待 Notes 或 Reminders 隐藏文字；当前 helper 可能先把本来展开的链接侧栏折叠。 | 未独立验证全部图标和样式，失败不等于五个导航项全缺。 |
| REQ-6.2 Collapsible Sidebar | F/F/F | 侧栏前置阻塞 | 三次在 Notes/Trash 的可见性前置失败，尚未执行用例自己的两次 Toggle。 | 不能把前置 helper 导致的隐藏算作折叠展开业务已证实损坏。 |

## 原始证据定位

- Keep：`runs/minimal-v1-quality/20260916/`，`inputs/arc-bench-lite--keep/requirements.yaml`、`evaluation-specs/arc-bench-lite--keep/`、三份Pro的`evaluation/playwright.stdout.json`。
- Bookstack：`runs/minimal-v2-quality/20260916/`，对应 inputs、evaluation-specs、两份Pro结果。
- 每条精确spec路径、sha256、原始错误、样本报告路径均保存在本目录 `reviewed-cases.json`；原始文件无修改。
- 重点源码：第二份Bookstack `A0/frontend/public/app.js:76–87`（响应层级）、`:246–337`（动作入口）、`:395–629`（字段/确认页）；共用 `oneshot/v2/interaction.js:16–30` 已支持placeholder，不应将应用遗漏误认成组件不支持。

## 后续实测

本轮单点状态修正副本完整执行34项：16通过、18失败，唯一新增通过为REQ-6.2.1。原样本为15/34；不覆盖原成绩。证据：state-fix-score-delta.json及state-fix-full-suite-retry/。首次Docker context检查超时未执行任何业务用例，原失败记录仍在state-fix-full-suite/。
对Keep V1 Pro样本1调用原始openSidebar的真实隔离浏览器诊断已复现：调用前Notes链接可见、aria-expanded=true，调用后链接隐藏、aria-expanded=false。这是测试前提与链接实现冲突，不是判原业务通过；证据：keep-sidebar-causal/。
三个通用技能及加载/修复入口位于oneshot/skills/和oneshot/skill_repair.py；技能接线测试、真实网关和浏览器复验另记，不能与本表开发者人工诊断混为自动提分。

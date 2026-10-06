# 2026-10-07 通用性与合规审查

审查起点：`98754d21366dfc5f83bca3e34d480cde94916604`，本地分支 `feat/finals-clean`。它的父提交是 `main` 的 `2a83109`。下列分类表的行号**一律指清理前的这个起点**，可用 `git show 98754d2:<path>` 复核；运行路径表的行号指本次清理后的文件。审查覆盖指定的方言卡、主程序与测试生成提示、守卫及探针、全部骨架文件，并追踪其余打包模块的数据和执行路径。

## 判断

原包有可明确指出的评测耦合，不能对外描述成“所有规则都由需求或可访问性标准自然推出”。最明显的是全页角色/名称唯一、错误一律为 alert、关闭按钮一律叫 Close、用全局/顶部措辞推导每页 banner、强制原生选项进入可点击的 DOM，以及若干按特定业务形状猜测状态的诊断。官方报错可以暴露真实缺陷；报错出现过某个 locator，本身不构成产品约束。

清理保留明确的角色、名称、区域、单元格/行内控件、初始状态和业务步骤。需求位置守卫仍然执行，明确角色的检查反而更严格。相同名称、相同目标链接在**观测器**中去重保留；它不删除界面控件。源代码里未发现完整任务答案或按任务名分发的实现，但确有任务名、成绩和定位习惯进入包内注释，以及任务形状相关的局部规则，已删除或改写。

还有一个独立的真实边界缺陷：原 `generate()` 虽然不把 `.arc` 放入模型上下文，却通过整树 `copytree()` 遍历并复制其内容。本次已去掉这条路径。**本报告仍不是“运行时只能读两个目录、只能访问两个类别的网络”的安全证明**：执行生成代码没有 OS 文件系统/网络隔离，多个浏览器和 HTTP 路径也没有出站白名单。审查没有实际运行模型或官方评测，不能证明清理后的分数、泛化能力或赛事裁决结果。

## 近期提交来源复核

已核对起点的最近 12 条 log 及对应变更：`a424560` 将明确区域与无条件 alert/Close 混合；`9ba7fe9` 加入有价值的位置检查，也带入 global=header 推断；`7d7159a` 增加全页唯一和排他提示；`0d191a2` 把未声明角色压成 link/button；`2bb856d` 加入无条件菜单模式，并修复同目标观测路径重复；`98754d2` 的明确 cell/row 内控件规则保留。其余 6 条为合并或手交接/运行记录（`2a83109`、`e820054`、`36d942f`、`3e77ca9`、`c310179`、`e1b129d`），没有额外运行包规则。

还追溯了骨架历史：`171328e` 的 selectedcontent 改造及 `cb6aad7` 的 CSS/DOM 顺序。后者提交说明明确把 page-wide `.first()` 选中正确对象作为排序理由，足以把那段残留归为 C；本次判断不只是凭代码外观猜动机。

## 判据与来源

- **A**：约束来自本次输入的明确要求，包括必要的公开运行接口。分类为 A 不表示提取器能正确理解任意自然语言。
- **B**：即使没有评测，也有独立的可用性、可访问性、可维护性或验证价值。工具启发式不等于标准规定，也不等于功能正确。
- **C**：把评测/内部定位器、源文本形式或断言方便性当作产品约束。
- **D**：包内任务名、运行成绩/样例答案残留，或依赖某种任务专属命名、业务结构的规则。D 注释残留不等于已经证明使用了隐藏答案。

标准依据已在本次联网核对。APG 是模式指导，不能拿某个模式强迫所有同名口语概念都用该模式。

| 引用 | 与本审查有关的原则 |
|---|---|
| [APG Alert][alert]、[WCAG 4.1.3][status] | 通知方式应与紧迫程度和上下文相符，不能把所有验证文案强制变成 assertive alert。 |
| [APG Dialog][dialog] | 模态背景隔离、焦点管理、键盘和可见关闭入口有用户价值；没有要求固定英文名称 Close。 |
| [APG Menu Button][menu]、[Disclosure Navigation][disclosure] | 真正的 ARIA 命令菜单有完整角色及键盘契约；普通导航下拉可以使用链接。 |
| [APG Landmarks][landmarks] | 地标由内容功能决定；页面 header、main、navigation 各有含义，global 不自动等于 banner。 |
| [WCAG Labels][labels] | 字段需要合适的说明/标签；标签、placeholder、可访问名称不是可随意互换的同一件事。 |
| [HTML select][select]、[Playwright Locators][locators] | 原生控件已有值、标签与表单语义；定位应反映公开接口，不能反过来改造产品迎合定位。 |
| [Node uncaughtException][uncaught] | 吞掉未处理异常后继续运行并不是可靠的错误恢复。 |
| [Node vm][vm] | JS context 不是运行不可信代码的安全边界。 |

## 分类清单

本表共 146 组条目：A 37、B 77、C 26、D 6。同一约束在提示与执行器中的不同实现分别计数，不把条目数当质量指标。C/D 条目已按表中建议删除或改写。

相邻、相同依据与处置的句子合并为一行；混合规则拆行。`keep`、`rewrite principle`、`grounding question`、`delete` 分别对应保留、改写成带理由的原则、改写成需求核对问题、删除。

### 方言卡

| 文件:行 | 规则 | 类别 | 证据/理由 | 处置及一行理由 |
|---|---|---|---|---|
| `oneshot/dialect.md:3-5` | 需求决定角色、名字、属性、数据与流程；骨架不新增要求 | A | 明确绑定输入，禁止猜测评测惯例 | keep；保留权威来源。 |
| `oneshot/dialect.md:8-10` | GIVEN 登录状态、凭据来源；有账户不等于已登录 | A | 场景前置条件是行为的一部分 | keep；不偷换起点。 |
| `oneshot/dialect.md:11-12` | 从要求的起点到命名记录，不补父导航/确认 | A | 不得靠额外前置步骤掩盖缺失入口 | keep。 |
| `oneshot/dialect.md:13-14` | 有用的深链、相同显示名不抹掉不同记录 | B | 导航可达性和身份完整性 | keep；名称不是记录主键。 |
| `oneshot/dialect.md:17-19` | 区分种子、输入、示例和明确不存在的数据 | A | 不提前实现场景结果 | keep。 |
| `oneshot/dialect.md:19-20` | 两种可接受提示一律只能显示一个 | C | “或”不总是排他的；文字加标记可能帮助理解 | grounding question；核对是否明确要求排他。 |
| `oneshot/dialect.md:20-22` | 保留明确要求的文案和上下文 | A | 产品给出的文案约束 | keep。 |
| `oneshot/dialect.md:21-22` | 所有拒绝/验证用 alert，所有确认用 status | C | 把消息类别直接等同于固定 locator；标准没有这个全称命题 | rewrite principle；按紧迫性及上下文选择通知语义，明确角色仍优先。 |
| `oneshot/dialect.md:22-23` | 不加占位语料，只有要求的操作改变记录 | A | 不用种子/文案覆盖冒充状态变化 | keep。 |
| `oneshot/dialect.md:26-29` | 操作用按钮、导航用链接、搜索用搜索控件、合适的记录结构 | B | HTML 与 APG 的语义约定，未固定一种记录角色 | keep；降低交互歧义。 |
| `oneshot/dialect.md:30-31` | 分开遵循 label/placeholder，保留有意义的只读字段 | A | 明确说明优先；不推导未给的属性 | keep。 |
| `oneshot/dialect.md:32-35` | 相同词或重复操作不必删除；保留明确可访问名称 | B | 按上下文区分控件，装饰不应改变明确名称 | keep；与全页唯一规则相冲突时取消后者。 |
| `oneshot/dialect.md:36-37` | 明确位于某区域的控件放进该区域 | A | 位置是所描述交互的一部分 | keep；不删位置契约。 |
| `oneshot/dialect.md:37-38` | top/global/site-wide 一律为每页 banner | C | 可是全局侧栏或工具栏；地标与覆盖页面是两个维度 | grounding question；分别核对容器和适用页面。 |
| `oneshot/dialect.md:38-39` | 移动代替复制，全页 role/name 只出现一次 | C | 来自 strict locator 便利性；可伤害重复导航、分页操作 | rewrite principle；仅要求迁移时迁移，保留有用的独立入口。 |
| `oneshot/dialect.md:39-40` | 明确新增到 cell/row/record 的控件属于该元素 | A | 不只是同一操作在别处存在 | keep；最新提交中的这部分可辩护。 |
| `oneshot/dialect.md:42-46` | 按需要选择布局，不渲染 Header/Footer 等结构词 | B | 语义地标帮助导航，结构词填充没有内容价值 | keep。 |
| `oneshot/dialect.md:49-52` | 编辑入口与提交/取消手势按需求；保持输入 | A | 不把所有内容变成同一类编辑器 | keep。 |
| `oneshot/dialect.md:53` | 模态背景隔离 | B | APG Dialog | rewrite principle；说明隔离、焦点及退出路径的用户理由。 |
| `oneshot/dialect.md:53-54` | 留着的对话框必须有名为 Close 的按钮 | C | 标准要求可关闭，不要求这个固定名称 | rewrite principle；保留可见/键盘关闭途径，用需求名称或合适文案。 |
| `oneshot/dialect.md:54-59` | 弹层、字段选择器归所属容器；真实 ARIA 状态；不凭空加 title 后代 | A | 尊重声明和作用范围 | keep；补充命令菜单与普通披露导航的区别。 |
| `oneshot/dialect.md:62-64` | 真实状态变化、失败不变、身份及持久化一致 | A | 核心用户行为 | keep。 |
| `oneshot/dialect.md:65-67` | 骨架共享数据/session/ui 划分可按需求调整 | B | 明确所有权与生命周期，非强制领域模型 | keep。 |
| `oneshot/dialect.md:68-71` | 合理加载/错误状态，不破坏 click 序列与输入值 | B | 响应性、事件一致性 | keep。 |
| `oneshot/dialect.md:72-75` | 正常剪贴板、按工作流保持选择、原生键盘行为 | B | 与其他软件互操作，避免丢用户状态 | keep。 |
| `oneshot/dialect.md:76-85` | 错误隔离；需求高于自写测试；静态猜测只作线索 | B | 可恢复性及验证有效性 | keep；测试通过不等于官方或用户验收。 |

### 主程序与提示

| 文件:行 | 规则 | 类别 | 证据/理由 | 处置及一行理由 |
|---|---|---|---|---|
| `oneshot/main.py:6-7` | 把 dialect 定义为官方套件如何定位控件 | C | 对指导卡的目标定义就是 locator 适配 | rewrite principle；改为需求与可访问性指导。 |
| `oneshot/main.py:43-91` | 调用、成本、失败、时间预算，主模型/备用模型策略 | B | 有界成本与传输恢复有独立工程价值 | keep；不改数值，不宣称它们经本次性能验证。 |
| `oneshot/main.py:45-66,84-87` | 任务名、隐藏分数、分数指数解释预算与二套测试 | D | 任务结果不应随运行包传递给后续生成 | delete；保留机制，去掉包内成绩/任务叙事。 |
| `oneshot/main.py:114-123` | 两个 npm 入口、dist、PORT、静态资源及 health 接口 | A | 运行交付接口，不是隐藏业务断言 | keep；删除“否则全部零分”的表达。 |
| `oneshot/main.py:124-125` | 零依赖、原生前端、无 CDN | B | 离线和有限环境下的选定实现策略 | rewrite principle；写明离线理由，Node 标准库包含实际使用的 vm。 |
| `oneshot/main.py:126-130` | 数据作用域、完整文件、请求错误处理 | B | 避免跨访客污染、半文件及预期请求错误失控 | keep；异常隔离不等于吞掉进程级未知错误。 |
| `oneshot/main.py:131-140` | 精确 FILE framing、路径相对根 | B | 生成协议和可靠应用变更 | keep。 |
| `oneshot/main.py:142-148` | SYSTEM 按需求实现；禁止凭假想评测添加内容 | A | 全局提示以输入为准 | rewrite principle；以需求验证描述任务，保留禁止猜测。 |
| `oneshot/main.py:150-156,1398-1485` | CONTINUE/RESUME 仅续写缺失完整文件 | B | 中断恢复，不携带业务答案 | keep；清理失败成绩举例。 |
| `oneshot/main.py:158-166` | REPAIR 定点改动、完整新文件、保护已工作行为 | B | 减少无关重写和回归 | rewrite principle；明确重跑需求测试和既有行为，而非承诺任何失分都会被拒绝。 |
| `oneshot/main.py:383-512` | SSE 真响应、用量、失败及备用模型记账 | B | 真实可追踪，不伪造调用 | keep；任务名/隐藏分数注释删除。 |
| `oneshot/main.py:514-717` | 路径、完整块、唯一 SEARCH、交付文件验证 | B | 防越界写入与无效修补 | keep；移除任务结果举例。 |
| `oneshot/main.py:725-809,1143-1231` | 净化子进程环境、构建、启动、health、MIME/资源检查 | B | 真实加载链路 | keep；环境净化不是沙箱，见运行审查。 |
| `oneshot/main.py:815-845,871-907` | 从文案提取明确角色、首页列表、表单披露、按压状态及入口 | A | 名称/角色来自文本，不含固定任务答案 | keep；自然语言提取仍可能误判作用域。 |
| `oneshot/main.py:848-857,904-905` | Favorite false 推导空收藏；阅读页与草稿推导 Edit/Save 路径 | D | 固定业务词及未声明导航路径；emptyFavorites 在探针已无消费者 | delete；让输入场景决定路径与初始记录。 |
| `oneshot/main.py:846,858-870,903` | active/regular/deletable 等映射到 archived/deleted/pinned 字段 | D | 同一形容词不规定存储结构，regular 不必等于未收藏/未置顶 | delete；真实初始状态仍由需求测试与种子提示约束。 |
| `oneshot/main.py:910-1001` | jsdom 启动/异常/有界点击巡检 | B | 诊断未处理异常；不看官方测试 | rewrite principle；去掉 suite cascades 的说法，保留真实异常证据。 |
| `oneshot/main.py:1004-1006` | 根据 header/navigation/footer 单词强制地标的旧常量 | C | 已无调用；单词出现不等于当前页面需要地标 | delete；位置只走明确需求路径。 |
| `oneshot/main.py:1009-1058` | 未渲染文本便要求同步渲染、不得等待测试不能触发的事件 | C | 合法异步加载也能服务用户 | rewrite principle；诊断入口或加载状态，并由浏览器结果辨别 jsdom 限制。 |
| `oneshot/main.py:1063-1091` | scaffold route 表和公开路由引用的连通性诊断 | B | 未实现路由会令用户无法打开目标 | keep；动态分发表仍可能误报，不是通用路由证明。 |
| `oneshot/main.py:1094-1140` | 仅按提取声明启动语义浏览器探针 | A | 检查公开角色和实际交互；输出为 diagnostic | keep；没有声明不凭空检查任务。 |
| `oneshot/main.py:1234-1270` | 限制源码数/字节数，跳过 metadata，拒绝源码 symlink | B | 防止无界或非应用输入进入上下文 | keep；同时修复后续整树复制绕开过滤的问题。 |
| `oneshot/main.py:1273-1290` | 升级保留既有功能，只写变化；需求中的新位置/角色/名字优先 | A | 增量升级及明确变化 | keep。 |
| `oneshot/main.py:1293-1305` | 提供可调整骨架，骨架 JSON 是数据 | B | 重用通用设施，但不把骨架当需求 | keep。 |
| `oneshot/main.py:1308-1326` | readonly 会让 fill 超时，所以强制文本输入并另加 picker 按钮 | C | 未调用的旧函数仍打包；明显倒置产品/测试关系 | delete；保留实际需求里的只读字段。 |
| `oneshot/main.py:95-98,1329-1347` | 强制所有骨架符号、脚本文件继续存在 | C | 没有调用的 helper 可以删除；通过源码拼写惩罚合规替换 | delete；构建、浏览器和行为检查负责验证可用性。 |
| `oneshot/main.py:1350-1374` | 只发布不同的应用文件，逐文件临时写入再替换 | A | 符合增量交付，不碰 runner 持续写入文件 | keep；多文件改名并非整体事务。 |
| `oneshot/main.py:1488-1501` | 需求、prerequisites、种子清单与源码组成 draft context | A | 没有报告或官方测试输入参数 | keep。 |
| `oneshot/main.py:1526-1529` | 整树复制模板，包括 .arc | B | 原意是保留文件，实际越过声明的数据边界 | delete；从已过滤的快照建 stage，原目录保留 metadata。 |
| `oneshot/main.py:1602-1681,1826-1861` | 引号词索引与缺失词诊断 | B | 可提示遗漏，但引号形式不能证明种子/必需文案 | rewrite principle；删“所有引号都会被逐字匹配”的注释；继续只作诊断。 |
| `oneshot/main.py:1684-1743` | 明确 GIVEN seed 语句清单，名字和事实来自输入 | A | 不内置账号、名称或最终结果 | keep。 |
| `oneshot/main.py:1746-1774,1887-1944` | 明确控制名、aria-label 覆盖、源码可能改名、词碰撞不定罪 | B | 粗略静态线索，judge 已不据此判改名失败 | keep；删除过时示例和未使用词碰撞工具。 |
| `oneshot/main.py:1777-1823` | 名称必须是完整源码 token/独立文本以匹配 /^Name$/i | C | 无法识别运行时拼接，且把定位器正则当产品要求 | delete；该未用函数也不再进包。 |
| `oneshot/main.py:1947-1963,2202-2208` | 必须注册吞异常处理器，否则扣分/否决修复 | C | 为避免后续测试连接失败维持未知状态，违背 Node 异常恢复建议 | delete；请求级 try/catch 保留，static 字段保留空兼容形状。 |
| `oneshot/main.py:2017-2199` | 可选源码反例、独立二套检查、修正测试作者错误、失败回退 | B | 检查本地生成行为和需求的一致性 | keep；升级默认不跑源码评审，第二套默认关闭。 |
| `oneshot/main.py:2211-2382` | assess/repair_request 的实际错误、依赖优先、已通过项、需求权威 | B | 可复现的修复输入；未声称自测就是官方分数 | keep；明确位置仍进入修复。 |
| `oneshot/main.py:2400-2522` | 对比固定本地检查、有限净收益、完整序列复查、保留基线 veto | B | 搜索策略无任务分支；3:1 是工程取舍而非正确性定理 | keep；删隐藏分数和评测顺序的证明话术，说明本地共享状态理由。 |
| `oneshot/main.py:2540-2549,2572-2817` | SEARCH/语法/回归 follow-up；失败回滚；有界重试 | B | 定点故障恢复 | keep。 |
| `oneshot/main.py:2836-2912` | CLI 输入、默认原地模板、非空模型产物、真实 trace | A | 运行接口及真实调用记录 | keep；运行边界例外见下表。 |

### 测试生成器

| 文件:行 | 规则 | 类别 | 证据/理由 | 处置及一行理由 |
|---|---|---|---|---|
| `oneshot/testgen.py:34-50` | 分组、单 worker、有界等待、固定依赖版本 | B | 控制成本、可重现及避免并发污染 | keep；删除用任务分数、Spearman 等解释机制的注释。 |
| `oneshot/testgen.py:52-55` | 作者只见需求，名字和值需有来源 | A | 防止从实现倒写断言 | keep。 |
| `oneshot/testgen.py:58-63` | CommonJS、baseURL、时间、clipboard 权限 | B | 本地执行器协议与必要功能权限 | keep。 |
| `oneshot/testgen.py:64-79` | 按 GIVEN 建状态，未给可行设置则跳过；不替换种子或偷偷登录 | A | 与原场景保持相同起点 | keep；跳过标记为未判断，不能当通过。 |
| `oneshot/testgen.py:70-73,98-111` | 新记录隔离、单后端序列、完成断言后再恢复共享前置条件 | B | 防测试间污染；明确种子仍保持原身份 | keep。 |
| `oneshot/testgen.py:80-83` | 优先角色/标签/文本 | B | 用户感知接口、Playwright 官方指导 | rewrite principle；解释稳定性理由，不声称模拟隐藏定位器。 |
| `oneshot/testgen.py:81-86` | 任何文字都 exact；全面禁 CSS/id；top/global/banner、sidebar/complementary 固定映射 | C | 未声明的名称精度和布局语义也被强制；可能拒绝需求明确给出的 id | grounding question；精度、角色和容器只按声明，避免猜测 DOM。 |
| `oneshot/testgen.py:83-88` | 明确命名容器及新增 cell/row/record 内控件先 scope | A | 要求涉及谁和在哪里 | keep；去掉把任何 cell 例子固定写为 gridcell 的暗示。 |
| `oneshot/testgen.py:89-92` | 一律菜单按钮/menuitem；其余角色不明控件只许 link/button | C | 口语 menu 可能是导航披露；也存在原生选择器等合理控件 | rewrite principle；仅明确 ARIA 菜单强制该模式，其余允许语义相符选择。 |
| `oneshot/testgen.py:93` | 所有错误在 alert 内断言 | C | 直接编码官方 locator 习惯 | grounding question；未声明角色就验证规定上下文中的可见消息。 |
| `oneshot/testgen.py:94-97` | 明确指定的点击选择路径不能被另一路径替换 | A | 手势本身若被要求，就是行为契约 | keep。 |
| `oneshot/testgen.py:94-97` | 未明确说 native select 便不允许 selectOption | C | “选择”不等于自定义 DOM option | rewrite principle；尊重原生或自定义实现，只在手势明确时强制。 |
| `oneshot/testgen.py:112-120` | 覆盖描述中的变体、组合、边界、失败及等价路径 | A | 从要求而非分数推导覆盖 | keep；举例改为跨领域状态/权限，避免暗示特定题型。 |
| `oneshot/testgen.py:122-133,153-185` | 每场景一个测试、固定标题协议、WHEN/THEN 顺序、刷新重开再断言 | A | 追溯到输入场景；文件 framing 是执行协议 | keep。 |
| `oneshot/testgen.py:188-268` | 明确匿名首页首动作的额外入口检查 | A | 名字必须来自首 WHEN；未知起点跳过 | keep；存在性检查不能证明完整导航行为。 |
| `oneshot/testgen.py:290-460` | 修 Markdown fence、无 await helper、page fixture、标题分配 | B | 修的是测试作者的机械错误，不是删业务断言 | keep；去掉任务名/隐藏分数注释。 |
| `oneshot/testgen.py:462-525` | 完整 writer 才接入，Light 默认关闭 | B | 防止辅助检查掩盖写测试失败 | keep。 |
| `oneshot/testgen.py:528-704` | AUDIT 限额、逐字需求出处、只追加测试、禁止改既有断言 | A | 新检查必须解释其需求来源 | keep。 |
| `oneshot/testgen.py:706-813` | FIX 仅修测试自身错误，保留场景/断言数/次序，无新增 skip | B | 防止靠削弱测试“修复” | keep；断言计数本身仍不足以证明语义等价。 |
| `oneshot/testgen.py:822-900` | 固定 Playwright、自己的报告/逐条进度、只运行自己的 spec | B | 可复现的本地反馈 | keep；runtime 依赖不是官方测试输入。 |
| `oneshot/testgen.py:915-924` | 任意 A1 形式名字都不算捏造 | C | 非表格需求中也会放行无来源名字 | grounding question；仅需求已经建立 cell 与 A1 坐标约定时允许。 |
| `oneshot/testgen.py:925-927` | 出现一个编号名字就允许同前缀其它编号 | C | 存在 Item1 不表示 Item2 应存在 | grounding question；需求必须声明顺序命名/编号约定。 |
| `oneshot/testgen.py:903-929,932-1083` | 引号/占位词来源、错误分类、受限 page snapshot、共享 helper 归并 | B | 检查作者错误与应用失败分开 | keep；词语来源不是断言有效性的充分证明。 |
| `oneshot/testgen.py:1087-1283` | 独立应用副本、本地套件执行/卸载失败文件/CLI | B | 有界诊断及日志追溯 | keep；无 OS 沙箱，不做安全保证。 |

### 保留行为守卫及浏览器探针

| 文件:行 | 规则 | 类别 | 证据/理由 | 处置及一行理由 |
|---|---|---|---|---|
| `oneshot/regression_guard.py:25-53` | 深度/时间/屏数上限、两遍交集、不可变基线 | B | 降低动态噪声；可重复观测的最低门槛 | keep；不是功能覆盖证明。 |
| `oneshot/regression_guard.py:56-97` | CHANGE/改名/删除提及项、容器或路径时豁免 | A | 尽量不与明确变化冲突 | keep；仅“提及”也可能过宽，列为剩余风险。 |
| `oneshot/regression_guard.py:100-108` | 空白大小写归一、导航 link/button 等兼容 | B | 表面身份连续性，不把微小表现变化当删除 | keep；不用于弱化明确要求的角色。 |
| `oneshot/regression_guard.py:110-139` | 选择器保留选项、要求中的新名称与目标/词证据、日期变化 | A | 只有需求相关变化和观测到的身份线索才能解释替换 | keep；英文日期/词重叠均为有损启发式。 |
| `oneshot/regression_guard.py:142-179` | 提取“命名角色在明确区域” | A | 直接携带原句，无固定控件名 | keep；top navigation 按 navigation 解释，不再冒充 banner。 |
| `oneshot/regression_guard.py:180-187` | 有 top/global/site-wide 就推断每页 banner | C | 可在没有 header 声明时新增产品要求 | grounding question；现在必须同时有明确区域，global 只决定覆盖面。 |
| `oneshot/regression_guard.py:190-193` | 明确位置也接受角色互换、大小写互换 | B | 继承自粗粒度保留检查的便利，但会放过违反明确契约的实现 | rewrite principle；对明确位置使用原角色和名称，强化 A。 |
| `oneshot/regression_guard.py:196-218` | 位置缺失产生修复输入，已满足位置参与后续保护 | A | 新行为缺失与已有位置回退均可发现 | keep；全局明确位置现在在全部已观察页面检查，缺地标也不漏掉。 |
| `oneshot/regression_guard.py:219-220` | 修位置之后同名同角色另一份必须删掉 | C | 再次引入全页唯一 locator 偏好 | rewrite principle；除非需求要求迁移/删除，否则保留有用入口。 |
| `oneshot/regression_guard.py:223-273` | 保留/缺失/豁免/未知分开；旧路径、重命名和可见迁移证据 | B | 不把没看到当看到，也不把所有添加当损失 | keep。 |
| `oneshot/regression_guard.py:276-386` | 查运行时、隔离副本、重启后端、超时清理、基线并行 | B | 有界观测与输入保全 | keep；补充点文件过滤，注释改称依赖目录。 |
| `oneshot/regression_guard.py:389-446` | 起点副本、历史 trace、独立 CLI | B | 让 guard 可审计 | keep；独立 CLI 的输入仍由调用者授权。 |
| `oneshot/regression_probe.cjs:4-18` | 通用角色集、可疑写操作词、同源路径 | B | 浏览可见表面时减少副作用 | keep；黑名单词不能证明无副作用。 |
| `oneshot/regression_probe.cjs:20-73` | AX 名称、作用域、地标、命名列表和可观察选项 | B | 面向公开 UI 的库存，不含任务专名 | keep；按 role/name 合并仍会丢失不同记录身份细节。 |
| `oneshot/regression_probe.cjs:74-90` | 只跟可声明目的地/有 aria-controls 的 tab | B | 有界、较保守的导航发现 | keep；直接 goto 不证明原点击 handler 正确。 |
| `oneshot/regression_probe.cjs:92-103` | 同名同目标链接合成一个观测路径 | B | 防止因为重复导航而完全拒绝访问同一页；没有改产品 DOM | keep；不同目标仍不猜，data-nav 重复仍可能无法唯一点击。 |
| `oneshot/regression_probe.cjs:106-161` | 有限 hover 揭示迁移、打开选择器观察选项 | B | 通过实际 UI 找迁移证据 | keep；不凭猜测填业务值。 |
| `oneshot/regression_probe.cjs:163-187` | 新 context、固定 viewport/UTC、拦非本地 HTTP 和非 GET/HEAD | B | 重复性和减少变更 | keep；不等于整个进程出网受限。 |
| `oneshot/regression_probe.cjs:195-241` | 重找公开目的地、同目的地改名、无法唯一选择标未知 | B | 旧路径与新 UI 可以比较 | keep。 |
| `oneshot/regression_probe.cjs:246-267` | 导航/执行器错误分开、真实 page error 与耗时 | B | 对缺失与未判断保留证据边界 | keep。 |

### 全部骨架

| 文件:行 | 规则/行为 | 类别 | 证据/理由 | 处置及一行理由 |
|---|---|---|---|---|
| `oneshot/scaffold/README.md:3-25` | 所有 primitive 均为可适配工具，表面特征不自动是缺陷 | B | 不把骨架提升为规格 | keep；native select 说明同步更新。 |
| `oneshot/scaffold/frontend/package.json:1-6`、`backend/package.json:1-6` | 静态复制构建与 Node 启动 | A | 交付接口 | keep；无内置产品依赖。 |
| `oneshot/scaffold/backend/server.js:1-9,14-35` | 静态目录、seed.js 加载、共享内存数据 | B | 通用离线示例基础设施 | keep；不是生产级存储/认证设计。 |
| `oneshot/scaffold/backend/server.js:11-12` | 未处理异常只记录后继续运行 | C | 原 static gate 明确为防后续测试断连而要求；Node 不建议如此恢复 | delete；预期请求错误仍由局部 try/catch 处理。 |
| `oneshot/scaffold/backend/server.js:38-86` | JSON API、状态读写、health、资源服务、请求级错误边界 | B | 真实可运行骨架，无任务回答 | keep；通用状态 API 无鉴权、seed 加载失败仍会返回 health 200、路径校验/持久化有限，未宣称可生产使用。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:6-55` | 共享状态、session/local 分离、save/pull、转义与随机 id | B | 状态作用域与安全插值有用户价值 | keep；同步 XHR、全量 PUT/丢失更新属于已知通用性局限。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:57-68` | hash 路由，导航时更新共享状态/视图 | B | 可重复的应用导航 | keep。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:70-78,80-91` | 可选布局、语义链接/按钮、account 和 currentUser | B | 没有强制所有区域或同名 logo 双控件 | keep。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:79` | 自动合并相同 sidebar 配置项 | C | 渲染器隐式删除作者配置，延续唯一定位器倾向 | delete；忠实渲染配置，重复是否有用由产品决定。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:93-119` | 延迟 press 中的 render、popover 不改变宿主选择 | B | 真实 click/double-click 和范围操作不应丢失 | rewrite principle；删任务样本数/场景叙事，保留事件理由。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:122-140` | APP 组件共享 helper，保留各自 own 方法 | B | 降低组件调用不一致 | rewrite principle；只描述实际接口。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:142-159` | 重建视图、afterRender、对话框仍隔离背景 | B | 确定性视图更新 | keep；删不存在的 preserveInputs 保证。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:160-162` | 因 Playwright 忽略 aria-modal 而隐藏外部文本框 | C | 注释只解释 fill locator 的内部行为 | rewrite principle；以 APG 模态背景隔离解释保留 inert 行为。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:163-187` | 命名 dialog、初始焦点、inert/aria-hidden、空闲隐藏 | B | 独立的模态可用性价值 | keep；加 aria-modal 与实际隔离一致，未补齐整个 APG 焦点循环。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:189-220` | contextual host、记录 id、可选 menu 角色、完成后关闭 | B | 保持动作所属记录和可见状态一致 | rewrite principle；去掉 PenCopyCutPaste 等任务形状示例。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:222-263` | 全局改造 select 样式与 option 可见性、加 selectedcontent 文本 | C | 已有原生值/视觉显示；额外结构主要迎合文本及 option locator | delete；不再重写普通 select。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:264-277` | 有 label/value/options/change 的原生 select helper | B | 原生键盘、可访问值、表单提交 | keep；回调单独保留，不依赖 DOM 改造。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:279-317,429-430,442,482` | 旧自绘 combobox 的 option DOM 和 dispatcher | C | 当前 helper 已输出 native select；遗留代码只服务旧可点击 option 约定 | delete；移除已无生成调用方的旧路径。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:319-403` | 剪贴板事件、外部文本、结构数据、权限失败时自身副本 | B | 对真实剪贴板和多项选择有用 | keep；400ms/自身副本回退有陈旧数据风险，不是完整剪贴板语义保证。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:405-414` | 默认非紧急 status 通知、可选 Undo、超时 | B | 用户反馈和撤销价值 | keep；应用必须为重要消息另行配置可访问处理。 |
| `oneshot/scaffold/frontend/public/lib/arc.js:416-491` | 记录动作、事件代理、原生控件默认行为、hashchange | B | 真实动作和记录身份；不取消 checkbox 原生激活 | keep；popover/选择相关注释仅留通用理由。 |
| `oneshot/scaffold/frontend/public/app.js:1-75` | 明确待替换的 Home/Items/login/CRUD 演示 | B | 通用示例，不是比赛任务实现 | keep；示例认证不等于生产认证。 |
| `oneshot/scaffold/frontend/public/seed.js:1-8` | 明确待替换的 Demo User 和 First item | B | 示例占位数据不按任务分发，也不是任务种子答案 | keep；提示继续要求只初始化输入声明的真实记录。 |
| `oneshot/scaffold/frontend/public/index.html:1-20` | HTML/viewport、应用/空闲弹层根、脚本次序 | B | 启动与输入命中基础设施 | keep。 |
| `oneshot/scaffold/frontend/public/styles.css:1-34` | 简单排版、空闲弹层隐藏、记录动作 hover/focus、控件样式 | B | 通用展示；hover-only 操作的键盘/触屏可达性仍有限 | keep；移除旧自绘 listbox 无消费者的样式。 |
| `oneshot/scaffold/frontend/public/styles.css:12` | sidebar order:-1 | C | 当前 DOM 已是侧栏在前；cb6aad7 的提交明确为 page-wide .first() 调整顺序；当前为多余残留 | delete；不改变当前视觉/DOM 顺序。 |

### 沿运行路径发现的附加项

| 文件:行 | 规则 | 类别 | 证据/理由 | 处置及一行理由 |
|---|---|---|---|---|
| `oneshot/semantic_probe.cjs:9-28` | 递归搜 SEED 并用 archived/isarchived 等字段别名判初态 | D | 假定某类业务存储模型，不是用户可观察契约 | delete；与主程序的 seedStates 一起删。 |
| `oneshot/semantic_probe.cjs:164-168,178-186,201-225` | 固定 Edit/Save、草稿阅读页优先遍历 | D | 名称和入口未从该动作声明中提取 | delete/rewrite principle；披露入口只用已提取的 entryAction。 |
| `oneshot/semantic_probe.cjs:30-163,170-177,188-200,226-320` | 声明角色/表单/切换状态、真实异常、有限事件巡检 | B | 诊断已有公开 UI，不修改接受分数 | keep；随删除旧合同清除失效分支。 |
| `oneshot/scenarios.py:1276-1281,1455-1469,1732-1764` | 用“单词 + 1.2.3”标签形状推导实体类型和种子替换 | D | 把编号语料样式当实体 schema；普通命名记录不能泛化 | rewrite principle；类型改由输入的种子实体名词或明确列表/详情范围提取。 |
| `oneshot/scenarios.py:1-13,416-1273,1318-1833` | 有限文法、声明依赖、作用域、前置状态与 THEN 编译 | A | 参数和步骤来自需求；不能理解的部分标 unparsed | keep；前置状态/词干匹配仍是启发式，并非形式化证明。 |
| `oneshot/scenario_translate.py:66-131,416-524` | 给无法解析场景做需求限定翻译、逐字名称/角色/状态验证 | A | 没有任务答案或隐藏测试输入 | keep；未知语义仍有模型和提取误判风险。 |
| `oneshot/scenario_translate.py:543-639` | 需求 hash、版本和模型维度的翻译缓存 | B | 降低重复调用，保留真实提示和回复 | keep；外部缓存路径/污染风险列入运行审查。 |
| `oneshot/scenario_check.cjs:50-198,277-550` | 可感知 locator 候选、有作用域时优先、真实浏览器执行 | B | 自有诊断器，不把候选顺序反写为产品 DOM 顺序 | keep；有损定位和部分 first 选择不构成隐藏定位器适配的证明。 |
| `oneshot/light_tests.py:15-306` | 默认关闭的精确需求句式编译器 | A | literal 名字/范围/顺序/唯一性取自句子，无固定答案；不支持则交回 writer | keep；移除“拷贝公开测试 helper”的包内说明，原始来源在此保留。只适用于该明确文法，不声称一般自然语言覆盖。 |
| `oneshot/source_contracts.py:21-82,85-361`、`oneshot/contract_bindings.cjs:1-77`、`oneshot/contract_runner.cjs:1-89` | 需求出处与实际源码绑定的局部反例、前置条件、函数/断言计数 | B | 验证真实状态规则，避免重写被测决策；升级默认关 | keep；vm 限制不是安全隔离。 |
| `scripts/package_oneshot.py:12-27,30-80` | 显式根文件列表、骨架文件打包、哈希/确定性 ZIP | B | 可复现交接，测试、报告、平台 CLI 不进包 | keep；骨架子树是枚举而非逐文件 allowlist，新增文件仍需复审。 |

## 运行合规审查

以下行号指清理后的源文件。区分“静态代码确实这样走”与“在任何生成代码/环境下都无法越界”。

| 检查项 | 实际路径及证据 | 结论 |
|---|---|---|
| 任务输入 | `oneshot/main.py:2582` CLI 读取输入目录的 requirements.yaml 与 prerequisites.md；`main.py:2627` 默认把已存在 output 识别为模板 | 默认业务输入来自用户给出的两个目录。独立 `--template-dir` 和各诊断 CLI 仍允许调用者指定第三个输入；要求文件的 symlink 未单独拒绝，不能作绝对目录隔离声明。 |
| 提供给模型的应用文件 | `main.py:1158` 排除根 requirements、任何点路径和构建/缓存目录；`main.py:1165` 有界读取并拒绝源码 symlink；`main.py:1365` 组装 draft context | 不将 .arc 内容送入标准 draft prompt。它仍是应用文件过滤器，不是“识别任意伪装官方测试”的分类器；需可信输入布局。 |
| .arc 的真实读取 | 原 `main.py:1529` 整树 copytree；现 `main.py:1403` 只写 snapshot 文件；`scenario_check.py:119-144`、`regression_guard.py:391-404` 过滤点路径 | **原代码不满足“从不读取 .arc 内容”**。合成文件/遍历哨兵复现失败，修复后原地升级通过且原目录 metadata 保留。没有读取真实组织者报告来做这个测试。 |
| 输出写入 | `main.py:494` resolve_path；`main.py:2329` opaque 路径拒绝；`main.py:1232` changed-only publish | 应用发布不覆盖整个输出目录，不写 requirements/.arc。普通生成代码自身的 I/O 不受这些 Python 函数限制。 |
| 自写测试及反馈来源 | `testgen.py:169` 只给 requirements/prerequisites；`testgen.py:450` 写临时 suite；`testgen.py:1070` 自有 report；`testgen.py:965` attachment 限当前 report 根 | 没有发现打开组织者未公开 spec、playwright-report.json 或从平台抓测试的代码。自测报告是本次生成的报告，不能与组织者 `.arc` 报告混称。 |
| 独立观测器 | `regression_probe.cjs:20` AX/DOM、`:174-187` 当前本地应用 HTTP、`:195-258` 观测轨迹 | 读取应用的公开运行表面，无评测输入。该拦截只涵盖此观测 context 的 HTTP 请求，不覆盖整个 Node/浏览器/后端进程。 |
| 源码反例 | `source_contracts.py:85-113` 限应用 JS；`contract_runner.cjs:18` vm context | 没有官方 oracle 输入。但可执行生成代码仍需外部隔离，Node 明示 vm 不是安全机制。 |
| 模型网络 | `main.py:175` 拒绝 gateway redirect；`main.py:367` POST 到配置的 base/chat/completions；`scenario_translate.py:206-247` 同类请求和拒绝跳转 | 默认为组织者网关，未发现第二套平台抓取客户端。但 OPENAI_BASE_URL 可配置，并无代码内 host 白名单；审批后的环境配置是前提。 |
| 工具下载 | `main.py:945,1018` jsdom/Playwright/Chromium；`testgen.py:808` @playwright/test；`regression_guard.py:282` Playwright/Chromium；`scenario_check.py:364-388` runtime；`source_contracts.py:117` Acorn | 除 npm registry 外，Chromium 安装还可能访问浏览器下载 CDN；npm 配置也可能改变 registry。因此“仅网关与包仓库”按字面不成立。 |
| 其余网络 | `main.py:705`、`scenario_check.py:75` loopback opener 未禁止 HTTP redirect；`main.py:853` jsdom 的 fetch/resources；`semantic_probe.cjs` context；`scenario_check.cjs` context；`testgen.py:834` Playwright config | 起始地址为本地不等于后续请求只能本地。应用资源、脚本、测试代码、重定向都可能触发外网访问；除 guard 外未统一设置出站拦截。 |
| 进程/文件权限 | `main.py:699`、`scenario_check.py:51` 去掉模型凭据和代理，但保留 HOME/PATH；`:159,229` 执行生成的构建/后端；`testgen.py` 执行模型生成 CJS | **没有 OS sandbox/chroot/namespace/egress enforcement。** 同 UID 子进程仍可能访问原输出、HOME 或其他文件；本次没有做越界利用验证，也不宣称已全面修复。 |
| 辅助读文件 | 包自身文件、node_modules、`scenario_translate.py:543` 外部缓存、自己的临时 suite/report、`main.py:2028` 翻译 trace | 字面“只读需求和应用目录”需明确豁免自身代码、依赖和自有产物。SCENARIO_CACHE_DIR 可配置，缓存可被预填；它不是跨运行隔离的证明。 |
| 单模型声明 | `main.py:36-42,356` 默认 DeepSeek + Kimi fallback；`scenario_translate.py:550` SCENARIO_MODEL 可单独配置 | 包的默认设计并非严格只有一个模型。对外可以说“同一生成/测试/修复架构”，若说“只用 DeepSeek”须有实际配置与 trace 支持。 |
| 推测隐藏测试 | 清理前 locator/注释见 C/D 行；清理后业务值来自需求、输入源码和本地观测 | 没发现下载/读取隐藏测试的主动逻辑；这不能反推过去每次运行从未受隐藏信息影响，也不能排除环境或生成代码越界。 |

因此可辩护的合规结论是：删除了本次识别的包内评测耦合，并修复已复现的 metadata 复制问题；默认设计不以组织者测试为输入。**不能给“技术上不可能读取隐藏测试或访问其他网络”的认证**。正式运行的进程隔离、只读挂载、依赖预装和出站策略需要由平台/运行环境的实际证据补齐；本次未获授权也未尝试平台改动。

## 补丁与行为范围

1. **metadata 边界**：从过滤后的源码快照建 stage，浏览器副本排除点路径。原地模式中 `.arc`、root requirements、原有 dist/metadata 保留在原目录；独立 `--template-dir` 导出现在只带应用源码，不再带原模板的点文件、缓存或旧 dist。需要这些文件的应用属于已暴露的兼容性边界，不以偷偷读取 metadata 作补偿。
2. **需求指导**：去掉固定 alert/Close、全页唯一、排他提示和 global=header；精确 cell/row/region 位置继续保留。菜单及选择器使用条件化的标准原则。生成测试优先用户感知的接口，但不让未声明的 locator 成为产品规格。
3. **守卫**：明确区域和明确角色继续检查；navigation 不冒充 banner；每页明确位置在所有已观察页面验证。删除“删掉另一份控件”的修复指令。同名同目标**观测路径**去重不改。
4. **诊断**：去掉未调用的 readonly/源码 exact-name gate，以及强制骨架符号/进程吞异常 gate。移除收藏/草稿阅读/固定状态字段探针。词表和可能改名仍是诊断，业务要求仍走原有浏览器检查。编号形状的实体类型推断改成输入中的实体声明/范围；无编号名称也能通过同一合成工作流。
5. **骨架**：取消隐式 sidebar 删除、全局 select 改造和旧自绘 selector 路径；保留原生 select 的标签、值、change 回调、表单提交。模态行为注明用户理由并补 aria-modal。删全局吞异常，保留请求边界 catch。去掉无效 CSS 顺序规则和已不用的 listbox 样式。
6. **注释与说明**：删除包内任务名/成绩/内部 locator 的解释，保留协议、接口、数据所有权和可观察失败的事实。历史报告/提交没有改写；这个分类表保留原规则及来源，清理不是抹去演化历史。

不改公开需求、不改组织者测试、不增加模型调用、不改预算或默认实验开关。不自动重写起点应用内已有的旧骨架；输入产物仍可能携带早期机制，这是增量升级与新包清理的范围区别。

## 验证与测试变更

指定命令已完成：**327 项，OK，跳过 3 项，260.103 秒**。跳过不是通过。日志保留在本 worktree 的 `runs/generalization-audit/oneshot-tests.log`。项目要求的 legacy 命令也完成：**226 项，OK，跳过 12 项，68.880 秒**，日志 `runs/generalization-audit/legacy-tests.log`。单独骨架为 11 项通过，实体解析为 18 项通过，升级为 18 项通过。最后仅作了不改变行为的模块说明和本报告更新。

```sh
NODE_PATH=/var/folders/j8/60kxyby16mzdsdsy73k7w4bc0000gn/T/oneshot-playwright-test-1.57.0/node_modules ~/projects/volo-factory/.venv/bin/python -m unittest discover -s tests_oneshot
~/projects/volo-factory/.venv/bin/python -m unittest discover -s tests -v
```

已使用本机现有 Playwright 1.57.0、Chromium headless shell 与 jsdom，没有为完成检查补装工具依赖。测试中的模型响应都是合成 transport fixture；没有真实 LLM 网关调用、ARC-Bench key 使用、上传或推送。没有读取用户禁止的本地隐藏测试目录。真实模型生成、官方评分、代理评分和费用消融均未运行。

标准套件跳过的 3 项都是 `test_scenario_check.ScenarioCheckEndToEnd`：可用性装饰器检查完整 Chromium executablePath，而本机只有可启动的 headless shell。确认同一环境能启动该 runtime 后，一次性运行这 3 项**未改变的原始断言**（只在内存中取消 class 的 skip 标记，未改测试文件或权限）：**3 项通过，55.694 秒**，日志 `runs/generalization-audit/scenario-headless-tests.log`。该补跑关闭场景模型翻译，只使用本地合成应用。

已构建本地包 `runs/generalization-audit/oneshot-clean.zip`，24 个文件、563518 bytes；与打包清单一致，定向任务名/旧定位残留扫描为零。SHA-256：`240b6b8d8a3732964b141d6227522ca8199811b7c47df23e7d6af6a04e71c65a`。源码提交为 `ac4bcdc`，包旁保留逐文件 manifest。打包成功不是生成质量或分数结果。摘要证据见 [generalization-audit.json](../evidence/2026-10-07-generalization-audit.json)。

本地代码提交：

- `d89d194`：不遍历/复制 runner metadata。
- `5652e9c`：需求指导、位置和诊断清理。
- `b395343`：保留原生控件和完整导航配置。
- `ac4bcdc`：实体类型按需求上下文推导。

测试调整只涉及本次明确取消/改写的规则：

- `test_regression_guard.py`：全局搜索样例现在明确写 page header；补反例证明 global 单独不能推导 header、明确 link 不能被 button 替代、其它页面完全没有地标也能报缺失。既有业务保护测试保留。
- `test_oneshot.py`、`test_smoke.py`：移除对未调用源码 exact-name 算法的断言；不再要求可工作的应用保留无用骨架、吞掉未处理异常。构建/语法/真实回归、收益判据等测试保留。
- `test_semantic_probe.py`：取消从 Favorite/草稿/形容词强行推导缺省状态及内部字段的断言；明确角色、表单披露、切换状态仍覆盖。
- `test_testgen.py`：反例约束 cell 坐标与编号自动扩展必须由输入建立约定。
- `test_scaffold_controls.py`：从隐式删重复 sidebar 改为完整保留配置。
- `test_scaffold_combobox.py`：取消“闭合 option 为零”“DOM 文本必须能 getByText”“原生 select 必须被改造成可点击 option”的断言；保留/验证标签、可访问值、选择回调、Tab 导航、键盘提交、普通 select、dialog 和 popover 内的选择/表单行为。
- `test_scenarios.py`：同一需求工作流把编号名称换为 Atrium/North studio，验证类型不再靠数字后缀猜。
- `test_evolution.py`：新增合成 `.arc` 遍历哨兵；在旧代码上复现失败，在修复上通过。原日志 inode/并发写入/不变应用文件等测试未减弱。

首轮完整 one-shot 为 327 项、4 个失败、3 个跳过。3 个失败断言的是已取消规则；另一个是新增的原生 picker 箭头键假设，在当前 Chromium/macOS 不成立。没有为此改产品迎合断言，改用已有的原生选择 API，以及可重复的 Tab/Enter 表单路径验证。修正后单独的骨架 11 项通过。

## 掉分风险与消融交接

这些是基于用户提供的官方失败行为及本仓库历史记录的**风险推断**，不是本次观察到的掉分。排名由可触发的前置失败影响估计。

| 优先级 | 取消的捷径 | 官方行为可能如何失配 | 应看的独立用户证据 |
|---|---|---|---|
| 高 | 错误一律 alert | 若只按 role=alert 查错误，而需求只要求可见消息，合规 inline error/status 也可能失分 | 错误是否可见、与字段相关、读屏可获知；不凭此追加未声明角色。 |
| 高 | global/top 推导 banner | 官方从 header searchbox 进入后续仓库；只有 global 文字时新提示可能选其它全局容器 | 输入是否确实规定 page header；明确规定的 header 搜索仍由 guard 保护。 |
| 高 | 全页唯一、复制后删另一份 | 官方未 scope 的 strict locator 可能遇到多个合法入口 | 需求规定区域内的入口是否可用；main 内登录链接的明确位置仍保留。 |
| 高 | 一律 menu/menuitem | 合法导航 disclosure 可能不满足官方 menuitem 查询 | 是完整命令菜单还是普通导航；键盘和实际命令是否正常。 |
| 中 | 固定 Close 字样 | 官方通过 Close 退出时，合理的 Done/Cancel 会失配 | 需求是否指定该名称；用户是否有清楚可见及键盘退出途径。 |
| 中 | 提示替代项必须二选一 | 同时出现文字和图标可能触发计数/唯一文本断言 | 需求是否明确排他；两种提示是否真正重复或互相矛盾。 |
| 中 | 全局原生 select 改造 | 文本定位当前值、直接 click DOM option 的测试可能失效 | 原生选择、可访问值、标签、键盘/表单是否正确；明确手势需求另行实现。 |
| 中 | 强制骨架符号/进程吞异常 | 不完整重写或异步未知异常可能更早暴露为运行失败 | 构建、页面、业务流程及异常恢复；不以吞异常掩盖错误。 |
| 低至中 | 草稿/收藏/内部 seed 字段及数字名称探针 | 失去与旧题型高度贴合的额外诊断；fallback 覆盖/调用费用可能变化 | 任意命名实体上的前置状态和真实行为，不依赖内部属性拼写。 |
| 兼容性 | 不复制 metadata/旧构建/依赖缓存 | 若起点实际依赖被排除配置，stage 构建可能失败 | 查应用明确依赖；不能重新复制 .arc 来“修分”。 |

建议消融固定输入源码、公开需求、模型/备用策略、预算和依赖版本，多次独立生成，记录每题真实行为、官方结果及成本分布。先比较旧包与全清理包，再按“消息/菜单/关闭”“位置与重复”“骨架 selector”“诊断规则”分组比较。模型断流、备用切换、未执行检查单独记，不能把一次样本的变化全归因于提示。不得重新启用 `.arc` 复制作为消融条件，也不要把官方定位器变成新的接受条件。

## 对外表述的限制

可以展示：从需求编写检查、可追溯的局部修复、有界的起点 UI 库存、需求明确位置的增量保护，以及这次主动删除评测耦合的过程与证据。不能只凭这些单测声称模型泛化已经成立、满足全部可访问性规范、绝无越界可能、或者已经获得决赛冠军。本轮没有复核官方终局名次。

仍需诚实呈现：guard 无登录后完整覆盖，role/name 库存并非业务状态；CHANGE 提及/替代词匹配可能过宽；位置解析对叙述的否定、历史描述和场景作用域不完备；源码/自写测试可能共享模型误解；局部净收益可牺牲部分新增场景；骨架仍有同步存储、无鉴权状态 API、完整 APG 键盘支持不足等原型局限。它们是剩余的通用工程风险，不应以保留 C/D 规则来掩盖。

[alert]: https://www.w3.org/WAI/ARIA/apg/patterns/alert/
[status]: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
[dialog]: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
[menu]: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
[disclosure]: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/
[landmarks]: https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/
[labels]: https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
[select]: https://html.spec.whatwg.org/multipage/form-elements.html#the-select-element
[locators]: https://playwright.dev/docs/locators
[uncaught]: https://nodejs.org/api/process.html#warning-using-uncaughtexception-correctly
[vm]: https://nodejs.org/api/vm.html

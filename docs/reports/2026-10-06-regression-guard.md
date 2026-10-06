更新：豁免规则与分类边界由 [2026-10-06 豁免修订报告](2026-10-06-regression-guard-exemptions.md) 取代；原正文保留为当时记录。

# 2026-10-06：升级路径的旧行为回归守卫

已实现，`ONESHOT_REGRESSION_GUARD=1` 启用，默认关闭；只对已有应用的升级运行。此分支没有推送、合并、模型网关调用、平台调用或上传。包和测试不证明分数改善。

[完整证据 JSON](../evidence/2026-10-06-regression-guard.json) 含源码恢复来源、逐文件 SHA-256、两题基线、合成变更、六题前后清单、每条发现及分类、豁免理由、测试与包校验。原始执行输出保留在本 worktree 的 `runs/regression-guard/`。基于 `2a6fdde5b5050c072f296b786dcdbcd52f27b094` 开发。

## 1. 确定性与开销

一次“基线观测”包含两个独立的浏览器／后端 pass，取相同导航路径、角色、名称的交集；随后另起隔离工作区，重复整个双 pass 基线。下面比较的是两次独立稳定清单，不是同一文件读两遍。计时包括副本准备、构建、启动、浏览器和清理。

| 决赛起点 | 稳定项数 | 页面数 | 基线 A 秒 | 基线 B 秒 | 清单一致 |
|---|---:|---:|---:|---:|---|
| GitHub G79 | 1194 | 60 | 39.650 | 39.459 | 是 |
| Sheet87 | 29 | 2 | 2.055 | 1.985 | 是 |

两题均低于 90 秒。GitHub 达到 60 页上限，尚有未探索分支；Sheet 的无登录入口只有两个可安全重放的页面。项数包含不同路径上重复出现的全局控件，不能当成独立功能数量。清单的规范化 SHA-256 写在证据 `finals.*.stable_inventory_sha256`。

默认上限：深度 3、60 页、整个双 pass 观测分配 80 秒；单次重放也分配 80 秒。浏览器导航 2.5 秒、动作 0.9 秒，后端就绪最多 10 秒。构建沿用 Workspace 的 180 秒上限，因此任意未知应用的构建可能使总耗时超过 80 秒；本次两题实测总耗时如表，并不声称任何应用都能在 90 秒内完成。

## 2. 真实浏览器合成破坏

每个变体是起点的独立副本，注入确定性的 DOM 变更：删除清单链接、改变导航名称、让一个路由的主内容不渲染、隐藏命名区块。注入在真实应用渲染后执行，重放真实构建／服务器／Chromium，没有用 mock 清单代替。变体退出后删除副本；输入应用逐文件哈希不变。

| 应用 | 变更 | 指定目标／原路径 | 缺失项数 | 秒 | 指定目标与路径检出 |
|---|---|---|---:|---:|---|
| GitHub | 移除列表链接 | link README.md；branch-switch-demo | 37 | 19.719 | 是 |
| GitHub | 导航改名 | link Sign in；打开 / | 59 | 19.890 | 是 |
| GitHub | 路由不渲染 | button ArcHub；Sign in | 37 | 19.646 | 是 |
| GitHub | 隐藏区块 | navigation Main navigation；打开 / | 60 | 19.877 | 是 |
| GitHub | 新增按钮和区域 | Synthetic added button / region；打开 / | 0 | 19.860 | 是 |
| Sheet | 移除列表链接 | link Q3 Sales；打开 / | 21 | 0.937 | 是 |
| Sheet | 导航改名 | link Q3 Sales；打开 / | 2 | 1.068 | 是 |
| Sheet | 路由不渲染 | button Add worksheet；Q3 Sales | 19 | 1.041 | 是 |
| Sheet | 隐藏区块 | toolbar Spreadsheet toolbar；Q3 Sales | 5 | 1.060 | 是 |
| Sheet | 新增按钮和区域 | Synthetic added button / region；打开 / | 0 | 1.046 | 是 |

共 **8/8** 破坏检出；新增对照 **2/2** 没有回归，且浏览器确实看见新增按钮和区域。表中路由不渲染的目标是该页面原有的一项：同一路由的其他缺失也完整保存在 JSON。链接被移除后导致下游路径断开会产生连带项，所以缺失项数高于注入的故障数。

## 3. 六组真实升级结果

### 输入修复与证据来源

用户指定的 `base-web-*` 是通过 `arcbench source` 抽取的副本。其中五个应用的 JavaScript 已被脱敏替换破坏，例如 `ARC.state.session = ***`、`password =*** seedUser.password`；直接运行得到空页或通用 App 外壳。没有把这些结果当成旧行为基线，也没有猜写代码修好它们。

已有 `bundles/r2-*.zip` 的 `.arc/stdout.log` 保存首轮草稿输入中 `Existing application to extend` 的完整源码 JSON，含每文件原始 SHA-256。从这里恢复六份起点到本 worktree 的 `runs/regression-guard/recovered/`，逐文件验证内容哈希与当时快照一致。分别恢复 10、6、8、6、10、8 个文件。原路径与运行包均只读，恢复源码不进入竞赛包和提交。完整来源及哈希在证据 `source_recovery`。

升级产物直接使用用户指定的 `evolved/<task>/template/`。新需求成绩来自已有 `r2-final.jsonl`，六题分别为 6/6、6/6、9/9、6/6、5/5、6/6，合计 **38/38**；本轮没有重新调用平台。

| 应用 | 原清单项数 | 页面 | 双 pass 基线秒 | 升级重放秒 | 保留 | 需求可变项 | 未豁免发现 | 真回归 | 合法变化 | 噪声 | 未观察 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 12306 | 297 | 14 | 8.996 | 4.591 | 230 | 53 | 14 | 14 | 0 | 0 | 0 |
| bookstack | 583 | 37 | 28.843 | 14.482 | 184 | 393 | 6 | 6 | 0 | 0 | 0 |
| ctrip | 358 | 22 | 19.084 | 9.707 | 352 | 6 | 0 | 0 | 0 | 0 | 0 |
| keep | 126 | 6 | 3.975 | 2.111 | 61 | 65 | 0 | 0 | 0 | 0 | 0 |
| prestashop | 1080 | 32 | 21.732 | 14.313 | 606 | 360 | 114 | 112 | 0 | 2 | 0 |
| stackoverflow | 2492 | 28 | 16.345 | 8.138 | 1975 | 517 | 0 | 0 | 0 | 0 | 0 |

共 **134 项发现：132 项可见界面回归、0 项剩余合法变化、2 项噪声**；平均噪声 **2/6 = 0.33 项／应用**，达到 ≤ 1 的目标。这是人工依据前后浏览器清单、实现和新需求做的分类，不是官方旧功能评分。很多项共享同一个原因，尤其账户导航断开的 85 个连带项。

“需求可变项”包含仍然存在但不再受守卫约束的项，不能当成这么多合法退化。真实的合法变化已按可复现证据豁免，例如固定基准日期替换机器日期、需求明确命名的 Ticket search / Login / Search、新 Catalog filters 覆盖旧筛选区、Men/Women 移到 Clothes 悬浮菜单、颜色按钮变成需求指定的 Color 选择器、标题仍以同名可点击条目显示。JSON 逐项记录豁免理由；明确选择容忍漏报，避免强迫模型撤销这些变化。

### 分类依据

- **R1：12306，14 项。** 旧侧栏按钮名为 `Travel guide`（恢复源码 `frontend/public/app.js:325`），升级改成 `Travel guides`（升级源码 `:49`）。新需求没有要求这次改名。14 条路径上旧可访问名称均消失；同一 `/#/guide` 仍能到达，内容仍在。这是名称契约回归，不是断言帮助功能被删除。
- **R2：BookStack，6 项。** `Page 9.1`、`Page 6.3.2`、`Page 6.3.1` 的旧 `Edit`、`Favorite` 按钮均消失。恢复源码 `frontend/public/index.html:424`、`:425` 直接提供两按钮；升级 `pageReadView`（`:518` 起）仅提供 Page actions，打开后仅有 Revisions。EV-3.2 增加修订历史，没有要求删除旧编辑、收藏入口。
- **R3：PrestaShop，26 项入口 + 85 项连带缺失。** 旧侧栏 `frontend/public/app.js:471` 始终提供 My account；升级 `:575` 将侧栏设为空，`:578` 的账户链接只在已登录时显示。新上下文不再有旧匿名入口。五条原路径（My account 及其 Information、Addresses、Order history and details、Wishlist 子路径）各有 17 项无法沿旧入口重放。它们合计是同一个导航断点，不是证明 85 项功能实现都被删除，也不是证明登录后的账户界面失效。
- **R4：PrestaShop，1 项。** 旧登录表单有 `Remember me` 复选框（恢复源码 `frontend/public/app.js:334`，处理器 `:765`）；升级登录页没有该控件，新要求没有要求移除。这里确认的是选项消失，没有额外声称已验证登录持久化语义。
- **N1：PrestaShop，2 项噪声。** Men 列表旧分页的 Previous / Next 不再出现。旧实现将产品数组切页（恢复源码 `frontend/public/app.js:129` 起）；升级直接呈现完整列表。浏览器对照确认旧第一页的 12 个产品标题全部包含于新列表的 18 个条目中。这两个按钮的缺失没有阻断商品访问，归为噪声。没有为这个应用添加分页专用豁免。

附录逐条列出 134 项；原始角色、名称、路径、观察消息、分类和上下文清单都在证据 JSON。

## 4. 设计与验收规则

### 观察、隔离与范围

新增 `oneshot/regression_guard.py` 和 `oneshot/regression_probe.cjs`。Python 复用 `scenario_check.Workspace/Backend`：构建私有副本，基线两个 pass 之间停止后端并恢复副本；每条浏览器路径新建无存储状态的 context。固定 1280×800、en-US、UTC、reduced motion，使用 Chromium 的可访问性树取名称和角色，不自行猜 aria-label 优先级，不读原需求或 evaluator。

收集可见命名链接、按钮、标题、字段、选择器、标签页、区域、对话框、表单、列表、工具栏等；命名列表下无独立可访问名的 listitem 使用浏览器暴露的后代文本。元数据只用于导航重放或需求豁免，稳定标识来自 `(导航步骤, 角色, 名称)`。不比较元素数量、布局、内部路由名或控件值。

导航采用同源显式链接目标、`data-href` / `data-hash`、声明为导航的 `data-nav`，以及有 `aria-controls` 的 tab。只跟随安全导航，普通 `data-action` 业务按钮不试点；跳过下载、外链和删除／提交等动作目标。禁止非 GET/HEAD 和外部源请求，禁用 service worker。重放优先找原名称暴露的当前目标；同一目标仅改名时可以沿仍可见的新入口到达原屏幕，名称变化在父页面单独判断，避免制造整页连带误报。CSS 导航子菜单只做最多三次有对应链接证据的 hover；明确声明 `aria-haspopup=listbox` 的选择器只打开以观察选项，不选值。

考虑了登录覆盖，但没有引入猜账号、猜密码或执行任意种子脚本的机制。各应用种子为不同 JavaScript 闭包／状态结构，账号挑选和认证前提没有统一协议，现有可见提示也不能提供通用、确定的登录步骤。因此此版仅覆盖**新 context、未执行登录**的状态；没有验证已登录行为。不会清除应用代码自身定义的默认状态或假称已有通用种子登录。

### 稳定交集与保守豁免

基线是两次成功观察的交集；两次未成功到达的页面不受保护。运行器不可用、预算耗尽、无法安全重放的控件为 unknown，不编造缺失；已到达的空路由、真实断开的导航路径可产生缺失。新增项不会产生发现。

豁免依据来自新需求：CHANGE 或明确 rename/remove/replace 记录提到原名称、命名容器或导航步骤；或者同目标／同字段的当前名称被需求明确指定。另识别有证据的选择器选项迁移、导航菜单迁移和明确改变日期基准的日期标签。大小写、空白、链接与按钮之间的导航表示差异不算消失；标题／列表项仍以同名可点击入口出现也保留；当前页面上的自链接改为同名标题不报错。结构性容器变化会宽松豁免其后代，可能漏掉真实旧行为，这是避免修复循环对抗合法变化的明确取舍。

### 接入与接受规则

`generate()` 在模型开始写之前复制不可变起点，然后用后台线程做基线，和 `draft_application()` 的调用重叠。该并行关系由事件同步测试证明；本轮没有调用模型，因此没有声称实测了某次付费生成的端到端提速。若草稿比基线更快，仍需等待基线剩余时间。

草稿后、每个可运行修复后、回归跟进修复后均重放；源码修复和第二套检查共用同一个不可变基线。只改测试的 mend 重用已有应用观察。截断、非法路径或破坏交付结构的修复直接拒绝，不为不能运行的候选伪造浏览器结果。

缺失项加入修复问题，含角色、精确名称、原导航步骤和指定的恢复提示；即使新需求检查都通过，旧行为缺失也会驱动修复。`judge()` 的规则为：

1. 上一保留版本仍保有、候选现已丢失的任一基线项，**直接拒绝**，新需求增加多少通过都不能抵消；旧项之间也不允许一换一。
2. 需求合理豁免的项不参与这条否决；旧项无法重新观察时不算成功，保留上一个已观察版本。
3. 只恢复旧项也可构成修复收益；新需求丢失仍遵守既有三倍收益规则，不能拿旧项收益随意冲销新测试失败。
4. 包括整页故障恢复在内，都不能交易上一版仍有的受保护旧项。回退恢复真实文件，最终照常交付最后保留的完整应用；基线不可用时退回原验收路径，不会因为守卫而交付空目录。

完整基线／重放进入 `budget.smoke.regression_guard`，最终保留状态另存 `existing_behavior_after`，避免把最后一次被拒绝候选的观察误当成最终交付状态。开关关闭时不导入观测模块，不改原草稿、测试或模型调用链；专门测试确认同一离线升级仍只有原来一次模型传输。

## 5. 单测、完整套件与打包

- 新增守卫测试 **28/28**：稳定交集、缺失与新增、路径／运行器失败区别、需求豁免、命名容器、选择器迁移、接受规则、异步基线与不可变副本、纯回归修复、拒绝后的文件回退、开关关闭调用数，以及真实 Chromium 导航／命名列表。
- 完整 one-shot：**307 项，304 通过，3 跳过，0 失败**。三项为 `test_scenario_check.ScenarioCheckEndToEnd`：既有探测要求完整 Chromium 的 executablePath，而本机提供可正常启动的 headless shell。没有把跳过算通过；本功能与上述真实应用观测都实际启动 Chromium。
- 项目要求的 legacy：**226 项，214 通过，12 跳过，0 失败**。8 项需要 legacy 浏览器配置，4 项需要 `HARNESS_TEST_IMAGE`；明细在 JSON。
- `node --check`、`git diff --check` 通过。无 npm 安装失败或权限放宽重跑。全量测试初次在 worktree 私有临时目录建立 jsdom 缓存；复用已有 Acorn 缓存后复验，最终跳过仅为上述三项。
- allowlist 新增两个运行模块；包含 scaffold 的包共 **23 文件、562043 字节**，两次字节相同。解压后在平铺目录真实 `import main, regression_guard` 成功，默认开关为关闭。

最终包 SHA-256：`74b637ac17ff20dff1e8249d82d161d8ad3cd9296dcb26611cd82199edcc7fe8`。没有上传该包，没有声称生成质量、官方成绩或已登录行为改善。

复现命令（仓库根目录，所有临时写入都在 worktree）：

```sh
mkdir -p runs/regression-guard/tmp
export TMPDIR="$PWD/runs/regression-guard/tmp"
export NODE_PATH=/var/folders/j8/60kxyby16mzdsdsy73k7w4bc0000gn/T/oneshot-playwright-test-1.57.0/node_modules
export PYTHONDONTWRITEBYTECODE=1
PYTHONPATH=.:tests_oneshot ~/projects/volo-factory/.venv/bin/python -m unittest discover -s tests_oneshot
~/projects/volo-factory/.venv/bin/python -m unittest discover -s tests -v
~/projects/volo-factory/.venv/bin/python scripts/validate_regression_guard.py --app /path/to/application --out runs/regression-validation
~/projects/volo-factory/.venv/bin/python -m oneshot.regression_guard --app /path/to/starting-application --out runs/baseline.json
~/projects/volo-factory/.venv/bin/python -m oneshot.regression_guard --app /path/to/evolved-application --baseline runs/baseline.json --requirements /path/to/requirements.yaml --out runs/comparison.json
~/projects/volo-factory/.venv/bin/python scripts/package_oneshot.py --output runs/candidate.zip
```

## 6. 解释边界

这是有限探索下的可见界面守卫，不是原需求测试的替代。不会验证提交、计算、存储持久化或所有可点击动作的功能；同名控件数量变化、未命名元素、canvas 内容、未探索分支、私有状态也不在承诺内。保守豁免、相同名称在不同容器出现及双 pass 内恰好稳定的动态文字都可能漏报。两个分页按钮说明仍会有少量噪声，因此保持默认关闭，不能凭本报告直接打开正式候选或宣称泛化／得分改善。

## 附录：全部未豁免发现

R1–R4、N1 的证据见上文及 JSON 对应前后清单。路径 `打开 /` 表示根页面；每行是一个 `(路径, 角色, 名称)` 项。

| 应用 | 原导航路径 | 角色 | 名称 | 分类／依据 |
|---|---|---|---|---|
| 12306 | 打开 / | button | Travel guide | 真回归 R1 |
| 12306 | Login | button | Travel guide | 真回归 R1 |
| 12306 | Register | button | Travel guide | 真回归 R1 |
| 12306 | Tickets | button | Travel guide | 真回归 R1 |
| 12306 | Travel guide | button | Travel guide | 真回归 R1 |
| 12306 | My 12306 | button | Travel guide | 真回归 R1 |
| 12306 | How to book tickets online? | button | Travel guide | 真回归 R1 |
| 12306 | How to change or refund tickets? | button | Travel guide | 真回归 R1 |
| 12306 | How to check train status? | button | Travel guide | 真回归 R1 |
| 12306 | How to use 12306 mobile app? | button | Travel guide | 真回归 R1 |
| 12306 | More | button | Travel guide | 真回归 R1 |
| 12306 | Login / Forgot password? | button | Travel guide | 真回归 R1 |
| 12306 | Register / Terms of Service | button | Travel guide | 真回归 R1 |
| 12306 | Register / Privacy Policy | button | Travel guide | 真回归 R1 |
| bookstack | Page 9.1 | button | Edit | 真回归 R2 |
| bookstack | Page 9.1 | button | Favorite | 真回归 R2 |
| bookstack | Page 6.3.2 | button | Edit | 真回归 R2 |
| bookstack | Page 6.3.2 | button | Favorite | 真回归 R2 |
| bookstack | Page 6.3.1 | button | Edit | 真回归 R2 |
| bookstack | Page 6.3.1 | button | Favorite | 真回归 R2 |
| prestashop | 打开 / | button | My account | 真回归 R3 |
| prestashop | Cart 0 | button | My account | 真回归 R3 |
| prestashop | Sign in | button | My account | 真回归 R3 |
| prestashop | Sign in | checkbox | Remember me | 真回归 R4 |
| prestashop | Men | button | My account | 真回归 R3 |
| prestashop | Men | button | Next | 噪声 N1 |
| prestashop | Men | button | Previous | 噪声 N1 |
| prestashop | Women | button | My account | 真回归 R3 |
| prestashop | My account | button | Addresses | 真回归 R3（入口阻断） |
| prestashop | My account | button | Information | 真回归 R3（入口阻断） |
| prestashop | My account | button | My account | 真回归 R3（入口阻断） |
| prestashop | My account | button | Order history and details | 真回归 R3（入口阻断） |
| prestashop | My account | button | PrestaShop logo | 真回归 R3（入口阻断） |
| prestashop | My account | button | Search button | 真回归 R3（入口阻断） |
| prestashop | My account | button | Wishlist | 真回归 R3（入口阻断） |
| prestashop | My account | combobox | Language | 真回归 R3（入口阻断） |
| prestashop | My account | heading | My account | 真回归 R3（入口阻断） |
| prestashop | My account | link | ACCESSORIES | 真回归 R3（入口阻断） |
| prestashop | My account | link | ART | 真回归 R3（入口阻断） |
| prestashop | My account | link | Cart 0 | 真回归 R3（入口阻断） |
| prestashop | My account | link | PrestaShop | 真回归 R3（入口阻断） |
| prestashop | My account | link | sign in | 真回归 R3（入口阻断） |
| prestashop | My account | link | Sign in | 真回归 R3（入口阻断） |
| prestashop | My account | navigation | Main navigation | 真回归 R3（入口阻断） |
| prestashop | My account | textbox | Search | 真回归 R3（入口阻断） |
| prestashop | ACCESSORIES | button | My account | 真回归 R3 |
| prestashop | ART | button | My account | 真回归 R3 |
| prestashop | Summer Sale - Up to 50% off | button | My account | 真回归 R3 |
| prestashop | New Arrivals - Hummingbird collection | button | My account | 真回归 R3 |
| prestashop | Free Shipping on orders over $50 | button | My account | 真回归 R3 |
| prestashop | Hummingbird detail t-shirt | button | My account | 真回归 R3 |
| prestashop | Hummingbird cart t-shirt | button | My account | 真回归 R3 |
| prestashop | Hummingbird blouse | button | My account | 真回归 R3 |
| prestashop | Sign in / Forgot your password? | button | My account | 真回归 R3 |
| prestashop | Sign in / No account? Create one here | button | My account | 真回归 R3 |
| prestashop | Men / Hummingbird order-confirmation t-shirt | button | My account | 真回归 R3 |
| prestashop | Men / Hummingbird order-complete t-shirt | button | My account | 真回归 R3 |
| prestashop | Men / Hummingbird order-history t-shirt | button | My account | 真回归 R3 |
| prestashop | Men / Hummingbird wishlist t-shirt | button | My account | 真回归 R3 |
| prestashop | Men / White t-shirt | button | My account | 真回归 R3 |
| prestashop | Men / Black mug | button | My account | 真回归 R3 |
| prestashop | Men / Hummingbird casual t-shirt | button | My account | 真回归 R3 |
| prestashop | Men / Hummingbird sport t-shirt | button | My account | 真回归 R3 |
| prestashop | Men / Hummingbird basic t-shirt | button | My account | 真回归 R3 |
| prestashop | Women / Women skirt | button | My account | 真回归 R3 |
| prestashop | Women / Women dress | button | My account | 真回归 R3 |
| prestashop | My account / Information | button | Addresses | 真回归 R3（入口阻断） |
| prestashop | My account / Information | button | Information | 真回归 R3（入口阻断） |
| prestashop | My account / Information | button | My account | 真回归 R3（入口阻断） |
| prestashop | My account / Information | button | Order history and details | 真回归 R3（入口阻断） |
| prestashop | My account / Information | button | PrestaShop logo | 真回归 R3（入口阻断） |
| prestashop | My account / Information | button | Search button | 真回归 R3（入口阻断） |
| prestashop | My account / Information | button | Wishlist | 真回归 R3（入口阻断） |
| prestashop | My account / Information | combobox | Language | 真回归 R3（入口阻断） |
| prestashop | My account / Information | heading | My account | 真回归 R3（入口阻断） |
| prestashop | My account / Information | link | ACCESSORIES | 真回归 R3（入口阻断） |
| prestashop | My account / Information | link | ART | 真回归 R3（入口阻断） |
| prestashop | My account / Information | link | Cart 0 | 真回归 R3（入口阻断） |
| prestashop | My account / Information | link | PrestaShop | 真回归 R3（入口阻断） |
| prestashop | My account / Information | link | sign in | 真回归 R3（入口阻断） |
| prestashop | My account / Information | link | Sign in | 真回归 R3（入口阻断） |
| prestashop | My account / Information | navigation | Main navigation | 真回归 R3（入口阻断） |
| prestashop | My account / Information | textbox | Search | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | button | Addresses | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | button | Information | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | button | My account | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | button | Order history and details | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | button | PrestaShop logo | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | button | Search button | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | button | Wishlist | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | combobox | Language | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | heading | My account | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | link | ACCESSORIES | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | link | ART | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | link | Cart 0 | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | link | PrestaShop | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | link | sign in | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | link | Sign in | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | navigation | Main navigation | 真回归 R3（入口阻断） |
| prestashop | My account / Addresses | textbox | Search | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | button | Addresses | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | button | Information | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | button | My account | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | button | Order history and details | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | button | PrestaShop logo | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | button | Search button | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | button | Wishlist | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | combobox | Language | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | heading | My account | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | link | ACCESSORIES | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | link | ART | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | link | Cart 0 | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | link | PrestaShop | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | link | sign in | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | link | Sign in | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | navigation | Main navigation | 真回归 R3（入口阻断） |
| prestashop | My account / Order history and details | textbox | Search | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | button | Addresses | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | button | Information | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | button | My account | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | button | Order history and details | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | button | PrestaShop logo | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | button | Search button | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | button | Wishlist | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | combobox | Language | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | heading | My account | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | link | ACCESSORIES | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | link | ART | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | link | Cart 0 | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | link | PrestaShop | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | link | sign in | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | link | Sign in | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | navigation | Main navigation | 真回归 R3（入口阻断） |
| prestashop | My account / Wishlist | textbox | Search | 真回归 R3（入口阻断） |

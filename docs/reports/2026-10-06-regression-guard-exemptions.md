# 2026-10-06：回归守卫的豁免改为逐项证据

已收紧规则，保留 `572e231` 的 Playwright 自动安装修复。默认开关不变，仍需 `ONESHOT_REGRESSION_GUARD=1`。本轮没有模型网关调用、平台调用、上传、推送或合并。

G79 的同一份合成需求下，旧规则豁免 701/1194 项，删除文件链接后报告 0 项；新规则报告 37 项缺失，包括指定文件链接及被它阻断的路径。四类注入破坏全部检出；两个被需求明确要求的改名只豁免对应的 119 个控件实例；改名后再删除下游字段仍报告 2 项。

六应用重放有 **355 条告警：229 条人工判定为真实可见界面回归、120 条合法变化、6 条噪声**。按“噪声”这一分类计算是 **1.00 条／应用**，达到原目标；把合法变化告警也计算进去，则有 **126 条不应机械回退的告警，21.00 条／应用**。本次不能被表述为“总误报只有 1 条／应用”，也不足以据此打开默认开关。120 条合法变化没有借宽泛推断自动放行，具体理由见下文。

[完整证据 JSON](../evidence/2026-10-06-regression-guard-exemptions.json) 保存每条发现的路径、角色、名称、人工分类、所有自动豁免的规则与需求原句、旧规则对照、源码与原始观测哈希。本报告修订[前一报告](2026-10-06-regression-guard.md)的豁免设计与分类边界。

## 1. 保留平台修复

当前基线提交为 `572e23134d4fc083b5cac6b6977bdf033338b8c7`，其父提交为初版守卫 `8f2bec2`。从 `RUNTIME_LOCK` 到 CLI 之前的运行时准备、安装、观察及 Guard 生命周期代码与该提交逐字一致，SHA-256 为 `8a32c9c680a1f82f23cb7c4d4617a6c4b1cc22e684fc28cc32bce89c21c3d28a`。本轮使用已经安装的 Playwright 1.57.0／Chromium headless shell；平台冷启动验证的来源是该提交记录。

## 2. 新规则与可见计数

场景中的导航步骤不再进入通用豁免文本。已观察到仍然存在的项一律记为 `kept`；只有实际缺失才检查豁免。每个豁免保存 `rule`、`requirement`、需求原句和对应项的证据，`compare()`、CLI、修复轮记录及最终保留状态均有 `exemptions_by_rule`。

| 规则 | 必要证据 | 不允许的推断 |
|---|---|---|
| `explicit_item` | description 中绑定该对象的 rename/remove/replace/hide 命令或被动陈述；指定位置必须匹配。改名须实际观察到要求的新名称和相应角色 | 引用名为 Remove… 的按钮、用户的删除操作、否定句、场景步骤，以及改成另一个未要求的名称 |
| `explicit_container` | 有观测到的容器归属，且该容器被明确 remove/replace。只有明确替换／删除当前 screen/page 才能覆盖当前页面清单 | 提及或重命名容器；把同名导航步骤当成 DOM 父容器；替换前面的入口页就放弃后面页面 |
| `description_contract` | CHANGE 的 description 正面规定当前名称／角色；旧项与新项在同一观察页面和对应作用域；同导航目标，或有相关标签与控件身份依据 | 从 scenarios 或 ADD 复用中借名称；借另一位置或一个原本已存在的控件充当“替代品” |
| `selector_migration` | 当前同一作用域中、description 指定的选择器确实公开原选项名 | 在其他面板找到同名选项；只说到选择器而未观察选项 |
| `menu_migration` | 浏览器实际 hover 后找到原项的同名、同目标入口；该菜单入口有 description 中的控件声明 | 只提到菜单／导航名；把菜单里的其他项目一起豁免 |
| `date_basis` | 明确的固定日期／机器时钟替代声明（description 或静态 GIVEN），且原项确为日期标签，同一页面仍观察到对应日期控件 | 仅提 calendar；删除整个日期控件组；把 Monthly report、March 3 report 当成日期 |

具体位置绑定到实际作用域或当前页面，不把之前经过的页面当成当前位置。新旧界面的大小写、同名 link/button、同名可点击标题等既有等价匹配保留；它们进入 `kept`，不混入豁免统计。

修复接受规则没有放松：新候选丢掉上一保留版本的受保护旧项仍是硬否决，不能用新测试收益抵消；未观察到的项也不计成功。这里的“硬否决”约束编辑保留，不建立 `verified_requirements` 或官方通过证明；最后完整版本仍正常交付。

## 3. G79 的 CHANGE 密集压力测试

使用真实 G79 起点，冻结原来的 60 条导航计划，重新构建和做双 pass 基线；仍为 **1194 项／60 页**。需求由本轮独立构造，未使用决赛代理暗题。8 条 CHANGE 要求新的 Review metric 状态，其 scenarios 反复经过 Home、Sign in、Issues、Pull requests、被测仓库及文件；description 也包含公共导航名，但不要求改变这些入口。另 2 条 CHANGE 明确要求全局改名：

- link `Sign in` 改为 `Renamed entry 1`。
- button `Explore` 改为 `Renamed entry 2`。

需求正文存于 JSON 的 `g79.requirements`，原始可执行 YAML 位于 `runs/regression-guard-exemptions/g79/requirements.yaml`。这些新 metric 功能没有被生成或测试；本实验只测试旧项保存与豁免。

| 变体 | 旧规则缺失 | 新规则缺失 | 新规则豁免 | 豁免规则 | 结果 |
|---|---:|---:|---:|---|---|
| 原样 | 0 | 0 | 0 | 全部为 0 | 通过 |
| 删除 README.md 清单链接 | 0 | 37 | 0 | 全部为 0 | 通过 |
| 把导航改成未要求的名称 | 0 | 59 | 0 | 全部为 0 | 通过 |
| 一个路由不渲染 | 0 | 37 | 0 | 全部为 0 | 通过 |
| 隐藏 Main navigation | 37 | 60 | 0 | 全部为 0 | 通过 |
| 应用两个明确改名 | 0 | 0 | 119 | explicit_item=119 | 通过 |
| 明确改名后再隐藏 Password 字段 | 0 | 2 | 119 | explicit_item=119 | 通过 |

119 个豁免是两种全局控件在多条路径上的实例：Sign in 59、Explore 60，不是 119 个不同功能。进入 Sign in 页后仍有同名表单按钮，因此其中一个导航实例按既有等价匹配记为保留。Password 注入同时影响登录及注册路径，所以有 2 项发现；导航改名没有豁免这两个字段。

旧规则在上述每个变体中都豁免 701 项，理由为 Issues 148、Pull requests 159、Home 121、Sign in 85、Explore 72、仓库路径名 89、README.md 17、Open 10。新旧纯差分使用完全相同的浏览器输入，避免把覆盖变化混成规则改善。G79 输入文件哈希未变；四类破坏各在独立副本上注入并真实重放。

补充的字段反例先试用了同名标题，但现有比较器把同名标题／按钮视作等价，未构成有效缺失；最终改用独立 textbox。该修正及最终目标记录在 JSON，不把未检出的标题变体藏作成功。

## 4. 六组真实重放

继续使用上轮按原 SHA-256 从首轮模型输入恢复的起点，没有猜补脱敏损坏的 JavaScript。原始源码恢复依据见前一报告。六份升级目录的所有应用源码本轮逐文件比对其 `bundles/r2-*.zip`，全部一致，仍对应先前新需求 38/38 的产物；本轮没有重新请求官方测试。

对每个起点重新构建、双 pass 观察，再重放升级版本。为了和前次比较同一批旧项，固定原导航计划；比较所用清单均由本轮浏览器重新取得。

| 应用 | 稳定项／页面 | 基线秒 | 重放秒 | 保留 | 豁免 | 发现 | 真回归 | 合法变化 | 噪声 | 未观察 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 12306 | 297／14 | 9.845 | 4.933 | 274 | 9 | 14 | 14 | 0 | 0 | 0 |
| bookstack | 583／37 | 29.003 | 14.771 | 542 | 0 | 41 | 6 | 35 | 0 | 0 |
| ctrip | 358／22 | 19.452 | 9.926 | 358 | 0 | 0 | 0 | 0 | 0 | 0 |
| keep | 126／6 | 4.614 | 2.565 | 124 | 0 | 2 | 0 | 0 | 2 | 0 |
| prestashop | 1080／32 | 21.990 | 14.507 | 683 | 99 | 298 | 209 | 85 | 4 | 0 |
| stackoverflow | 2492／28 | 16.548 | 8.543 | 2436 | 56 | 0 | 0 | 0 | 0 | 0 |

| 应用 | 明确项变更 | 明确容器移除／替换 | CHANGE 描述契约 | 选择器迁移 | 菜单迁移 | 日期基准 |
|---|---:|---:|---:|---:|---:|---:|
| 12306 | 0 | 0 | 2 | 0 | 0 | 7 |
| bookstack | 0 | 0 | 0 | 0 | 0 | 0 |
| ctrip | 0 | 0 | 0 | 0 | 0 | 0 |
| keep | 0 | 0 | 0 | 0 | 0 | 0 |
| prestashop | 0 | 0 | 15 | 22 | 62 | 0 |
| stackoverflow | 0 | 0 | 56 | 0 | 0 | 0 |

真实对照合计自动豁免 **164 项**：description_contract 73、selector_migration 22、menu_migration 62、date_basis 7；明确移除／替换规则为 0。每项有自身证据，没有任何按通用导航名放行的规则。缓存只复用相同 description／声明解析结果，带上实际角色、名称和作用域作为键；当前六组差分约 0.01–0.5 秒，缓存前最慢一组约 20 秒，结论相同。

### 分类与证据

以下是人工审阅结论，355 个具体实例逐条列在附录和 JSON。它们不是 355 个独立功能故障；重复全局控件和断路后无法到达的项逐路径计数。

- **12306：14 真回归。** Travel guide 导航名变为 Travel guides，目的地未变，新需求无该改名要求。按本任务定义，这是旧名称契约回归，帮助内容仍能到达。需求明确命名的 Ticket search 表单与固定日期标签仍分别获 2、7 项豁免。
- **BookStack：6 真回归。** 三个已有页面的 Edit／Favorite 仍消失。恢复源码 `pageReadView` 原有这两个动作，升级 `frontend/public/index.html:518` 起只呈现 Page actions，展开只提供 Revisions；原动作未迁入菜单。
- **BookStack：35 合法变化告警。** 16 本书各有 Chapters／Pages 两个分组标题，升级按 EV-1.2 将内容合在 Book contents／Contents 中；另三个 Actions 标题被 EV-3.2 的 Page actions 触发器取代。旧子条目并未因此消失。自动规则没有把“chapters and pages together”推成整块容器删除，也没有把 ADD 中的新触发器当成 CHANGE 改名，所以这 35 项保留为告警，需结合要求审阅。
- **Keep：2 噪声。** Reminders 和 Work 下的 Matching notes 冗余标题消失，但命名区域和原记录继续存在。旧规则分别借导航名与现有容器放行；新规则不借现有控件替另一控件证明改名，因此如实记录两项。
- **PrestaShop：209 真回归。** 49 项旧 Home／My account 侧栏入口丢失；账户入口断开使五条路径共 90 项无法按原路径到达；Remember me 丢失 1 项；五个分类页颜色／尺寸／On sale 筛选消失 69 项。恢复源码 `filterPanel` 在 `frontend/public/app.js:87` 起提供这些筛选，升级 `catalogFiltersForm` 在 `:139` 起仅有库存与价格；EV-1.1 没有明确删除旧筛选或整体替换其容器。**撤回上轮把整个 Filters 区当作合法变化的宽泛判断。** Min/Max price 的具体控件变更仍有 10 项描述契约豁免，Filters 标题变成 Catalog filters 表单另有 5 项豁免。
- **PrestaShop：85 合法变化告警。** 57 项登录／购物车名称调整与 ADD 交互契约一致，但不属于 CHANGE description 或明确改名；24 项旧 Clothes 产品标题／链接与 EV-1.1 GIVEN 的“恰好六个指定种子产品”不兼容；该六项种子集合还使旧分页的 4 个控件无需出现。后两组不是普通导航提及，但当前规则不从任意 GIVEN 推导整张列表替换。这些合法情况全部解释并保留为告警，没有重新引入针对该应用的豁免。
- **PrestaShop：4 噪声。** Men 页的 1／2／Previous／Next 被完整列表取代，旧第一页 12 个产品标题全部在新 18 项列表中。上轮只报告 2 项，是因为数字 1／2 被普通文本命中；本轮把四项完整计入。
- **Ctrip、StackOverflow：0 告警。** StackOverflow 的 Login、Search 各在 28 条路径获具体名称契约豁免；没有据此豁免登录后的内容或搜索结果。

因此，噪声指标刚好达到目标，但目前自动化的告警精度仍有限：人工认为应保留的合法变化加噪声共 126/355，约 35.5%。这不是“只剩六个误报”。未在这轮把 120 条合法变化加入宽泛放行，因为那会违反新的证据要求或重新开放父级豁免漏洞。模型仍看到“unless a requirement changes it”以及权威新需求，但本轮没有付费生成验证，不能声称修复循环已经不会浪费调用。

### 上轮合法变化的逐类去向

| 先前列为合理的变化 | 本轮处理 |
|---|---|
| 固定日期替换机器日期 | 保留 7 项 date_basis；只认日期格式与实际新日期控件，GIVEN 导航无作用 |
| Ticket search 表单新名称 | 保留 2 项 description_contract；匹配同位置的新表单 |
| StackOverflow 的 Login／Search | 保留 56 项 description_contract；CHANGE 描述与原导航目标／字段位置相符 |
| PrestaShop 的 Login／Cart 名称 | 自动豁免撤销：只有 ADD 复用契约，没有 CHANGE 或明确改名；57 个相关实例人工判合法并解释 |
| Catalog filters 的新表单／价格输入 | 15 项具体控件仍豁免；69 个旧筛选能力丢失重新判为真实回归，不向后代传播 |
| Men／Women 移入菜单 | 保留 62 项 menu_migration；浏览器实际找到了同名同目的地的菜单项 |
| 颜色按钮改为 Color 选择器 | 保留 22 项 selector_migration；选择器实际提供同名选项，且位置一致 |
| 同名标题改成可点击条目、大小写、当前页自链接 | 继续使用原等价匹配，计入 kept；并未借 CHANGE 文字放行 |
| Matching notes 标题 | 改为 2 项噪声告警，撤销从导航／已有区域借来的豁免 |
| 其他经导航／容器提及而跳过的项 | JSON 的 previous_exemptions_now 逐应用审计其变成 kept、具证据豁免或告警，不能再称“均为合法变化” |

## 5. 观察与测试

另修正了一个重放缺口：相同名称的多个链接若全部指向同一个 URL，按唯一目标安全重放；目标不同或 click handler 有歧义仍不猜选。它不豁免任何项目。StackOverflow 两个重复标签入口因此恢复观察，六应用 unknown 均为 0。对同目标／不同目标均有真实浏览器单测。

保留了基线与草稿并行、每次修复后重放、受保护项不可交易、纯旧项恢复可接受以及最后完整版本交付逻辑。没有把诊断写入 verified_requirements，没有启用已登录观察，也没有修改原应用、原需求或 evaluator。

- 新守卫测试 **42/42**，含提及不授权、场景不授权、对象与位置、先前导航不是当前位置、容器归属、明确改名/移除/替换/隐藏、否定与动作名、替代品不能借旧控件、角色变化、选项迁移、日期非日期区分、计数、接受与回退，以及浏览器导航。
- 完整 `tests_oneshot`：**321 项，318 通过，3 跳过，0 失败**。三个跳过为既有 scenario-check 端到端测试的完整 Chromium 路径检查；真实守卫和这些应用使用的 headless shell 正常执行。
- legacy：**226 项，214 通过，12 跳过，0 失败**。8 个可选浏览器配置、4 个 Docker image 测试未配置，未算通过。
- 23 文件 allowlist 包重复构建一致，平铺目录导入通过；默认开关仍为关闭。新增验证脚本不进入竞赛包。

包 SHA-256：`c1ac09988fb186d4e5cc2115554183d24e06722056670b502f600959f9943c41`。源码与安装段哈希在证据中，可核对提交是否与验证版本一致。

## 6. 复现

所有写入放在当前 worktree；环境沿用用户提供的 Playwright runtime。六应用原始观测与恢复副本分别在 `runs/regression-guard-exemptions/practice/`、`runs/regression-guard/recovered/`。原观测不随报告增大复制到 Git，证据记录其路径和哈希，永久报告保留全部发现／豁免及源码来源。

```sh
export NODE_PATH=/var/folders/j8/60kxyby16mzdsdsy73k7w4bc0000gn/T/oneshot-playwright-test-1.57.0/node_modules
export TMPDIR="$PWD/runs/regression-guard/tmp"
export PYTHONDONTWRITEBYTECODE=1
PYTHONPATH=.:tests_oneshot ~/projects/volo-factory/.venv/bin/python -m unittest discover -s tests_oneshot
~/projects/volo-factory/.venv/bin/python -m unittest discover -s tests -v
~/projects/volo-factory/.venv/bin/python scripts/validate_regression_exemptions.py   --app ~/projects/arcbench-campaign/evidence/2026-10-02-s70/v7-official-github-79/application   --paths-from runs/regression-guard/release-github/baseline-1.json   --navigation-names '["Home","Sign in","Issues","Pull requests"]'   --out runs/recheck-change-heavy
~/projects/volo-factory/.venv/bin/python -m oneshot.regression_guard   --app /path/to/evolved --baseline /path/to/fresh-baseline.json   --requirements /path/to/requirements.yaml --out runs/recheck-comparison.json
```

如果只有版本库，可以从前一证据 JSON 的 `finals.github.screens` 生成 `{"screens": ...}` 路径计划，再用 `--paths-from`；本轮仍会重新观察原应用。规则语法有边界，缺少充分证据会保留告警，解析失败不会放行。它仍是有限可见项保护，不是完整功能、所有登录状态或官方得分的保证。

## 附录：355 项未豁免发现

同一原因重复出现在多个路径时仍逐项列出。英文分类键和对应完整观察消息见 JSON；这里只列审阅结论。合法变化仍作为缺失项进入修复提示。

| 应用 | 原导航路径 | 角色 | 名称 | 分类 |
|---|---|---|---|---|
| 12306 | 打开 / | button | Travel guide | 真实回归 |
| 12306 | Login | button | Travel guide | 真实回归 |
| 12306 | Register | button | Travel guide | 真实回归 |
| 12306 | Tickets | button | Travel guide | 真实回归 |
| 12306 | Travel guide | button | Travel guide | 真实回归 |
| 12306 | My 12306 | button | Travel guide | 真实回归 |
| 12306 | How to book tickets online? | button | Travel guide | 真实回归 |
| 12306 | How to change or refund tickets? | button | Travel guide | 真实回归 |
| 12306 | How to check train status? | button | Travel guide | 真实回归 |
| 12306 | How to use 12306 mobile app? | button | Travel guide | 真实回归 |
| 12306 | More | button | Travel guide | 真实回归 |
| 12306 | Login / Forgot password? | button | Travel guide | 真实回归 |
| 12306 | Register / Terms of Service | button | Travel guide | 真实回归 |
| 12306 | Register / Privacy Policy | button | Travel guide | 真实回归 |
| bookstack | Page 9.1 | button | Edit | 真实回归 |
| bookstack | Page 9.1 | button | Favorite | 真实回归 |
| bookstack | Page 9.1 | heading | Actions | 合法变化 |
| bookstack | Page 6.3.2 | button | Edit | 真实回归 |
| bookstack | Page 6.3.2 | button | Favorite | 真实回归 |
| bookstack | Page 6.3.2 | heading | Actions | 合法变化 |
| bookstack | Page 6.3.1 | button | Edit | 真实回归 |
| bookstack | Page 6.3.1 | button | Favorite | 真实回归 |
| bookstack | Page 6.3.1 | heading | Actions | 合法变化 |
| bookstack | Books / Book 5.1 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 5.1 | heading | Pages | 合法变化 |
| bookstack | Books / Book 5.2.1 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 5.2.1 | heading | Pages | 合法变化 |
| bookstack | Books / Book 5.2.2 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 5.2.2 | heading | Pages | 合法变化 |
| bookstack | Books / Book 5.4.1 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 5.4.1 | heading | Pages | 合法变化 |
| bookstack | Books / Book 5.4.2 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 5.4.2 | heading | Pages | 合法变化 |
| bookstack | Books / Book 5.5.1 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 5.5.1 | heading | Pages | 合法变化 |
| bookstack | Books / Book 5.5.2 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 5.5.2 | heading | Pages | 合法变化 |
| bookstack | Books / Book 6.1.1 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 6.1.1 | heading | Pages | 合法变化 |
| bookstack | Books / Book 6.1.2 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 6.1.2 | heading | Pages | 合法变化 |
| bookstack | Books / Book 6.1.3 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 6.1.3 | heading | Pages | 合法变化 |
| bookstack | Books / Book 6.2.1 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 6.2.1 | heading | Pages | 合法变化 |
| bookstack | Books / Book 6.3.1 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 6.3.1 | heading | Pages | 合法变化 |
| bookstack | Books / Book 6.3.2 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 6.3.2 | heading | Pages | 合法变化 |
| bookstack | Books / Book 8.1 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 8.1 | heading | Pages | 合法变化 |
| bookstack | Books / Book 8.2 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 8.2 | heading | Pages | 合法变化 |
| bookstack | Books / Book 9.1 | heading | Chapters | 合法变化 |
| bookstack | Books / Book 9.1 | heading | Pages | 合法变化 |
| keep | Reminders | heading | Matching notes | 噪声 |
| keep | Work | heading | Matching notes | 噪声 |
| prestashop | 打开 / | button | Home | 真实回归 |
| prestashop | 打开 / | button | My account | 真实回归 |
| prestashop | 打开 / | link | Cart 0 | 合法变化 |
| prestashop | 打开 / | link | Sign in | 合法变化 |
| prestashop | Cart 0 | button | Home | 真实回归 |
| prestashop | Cart 0 | button | My account | 真实回归 |
| prestashop | Cart 0 | link | Cart 0 | 合法变化 |
| prestashop | Cart 0 | link | Sign in | 合法变化 |
| prestashop | Sign in | button | Home | 真实回归 |
| prestashop | Sign in | button | My account | 真实回归 |
| prestashop | Sign in | button | SIGN IN | 合法变化 |
| prestashop | Sign in | checkbox | Remember me | 真实回归 |
| prestashop | Sign in | form | Login form | 合法变化 |
| prestashop | Sign in | heading | Sign in | 合法变化 |
| prestashop | Sign in | link | Cart 0 | 合法变化 |
| prestashop | Sign in | link | Sign in | 合法变化 |
| prestashop | Men | button | 1 | 噪声 |
| prestashop | Men | button | 2 | 噪声 |
| prestashop | Men | button | 30 | 真实回归 |
| prestashop | Men | button | 32 | 真实回归 |
| prestashop | Men | button | 34 | 真实回归 |
| prestashop | Men | button | 36 | 真实回归 |
| prestashop | Men | button | Beige | 真实回归 |
| prestashop | Men | button | Black | 真实回归 |
| prestashop | Men | button | Blue | 真实回归 |
| prestashop | Men | button | Green | 真实回归 |
| prestashop | Men | button | Grey | 真实回归 |
| prestashop | Men | button | Khaki | 真实回归 |
| prestashop | Men | button | L | 真实回归 |
| prestashop | Men | button | M | 真实回归 |
| prestashop | Men | button | My account | 真实回归 |
| prestashop | Men | button | Next | 噪声 |
| prestashop | Men | button | One size | 真实回归 |
| prestashop | Men | button | Previous | 噪声 |
| prestashop | Men | button | S | 真实回归 |
| prestashop | Men | button | White | 真实回归 |
| prestashop | Men | button | XL | 真实回归 |
| prestashop | Men | checkbox | On sale | 真实回归 |
| prestashop | Men | link | Cart 0 | 合法变化 |
| prestashop | Men | link | Sign in | 合法变化 |
| prestashop | Women | button | 30 | 真实回归 |
| prestashop | Women | button | 32 | 真实回归 |
| prestashop | Women | button | 34 | 真实回归 |
| prestashop | Women | button | 36 | 真实回归 |
| prestashop | Women | button | L | 真实回归 |
| prestashop | Women | button | M | 真实回归 |
| prestashop | Women | button | My account | 真实回归 |
| prestashop | Women | button | One size | 真实回归 |
| prestashop | Women | button | Pink | 真实回归 |
| prestashop | Women | button | Red | 真实回归 |
| prestashop | Women | button | S | 真实回归 |
| prestashop | Women | button | White | 真实回归 |
| prestashop | Women | button | XL | 真实回归 |
| prestashop | Women | checkbox | On sale | 真实回归 |
| prestashop | Women | link | Cart 0 | 合法变化 |
| prestashop | Women | link | Sign in | 合法变化 |
| prestashop | My account | button | Addresses | 真实回归 |
| prestashop | My account | button | Information | 真实回归 |
| prestashop | My account | button | My account | 真实回归 |
| prestashop | My account | button | Order history and details | 真实回归 |
| prestashop | My account | button | PrestaShop logo | 真实回归 |
| prestashop | My account | button | Search button | 真实回归 |
| prestashop | My account | button | Wishlist | 真实回归 |
| prestashop | My account | combobox | Language | 真实回归 |
| prestashop | My account | heading | My account | 真实回归 |
| prestashop | My account | link | ACCESSORIES | 真实回归 |
| prestashop | My account | link | ART | 真实回归 |
| prestashop | My account | link | Cart 0 | 真实回归 |
| prestashop | My account | link | CLOTHES | 真实回归 |
| prestashop | My account | link | PrestaShop | 真实回归 |
| prestashop | My account | link | sign in | 真实回归 |
| prestashop | My account | link | Sign in | 真实回归 |
| prestashop | My account | navigation | Main navigation | 真实回归 |
| prestashop | My account | textbox | Search | 真实回归 |
| prestashop | ACCESSORIES | button | 30 | 真实回归 |
| prestashop | ACCESSORIES | button | 32 | 真实回归 |
| prestashop | ACCESSORIES | button | 34 | 真实回归 |
| prestashop | ACCESSORIES | button | 36 | 真实回归 |
| prestashop | ACCESSORIES | button | L | 真实回归 |
| prestashop | ACCESSORIES | button | M | 真实回归 |
| prestashop | ACCESSORIES | button | My account | 真实回归 |
| prestashop | ACCESSORIES | button | One size | 真实回归 |
| prestashop | ACCESSORIES | button | S | 真实回归 |
| prestashop | ACCESSORIES | button | XL | 真实回归 |
| prestashop | ACCESSORIES | checkbox | On sale | 真实回归 |
| prestashop | ACCESSORIES | link | Cart 0 | 合法变化 |
| prestashop | ACCESSORIES | link | Sign in | 合法变化 |
| prestashop | ART | button | 30 | 真实回归 |
| prestashop | ART | button | 32 | 真实回归 |
| prestashop | ART | button | 34 | 真实回归 |
| prestashop | ART | button | 36 | 真实回归 |
| prestashop | ART | button | L | 真实回归 |
| prestashop | ART | button | M | 真实回归 |
| prestashop | ART | button | My account | 真实回归 |
| prestashop | ART | button | One size | 真实回归 |
| prestashop | ART | button | S | 真实回归 |
| prestashop | ART | button | XL | 真实回归 |
| prestashop | ART | checkbox | On sale | 真实回归 |
| prestashop | ART | link | Cart 0 | 合法变化 |
| prestashop | ART | link | Sign in | 合法变化 |
| prestashop | Summer Sale - Up to 50% off | button | Home | 真实回归 |
| prestashop | Summer Sale - Up to 50% off | button | My account | 真实回归 |
| prestashop | Summer Sale - Up to 50% off | link | Cart 0 | 合法变化 |
| prestashop | Summer Sale - Up to 50% off | link | Sign in | 合法变化 |
| prestashop | New Arrivals - Hummingbird collection | button | Home | 真实回归 |
| prestashop | New Arrivals - Hummingbird collection | button | My account | 真实回归 |
| prestashop | New Arrivals - Hummingbird collection | link | Cart 0 | 合法变化 |
| prestashop | New Arrivals - Hummingbird collection | link | Sign in | 合法变化 |
| prestashop | Free Shipping on orders over $50 | button | Home | 真实回归 |
| prestashop | Free Shipping on orders over $50 | button | My account | 真实回归 |
| prestashop | Free Shipping on orders over $50 | link | Cart 0 | 合法变化 |
| prestashop | Free Shipping on orders over $50 | link | Sign in | 合法变化 |
| prestashop | CLOTHES | button | 1 | 合法变化 |
| prestashop | CLOTHES | button | 2 | 合法变化 |
| prestashop | CLOTHES | button | 30 | 真实回归 |
| prestashop | CLOTHES | button | 32 | 真实回归 |
| prestashop | CLOTHES | button | 34 | 真实回归 |
| prestashop | CLOTHES | button | 36 | 真实回归 |
| prestashop | CLOTHES | button | Beige | 真实回归 |
| prestashop | CLOTHES | button | Black | 真实回归 |
| prestashop | CLOTHES | button | Blue | 真实回归 |
| prestashop | CLOTHES | button | Green | 真实回归 |
| prestashop | CLOTHES | button | Grey | 真实回归 |
| prestashop | CLOTHES | button | Khaki | 真实回归 |
| prestashop | CLOTHES | button | L | 真实回归 |
| prestashop | CLOTHES | button | M | 真实回归 |
| prestashop | CLOTHES | button | My account | 真实回归 |
| prestashop | CLOTHES | button | Next | 合法变化 |
| prestashop | CLOTHES | button | One size | 真实回归 |
| prestashop | CLOTHES | button | Pink | 真实回归 |
| prestashop | CLOTHES | button | Previous | 合法变化 |
| prestashop | CLOTHES | button | Red | 真实回归 |
| prestashop | CLOTHES | button | S | 真实回归 |
| prestashop | CLOTHES | button | White | 真实回归 |
| prestashop | CLOTHES | button | XL | 真实回归 |
| prestashop | CLOTHES | checkbox | On sale | 真实回归 |
| prestashop | CLOTHES | heading | Black mug | 合法变化 |
| prestashop | CLOTHES | heading | Hummingbird basic t-shirt | 合法变化 |
| prestashop | CLOTHES | heading | Hummingbird cart t-shirt | 合法变化 |
| prestashop | CLOTHES | heading | Hummingbird casual t-shirt | 合法变化 |
| prestashop | CLOTHES | heading | Hummingbird checkout-step t-shirt | 合法变化 |
| prestashop | CLOTHES | heading | Hummingbird detail t-shirt | 合法变化 |
| prestashop | CLOTHES | heading | Hummingbird order-complete t-shirt | 合法变化 |
| prestashop | CLOTHES | heading | Hummingbird order-confirmation t-shirt | 合法变化 |
| prestashop | CLOTHES | heading | Hummingbird order-history t-shirt | 合法变化 |
| prestashop | CLOTHES | heading | Hummingbird sport t-shirt | 合法变化 |
| prestashop | CLOTHES | heading | Hummingbird wishlist t-shirt | 合法变化 |
| prestashop | CLOTHES | heading | White t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Black mug | 合法变化 |
| prestashop | CLOTHES | link | Cart 0 | 合法变化 |
| prestashop | CLOTHES | link | Hummingbird basic t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Hummingbird cart t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Hummingbird casual t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Hummingbird checkout-step t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Hummingbird detail t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Hummingbird order-complete t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Hummingbird order-confirmation t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Hummingbird order-history t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Hummingbird sport t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Hummingbird wishlist t-shirt | 合法变化 |
| prestashop | CLOTHES | link | Sign in | 合法变化 |
| prestashop | CLOTHES | link | White t-shirt | 合法变化 |
| prestashop | Hummingbird detail t-shirt | button | Home | 真实回归 |
| prestashop | Hummingbird detail t-shirt | button | My account | 真实回归 |
| prestashop | Hummingbird detail t-shirt | link | Cart 0 | 合法变化 |
| prestashop | Hummingbird detail t-shirt | link | Sign in | 合法变化 |
| prestashop | Hummingbird cart t-shirt | button | Home | 真实回归 |
| prestashop | Hummingbird cart t-shirt | button | My account | 真实回归 |
| prestashop | Hummingbird cart t-shirt | link | Cart 0 | 合法变化 |
| prestashop | Hummingbird cart t-shirt | link | Sign in | 合法变化 |
| prestashop | Hummingbird blouse | button | Home | 真实回归 |
| prestashop | Hummingbird blouse | button | My account | 真实回归 |
| prestashop | Hummingbird blouse | link | Cart 0 | 合法变化 |
| prestashop | Hummingbird blouse | link | Sign in | 合法变化 |
| prestashop | Sign in / Forgot your password? | button | Home | 真实回归 |
| prestashop | Sign in / Forgot your password? | button | My account | 真实回归 |
| prestashop | Sign in / Forgot your password? | link | Cart 0 | 合法变化 |
| prestashop | Sign in / Forgot your password? | link | Sign in | 合法变化 |
| prestashop | Sign in / No account? Create one here | button | Home | 真实回归 |
| prestashop | Sign in / No account? Create one here | button | My account | 真实回归 |
| prestashop | Sign in / No account? Create one here | link | Cart 0 | 合法变化 |
| prestashop | Sign in / No account? Create one here | link | Sign in | 合法变化 |
| prestashop | Men / Hummingbird order-confirmation t-shirt | button | Home | 真实回归 |
| prestashop | Men / Hummingbird order-confirmation t-shirt | button | My account | 真实回归 |
| prestashop | Men / Hummingbird order-confirmation t-shirt | link | Cart 0 | 合法变化 |
| prestashop | Men / Hummingbird order-confirmation t-shirt | link | Sign in | 合法变化 |
| prestashop | Men / Hummingbird order-complete t-shirt | button | Home | 真实回归 |
| prestashop | Men / Hummingbird order-complete t-shirt | button | My account | 真实回归 |
| prestashop | Men / Hummingbird order-complete t-shirt | link | Cart 0 | 合法变化 |
| prestashop | Men / Hummingbird order-complete t-shirt | link | Sign in | 合法变化 |
| prestashop | Men / Hummingbird order-history t-shirt | button | Home | 真实回归 |
| prestashop | Men / Hummingbird order-history t-shirt | button | My account | 真实回归 |
| prestashop | Men / Hummingbird order-history t-shirt | link | Cart 0 | 合法变化 |
| prestashop | Men / Hummingbird order-history t-shirt | link | Sign in | 合法变化 |
| prestashop | Men / Hummingbird wishlist t-shirt | button | Home | 真实回归 |
| prestashop | Men / Hummingbird wishlist t-shirt | button | My account | 真实回归 |
| prestashop | Men / Hummingbird wishlist t-shirt | link | Cart 0 | 合法变化 |
| prestashop | Men / Hummingbird wishlist t-shirt | link | Sign in | 合法变化 |
| prestashop | Men / White t-shirt | button | Home | 真实回归 |
| prestashop | Men / White t-shirt | button | My account | 真实回归 |
| prestashop | Men / White t-shirt | link | Cart 0 | 合法变化 |
| prestashop | Men / White t-shirt | link | Sign in | 合法变化 |
| prestashop | Men / Black mug | button | Home | 真实回归 |
| prestashop | Men / Black mug | button | My account | 真实回归 |
| prestashop | Men / Black mug | link | Cart 0 | 合法变化 |
| prestashop | Men / Black mug | link | Sign in | 合法变化 |
| prestashop | Men / Hummingbird casual t-shirt | button | Home | 真实回归 |
| prestashop | Men / Hummingbird casual t-shirt | button | My account | 真实回归 |
| prestashop | Men / Hummingbird casual t-shirt | link | Cart 0 | 合法变化 |
| prestashop | Men / Hummingbird casual t-shirt | link | Sign in | 合法变化 |
| prestashop | Men / Hummingbird sport t-shirt | button | Home | 真实回归 |
| prestashop | Men / Hummingbird sport t-shirt | button | My account | 真实回归 |
| prestashop | Men / Hummingbird sport t-shirt | link | Cart 0 | 合法变化 |
| prestashop | Men / Hummingbird sport t-shirt | link | Sign in | 合法变化 |
| prestashop | Men / Hummingbird basic t-shirt | button | Home | 真实回归 |
| prestashop | Men / Hummingbird basic t-shirt | button | My account | 真实回归 |
| prestashop | Men / Hummingbird basic t-shirt | link | Cart 0 | 合法变化 |
| prestashop | Men / Hummingbird basic t-shirt | link | Sign in | 合法变化 |
| prestashop | Women / Women skirt | button | Home | 真实回归 |
| prestashop | Women / Women skirt | button | My account | 真实回归 |
| prestashop | Women / Women skirt | link | Cart 0 | 合法变化 |
| prestashop | Women / Women skirt | link | Sign in | 合法变化 |
| prestashop | Women / Women dress | button | Home | 真实回归 |
| prestashop | Women / Women dress | button | My account | 真实回归 |
| prestashop | Women / Women dress | link | Cart 0 | 合法变化 |
| prestashop | Women / Women dress | link | Sign in | 合法变化 |
| prestashop | My account / Information | button | Addresses | 真实回归 |
| prestashop | My account / Information | button | Information | 真实回归 |
| prestashop | My account / Information | button | My account | 真实回归 |
| prestashop | My account / Information | button | Order history and details | 真实回归 |
| prestashop | My account / Information | button | PrestaShop logo | 真实回归 |
| prestashop | My account / Information | button | Search button | 真实回归 |
| prestashop | My account / Information | button | Wishlist | 真实回归 |
| prestashop | My account / Information | combobox | Language | 真实回归 |
| prestashop | My account / Information | heading | My account | 真实回归 |
| prestashop | My account / Information | link | ACCESSORIES | 真实回归 |
| prestashop | My account / Information | link | ART | 真实回归 |
| prestashop | My account / Information | link | Cart 0 | 真实回归 |
| prestashop | My account / Information | link | CLOTHES | 真实回归 |
| prestashop | My account / Information | link | PrestaShop | 真实回归 |
| prestashop | My account / Information | link | sign in | 真实回归 |
| prestashop | My account / Information | link | Sign in | 真实回归 |
| prestashop | My account / Information | navigation | Main navigation | 真实回归 |
| prestashop | My account / Information | textbox | Search | 真实回归 |
| prestashop | My account / Addresses | button | Addresses | 真实回归 |
| prestashop | My account / Addresses | button | Information | 真实回归 |
| prestashop | My account / Addresses | button | My account | 真实回归 |
| prestashop | My account / Addresses | button | Order history and details | 真实回归 |
| prestashop | My account / Addresses | button | PrestaShop logo | 真实回归 |
| prestashop | My account / Addresses | button | Search button | 真实回归 |
| prestashop | My account / Addresses | button | Wishlist | 真实回归 |
| prestashop | My account / Addresses | combobox | Language | 真实回归 |
| prestashop | My account / Addresses | heading | My account | 真实回归 |
| prestashop | My account / Addresses | link | ACCESSORIES | 真实回归 |
| prestashop | My account / Addresses | link | ART | 真实回归 |
| prestashop | My account / Addresses | link | Cart 0 | 真实回归 |
| prestashop | My account / Addresses | link | CLOTHES | 真实回归 |
| prestashop | My account / Addresses | link | PrestaShop | 真实回归 |
| prestashop | My account / Addresses | link | sign in | 真实回归 |
| prestashop | My account / Addresses | link | Sign in | 真实回归 |
| prestashop | My account / Addresses | navigation | Main navigation | 真实回归 |
| prestashop | My account / Addresses | textbox | Search | 真实回归 |
| prestashop | My account / Order history and details | button | Addresses | 真实回归 |
| prestashop | My account / Order history and details | button | Information | 真实回归 |
| prestashop | My account / Order history and details | button | My account | 真实回归 |
| prestashop | My account / Order history and details | button | Order history and details | 真实回归 |
| prestashop | My account / Order history and details | button | PrestaShop logo | 真实回归 |
| prestashop | My account / Order history and details | button | Search button | 真实回归 |
| prestashop | My account / Order history and details | button | Wishlist | 真实回归 |
| prestashop | My account / Order history and details | combobox | Language | 真实回归 |
| prestashop | My account / Order history and details | heading | My account | 真实回归 |
| prestashop | My account / Order history and details | link | ACCESSORIES | 真实回归 |
| prestashop | My account / Order history and details | link | ART | 真实回归 |
| prestashop | My account / Order history and details | link | Cart 0 | 真实回归 |
| prestashop | My account / Order history and details | link | CLOTHES | 真实回归 |
| prestashop | My account / Order history and details | link | PrestaShop | 真实回归 |
| prestashop | My account / Order history and details | link | sign in | 真实回归 |
| prestashop | My account / Order history and details | link | Sign in | 真实回归 |
| prestashop | My account / Order history and details | navigation | Main navigation | 真实回归 |
| prestashop | My account / Order history and details | textbox | Search | 真实回归 |
| prestashop | My account / Wishlist | button | Addresses | 真实回归 |
| prestashop | My account / Wishlist | button | Information | 真实回归 |
| prestashop | My account / Wishlist | button | My account | 真实回归 |
| prestashop | My account / Wishlist | button | Order history and details | 真实回归 |
| prestashop | My account / Wishlist | button | PrestaShop logo | 真实回归 |
| prestashop | My account / Wishlist | button | Search button | 真实回归 |
| prestashop | My account / Wishlist | button | Wishlist | 真实回归 |
| prestashop | My account / Wishlist | combobox | Language | 真实回归 |
| prestashop | My account / Wishlist | heading | My account | 真实回归 |
| prestashop | My account / Wishlist | link | ACCESSORIES | 真实回归 |
| prestashop | My account / Wishlist | link | ART | 真实回归 |
| prestashop | My account / Wishlist | link | Cart 0 | 真实回归 |
| prestashop | My account / Wishlist | link | CLOTHES | 真实回归 |
| prestashop | My account / Wishlist | link | PrestaShop | 真实回归 |
| prestashop | My account / Wishlist | link | sign in | 真实回归 |
| prestashop | My account / Wishlist | link | Sign in | 真实回归 |
| prestashop | My account / Wishlist | navigation | Main navigation | 真实回归 |
| prestashop | My account / Wishlist | textbox | Search | 真实回归 |

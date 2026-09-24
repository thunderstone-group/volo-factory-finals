**结论：先别把 71 个 ATOMIC 需求全部改写成模型生成的 Playwright 测试。** 接下来 6～24 小时，我建议先做 **E：围绕首次正式产物建立一小组可自行建立前置状态、可校准的浏览器探针**，让真实失败重新进入修复循环。排序是 **E、D、C、B、A**；这是首次正式分数尚未返回时的暂定顺序，不能诚实地换算成具体“每小时加几分”。

### 错误前提与证据

- **“创建流程几乎是所有测试的必经路径”没有依据。** GitHub 根需求明确称现有账号、仓库、提交和权限关系是 *evaluation seed data*，须在对应场景前 provision，并通过隔离浏览器会话提供账号；它没有规定必须由应用 UI 创建，也没有说明具体注入机制。[GitHub requirements.yaml](<~/projects/arcbench-campaign/evidence/2026-09-24-hackathon/requirements/hackathon--github/requirements.yaml:5>)。Sheet 明列“独立的预配置工作簿”，包括已有公式、筛选和透视结果。[Sheet requirements.yaml](<~/projects/arcbench-campaign/evidence/2026-09-24-hackathon/requirements/hackathon--sheet/requirements.yaml:848>)。评测**可能**使用 UI 做部分准备，但不能据此把注册、建仓库或新建工作簿当作所有测试的公共前缀。创建功能本身仍须做好。
- **“精确名 helper 与公开测试同语义”不准确。** 公开 Keep helper 的通用定位是忽略大小写的正则、依次找可见元素，通常不是精确匹配；正式 GitHub 需求则明确要求被引用的英文可访问名精确符合描述。正式需求应优先于公开 helper。[helpers.ts](<~/projects/arcbench-campaign/upstream/hackathon-local-simulation/public-exercise/keep/tests/helpers.ts:56>)、[GitHub requirements.yaml](<~/projects/arcbench-campaign/evidence/2026-09-24-hackathon/requirements/hackathon--github/requirements.yaml:5>)。
- **A 的本地通过数不能直接当影子分数。** 两题是 200 条隐藏测试，而非每个 ATOMIC 等权；自行生成的测试可能误造 fixture、误解断言，再把错误送去修复。现有“三得一失”规则来自公开题校准，不能直接迁移到未校准的新测试。[roadmap.md](<~/projects/volo-factory/docs/reference/roadmap.md:146>)。当前循环也确实只在整应用故障或场景失败时修复，静态提示不会单独触发；111/112 个正式场景未解析时，它基本失去行为修复入口。[main.py](<~/projects/volo-factory/oneshot/main.py:1938>)。
- **B 的主要动机尚未由正式题证明。** 旧写法 12306 的大文件重发有倒退证据，但正式题的初稿是否主要败于截断、模块浅实现或种子状态尚未见产物。路线图也把“拆分起草”放在出现输出上限证据之后。[progress.md](<~/projects/volo-factory/docs/progress.md:998>)、[roadmap.md](<~/projects/volo-factory/docs/reference/roadmap.md:379>)。
- **“不读截图”是策略，不是赛制禁令。** 规则说定位以文字和场景为准，参考图仅辅助理解布局；必要时看一张图理解页面结构并不违背该条。[preliminary-rules.md](<~/projects/volo-factory/docs/reference/preliminary-rules.md:23>)。

### 按预期得分／工程小时排序

| 排名 | 方向与理由 | 主要风险 | 最便宜的证伪实验 |
|---|---|---|---|
| **1 E：小范围可信探针** | 直接补当前“无失败场景可修”的断点。先覆盖能通过可见 UI 自行建立状态的短流程，并用首次正式产物选真实薄弱点。 | 探针自身误判，或只提升探针而不提升隐藏通过数。 | 在冻结的健康与已知故障产物上各跑两遍：健康不误报，故障稳定报出对应交互；做不到就停止接入修复。 |
| **2 D：同包重复提交** | 几乎不占开发时间，历史最高分规则使独立采样有期权价值。 | 正式评测串行，消耗比赛券；同包分数若稳定，收益接近零。约 50 次只是按费用推算，未计排队与长任务。[规则](<~/projects/volo-factory/docs/reference/preliminary-rules.md:31>)。 | 首次结果后，用**一次**同包重复提交测两题波动与耗时；没有免费实验能证明隐藏分波动。若波动很大，D 可升至第一。 |
| **3 C：通用提示补强** | 实现便宜，但应强调需求覆盖、精确可访问名、服务端持久化与权限，而非假定“创建必经”。 | 提示变长可能挤占输出，改善一处却损坏其他功能。 | 冻结包，仅改提示；两题各做至少两组本地独立生成，核对完整交付、费用及独立浏览器契约，不用自检通过数单独判胜。 |
| **4 B：分模块生成** | 可能缓解大应用浅实现和整文件修复倒退。 | 跨模块数据模型、路由和权限接口不一致；调用数与集成时间上升。 | 先只拆一个高内聚模块，与同需求的一次起草比较完整交付、接口错误、费用和耗时；若集成问题抵消收益即停。 |
| **5 A：全量模型写测试** | 理论覆盖广，但 71 个 ATOMIC、112 个场景涉及复杂 fixture 与交互，工程量最大，测试真伪最难校准。 | 假失败驱动坏修复；1 核、2 GB 下测试与复检耗尽时间。 | 只选两个有明确前置状态和断言的需求试作，先在已知健康／故障产物上证明判别力，再决定是否扩展。 |

### 第一项 E 的实现与写死的本地验收

先下载并检查首次正式提交的两题产物及通过数，确认是整应用故障、入口缺失，还是具体交互失败；这是选择探针的依据，**不把正式分数反推为逐条隐藏测试结论**。

实现范围限定为“从需求文字生成受约束的操作计划”，不让模型写任意 Playwright 程序：

1. 在 [scenarios.py](<~/projects/volo-factory/oneshot/scenarios.py:1800>) 与 [scenario_translate.py](<~/projects/volo-factory/oneshot/scenario_translate.py:66>) 中区分“可由 UI 建立前置状态”和“需要未知评测种子”；后者保持未判定，绝不记为应用失败。新增通用计划模块保存步骤、值的来源和对应需求原句，不内置 GitHub 或 Sheet 业务数据。
2. 在 [scenario_check.cjs](<~/projects/volo-factory/oneshot/scenario_check.cjs:294>) 只补首批探针实际需要的通用浏览器动作与断言，例如刷新、输入值及公式栏值读取；拖拽、右键、剪贴板随后按证据逐项加。继续使用 [scenario_check.py](<~/projects/volo-factory/oneshot/scenario_check.py:10>) 的隔离与恢复机制。
3. 在 [main.py](<~/projects/volo-factory/oneshot/main.py:1718>) 的 `assess()` 把**已校准探针**并入报告；`repair_request()` 附上实际操作和观察；`repair_delivery()` 才能据其失败启动修复。新探针暂用更保守的接受条件：至少修好一项、已通过探针零倒退，检查器错误或前置状态缺失不得触发修复。新模块须加入 [package_oneshot.py](<~/projects/volo-factory/scripts/package_oneshot.py:12>) 的白名单。

**本地完成判据**：至少跑通 GitHub 的注册→登录，以及 Sheet 的新建工作簿→编辑单元格→刷新核对这两条独立短流程；每条动作和断言都能追溯到需求文字或本流程刚输入的值。健康产物连续两次零误报，故障产物连续两次报出同一真实交互故障；无法建立种子、浏览器超时均报告为“未判定”。在 1 核、2 GB 环境下完成一次全套探针不超过 10 分钟；修复回放必须证明失败探针转为通过且既有通过项不倒退。可以用本地产物和练习额度验收，**不花比赛券**。这些判据只证明探针可信、修复机制可用；隐藏分增益仍须之后用正式提交验证。

今天最该避免的是：把未知 fixture 猜成 UI 创建、把模型测试失败当产品失败、把 71 个本地测试的通过率当 200 条隐藏测试得分，以及在单核环境里让每轮修复重跑一套庞大 Playwright 集。费用权重虽只有 0.1 次方，比赛券、串行评测时间和模型调用时间仍是有限资源。[赛制与环境](<~/projects/volo-factory/docs/reference/preliminary-rules.md:42>)。

本次只读取了需求、证据、代码和 Git 状态；未改文件、调用模型或启动评测。当前核对到 `main` 为 `df9fcce`，工作区无改动；首次正式分数尚以你提供的“运行中”为准。


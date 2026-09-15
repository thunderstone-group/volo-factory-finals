# checks 离线校准（2026-09-15）

## 1. 结论

**三份真实应用校准已完成，三份均未达到硬判据。** 不能将本组件的 pass 当作官方
通过预测，也不应据此控制产品修复、回滚或交付。

| 样本 | 官方 pass / fail | 本地 pass / fail / unknown | 官方通过场景的本地 pass 率 | 官方 fail → 本地 pass | 判据 |
|---|---:|---:|---:|---:|---|
| Keep 第 5 局 | 25 / 7 | 5 / 22 / 5 | **4/25 = 16.0%** | **1** | 两项均未达标 |
| Keep 第 7 局 | 22 / 10 | 13 / 14 / 5 | **11/22 = 50.0%** | **2** | 两项均未达标 |
| Bookstack 第 2 局 | 11 / 23 | 10 / 24 / 0 | **7/11 = 63.6%** | **3** | 两项均未达标 |

门槛为假通过 **0**，且官方通过场景的本地 pass 率 **≥85%**；对应至少 22/25、
19/22、10/11。unknown 保留在场景分母中，不计作 pass。本轮没有为了提高一致率
修改已冻结的 Check，没有重新编译来追逐官方失败标签。

## 2. 输入、运行与证据边界

- 输入仅为指定上游的 `requirements/requirements.yaml` 和历史 app 的
  `.factory/state-contract.json`。模型请求保留完整父级、依赖树和合约，**不含 tests、
  应用源码、官方结果或本轮诊断**。
- Keep：32 场景、12 组、13 次成功 HTTP 调用；Bookstack：34 场景、20 组、21 次。
  每个应用各有一次 schema 错误和一次成功修正；都是非法 `target.via`。没有场景丢失。
- 唯一实现修复：Bookstack 需求根标题实际为 `BookStack Knowledge Base System`，
  原编译器只认 `bookstack`。补充确切名称映射并增加测试；没有改变模型提示或执行语义。
- 两份 Keep 使用**同一份冻结 checks**。各本地完整套件运行一次；Bookstack 先用
  `state_rehearsal.py --profile hosted` 跑完整官方套件一次，再运行本地套件一次。
- Node **v22.22.0**、Playwright **1.61.1**、Chromium、4 workers、每测试及断言
  10 秒、无重试、trace/video off、只通过 `open` 调用 `page.goto('/')`。
- 每次在 `checks/out/` 内运行历史应用副本，使用新的 `APP_DATA_DIR`。
  本地套件健康检查 200 后读取种子快照，**全套开始前 PUT 恢复一次**；没有按文件恢复。
  Bookstack 官方回放由现有 Python harness 从空数据目录启动并加载种子。
- 本文的“官方”指官方 tests 的本机 hosted 配置回放。Keep 引用历史原始结果；
  Bookstack 是本轮实测 **11/34**。没有上传、平台 submit 或新的排行榜结果。
- 原始应用、需求与官方测试未修改。另跑的少量浏览器诊断只用于事后归因，未并入分数。
  没有重复完整套件来挑选较好的结果；未测量多次运行的波动分布。

### 冻结 SHA-256

| checks | SHA-256 |
|---|---|
| [Keep](../checks/out/keep/checks.json) | `70f611302aef13554abeeffae3623a463d81369871d8fae1a58bda1cfa32fb6c` |
| [Bookstack](../checks/out/bookstack/checks.json) | `14d93b79b73d174d77f3df02d853b4270f86667fb86660be26380c5f857cb456` |

[Keep manifest](../checks/out/keep/manifest.json) 和
[Bookstack manifest](../checks/out/bookstack/manifest.json) 记录输入路径与 SHA-256。
各样本保留种子、运行环境、结构化 results 和校准 JSON。

## 3. 三张混淆矩阵

行是本地判定，列是官方判定。

### Keep 第 5 局

| 本地判定 | 官方 pass | 官方 fail |
|---|---:|---:|
| pass | 4 | 1 |
| fail | 16 | 6 |
| unknown | 5 | 0 |

[calibration.json](../checks/out/keep-5/calibration.json) ·
[results.json](../checks/out/keep-5/results.json) ·
[官方摘要](../checks/out/keep-5/official-summary.json)

### Keep 第 7 局

| 本地判定 | 官方 pass | 官方 fail |
|---|---:|---:|
| pass | 11 | 2 |
| fail | 7 | 7 |
| unknown | 4 | 1 |

[calibration.json](../checks/out/keep-7/calibration.json) ·
[results.json](../checks/out/keep-7/results.json) ·
[官方摘要](../checks/out/keep-7/official-summary.json)

### Bookstack 第 2 局（留出）

| 本地判定 | 官方 pass | 官方 fail |
|---|---:|---:|
| pass | 7 | 3 |
| fail | 4 | 20 |
| unknown | 0 | 0 |

[calibration.json](../checks/out/bookstack-2/calibration.json) ·
[results.json](../checks/out/bookstack-2/results.json) ·
[本轮官方摘要](../checks/out/bookstack-official/official-score.json) ·
[完整官方报告](../checks/out/bookstack-official/official/report-bookstack-hosted.json)

## 4. unknown 逐条清单及七类对应

Keep 有 **5 个唯一 unknown Check**，在两份应用上各记 5 个 unknown；Bookstack **0**。
不是 10 个不同的编译失败。所有 unknown 均在执行 UI 前保守返回，未消耗测试动作时间。

| 场景 | 评审类别 / category | reason | 编译器的具体理由 | 官方第 5 / 第 7 局 |
|---|---|---|---|---|
| REQ-2.1#1 Note Listing | 读取／列表 / read-list | ambiguous-assertion | 合约未声明置顶与普通笔记分区的精确标题或分隔语义；只能分别定位种子卡片，无法证明分区。 | pass / pass |
| REQ-2.6.1#1 Change note color | 更新／编辑 / edit | unsupported | 没有样式／颜色读取原语，无法证明背景为 light green。 | pass / pass |
| REQ-2.6.2#1 Choose note color when created | 创建 / create | unsupported | 同上，无法确认新建笔记的指定颜色。 | pass / pass |
| REQ-3.2#1 Search by keyword | 搜索／筛选／排序 / search-filter-sort | unsupported | 文本存在断言不能证明关键词被高亮。 | pass / pass |
| REQ-6.1#1 Items and styling | 导航／可达 / navigation | ambiguous-assertion | 仅凭文本／DOM 观测不能确认图标和对齐风格一致。 | pass / fail |

七类中的删除 `delete`、状态切换 `state-toggle` 本轮没有 unknown；
`no-preparation-path` 原因枚举已实现，本轮没有被模型使用。

这不是单纯的执行器故障。颜色、高亮、风格涉及需求完整性与官方较弱断言之间的差异；
有截图 capture 不等于能证明具体颜色或对齐。模型选择 unknown 是其覆盖边界，不能
因官方通过就删除这些 unknown。分区项还存在编译过于保守的可能，但本轮未改写。

仅这些 unknown 就使第 5 局最高可达召回率为 20/25＝80%，第 7 局为 18/22＝81.8%；
即使修好其余假失败，两局仍无法过 85%。必须先明确观测能力与官方预测之间的边界。

## 5. 六个假通过：具体差异与归因

这里的“编译差异”包括目标、准备路径和断言选择错误；“执行对齐差异”指本地
helper/时序与该 app 的官方协议不同，不等于 Playwright 没有执行 JSON 指令。

| 样本 / 场景 | 官方实际失败位置 | 本地为什么可能绕开 | 归因与证据边界 |
|---|---|---|---|
| Keep 5 / REQ-2.8.2#1 | 第二次 hover：`resolveNamed` 命中 `Color for Meeting agenda 2.8.2` 按钮，随后不稳定／不可见，超时。 | Check 两次均 `via:text` hover 标题，未走官方 hover 阶梯；本地成功。 | **已确认编译定位路径不等价**。官方完整 call log 明确给出被命中的按钮。 |
| Keep 7 / REQ-2.7.2#1 | 按 Work 过滤后，目标笔记 DOM count 仍为 1，要求为 0。 | Check 用显式 checkbox、Escape、显式 Work link；另把 Work 缺席断言限在“标题文本元素”内，该断言本身没有证明卡片标签消失。 | **编译路径及作用域差异**。本地最终过滤断言确实通过；未单独隔离角色选择、关闭路径和共享时序各自的贡献。 |
| Keep 7 / REQ-2.7.6.2#1 | 返回 Notes 时等待 `button /^notes$/i`，超时。 | Check 显式选择 `link /Notes/i`；本轮实测页面链接文本包含 `Notes` 与图标，和官方锚定名称、fallback 不等价；还增加了过滤后的缺席断言。 | **已确认编译定位/准备路径不同**；不把这一 pass 当作修复了官方失败。 |
| Bookstack / REQ-4.2.1#1 | 从书架列表点击 Shelf 4.2.1 时落到不存在的 button fallback，超时。 | Check 在点击前增加该书架可见性断言，使用 Keep 的重复定位与 count 后备逻辑，最后能打开详情。 | **执行对齐缺口 + 编译准备路径不同**。报告证明官方解析过早落到 button；没有独立证明额外等待与不同 helper 各贡献多少。 |
| Bookstack / REQ-4.3.2#1 | 点击 Shelf 4.3.2 时落到 button fallback，超时。 | Check 有条件登录、书架可见性断言和 Keep ladder，绕过了官方失败步骤。 | **同上**。本地 Cancel 流程通过不能覆盖官方到达路径。 |
| Bookstack / REQ-4.5.2#1 | 点击精确 Edit 时落到 button fallback，超时。 | Check 先登录、等待 Edit/Save Shelf 可见；打开编辑页后直接 Cancel，**没有先修改字段**。 | **执行对齐差异，另有明确编译漏测**：即便通过，也没有检验“取消未保存的编辑”。 |

证据：[Keep 官方错误摘录](../checks/out/keep-official-errors.json)、两份冻结 checks、
Bookstack 完整官方报告以及各样本 results。对未隔离的时序因果明确保留不确定性，
没有将猜测写成已验证根因。

## 6. 官方 pass → 本地 fail 的全部场景

### Keep 第 5 局：16 个

| 场景 | 本地失败原因 | 分类 |
|---|---|---|
| REQ-1.1、REQ-2.8.3、REQ-3.1、REQ-5.1、REQ-5.2 | 将 “Take a note” 编成 `getByText`；实际为输入框 label/placeholder，文本匹配 count=0，而官方 ladder 能命中。 | 编译定位错误，5 个 |
| REQ-2.2 | 直接 Escape 作为保存关闭。实测编辑器仍在、未创建笔记；官方先点击 Close/Done。 | 编译操作错误，1 个 |
| REQ-2.4 | 把填写正文限定在标题 `Project ideas` 文本元素内，编辑字段不在其子树。 | 编译作用域错误，1 个 |
| REQ-2.5.1、REQ-2.5.2 | Archive 被限定在笔记标题文本元素内；该子树无按钮，全页 ladder 有可见 Archive。 | 编译作用域错误，2 个 |
| REQ-2.7.1、REQ-2.7.2 | 将 Change labels 限定为 menuitem；该应用实际是普通 button。 | 编译 role 错误，2 个 |
| REQ-2.7.6.1、REQ-2.7.6.2、REQ-2.7.6.3 | 将 Work/Reminders 限定为 link；该应用侧栏为 menuitem。 | 编译 role 错误，3 个 |
| REQ-4.1 | 要求精确 Settings button；实际可达入口由 ladder 的 Settings menuitem 命中。 | 编译 role/exact 错误，1 个 |
| REQ-6.2 | 猜测 collapse/hide/minimize sidebar 名称；实际入口名为 Menu，所有猜测候选为空。 | 编译名称错误，1 个 |

### Keep 第 7 局：7 个

| 场景 | 本地失败原因 | 分类 |
|---|---|---|
| REQ-2.2、REQ-2.8.3 | 直接 Escape 关闭编辑器，没有点击执行保存的 Close；然后找不到新建笔记。源码确认 POST 在 Close handler 内，overlay Escape 只关闭。 | 编译操作错误，2 个 |
| REQ-2.4、REQ-2.5.1、REQ-2.5.2 | 同样把字段／按钮限定在标题文本子树内。 | 编译作用域错误，3 个 |
| REQ-2.8.2 | 只接受 Unpin note/Unpin，缺少官方的 `/pin/i` 后备；该应用按钮始终标为 Pin。 | 编译备用名称不完整，1 个 |
| REQ-6.2 | 猜测的 collapse/hide/minimize 名称均不存在；官方使用 menu/sidebar 名称。 | 编译名称错误，1 个 |

### Bookstack：4 个

| 场景 | 本地失败原因 | 分类 |
|---|---|---|
| REQ-4.4.2 | 将 Delete 限定为 button；详情入口实际为 `<a ...>Delete</a>`。 | 编译 role 错误，1 个 |
| REQ-5.1、REQ-5.2.1、REQ-5.4.2 | 非精确 `Books` 被转成 `/Books/i`，优先命中首页品牌链接 **BookStack**，未进入书籍列表，随后找不到目标书籍。官方使用 `/^Books$/i`。 | 编译匹配错误，3 个 |

[Keep 浏览器诊断](../checks/out/keep-diagnostics.json) 记录实际 DOM 与 resolver 选择；
[Bookstack 浏览器诊断](../checks/out/bookstack-diagnostics.json) 明确记录两条 `/Books/i`
候选的顺序、href 和 Delete 的 role。诊断脚本与输出均保留，未将诊断延迟加入评分测试。
Keep 7 诊断中最后一次 store 读取连接失败，因此保存行为的归因还引用了源码与正式
校准失败步骤，不以该失败的读取推断持久化结果。

## 7. 执行器本身的限制

没有发现解释器把 JSON 中的已支持操作执行成其他操作的证据；本轮 27 个假失败
都有上述具体编译目标／操作差异。但执行层也尚未满足可靠验收工具的要求：

1. **Bookstack 并未使用其自己的完整官方协议。** 按 brief 采用 Keep 的四个原样函数，
   Bookstack 差异以注释说明；其 firstVisible 无 count 后备，click/expect 阶梯也不同。
   三个留出假通过都发生在官方的早期定位失败附近，不能将这项差异忽略。
2. **超时诊断太晚。** 60 个本地 fail 中，58 个 `resolver.candidates` 为空。
   失败步骤及选择的 locator 字符串保留了，但超时后再采集 DOM 经常碰到页面关闭。
   `rungHit` 目前表示选定的查询阶梯，不保证该阶梯最终有实际元素命中。
3. **fail 对 fail 不自动代表抓到同一缺陷。** 例如 Keep 的 REQ-2.5.3/2.5.4 在本地
   先因错误 scope 失败，不能宣称识别了官方跨场景归档问题。Bookstack 多个后续场景
   也先被 Books/BookStack 误匹配挡住，没有走到官方报错处。
4. **费用预留有未验证假设。** Keep REQ-2 调用请求 `max_tokens=10000`，gateway
   仍返回 15,564 completion tokens（其中 14,394 reasoning）。现有预留不能证明
   包括推理 token 的严格单次上界。本轮所有成功响应均有 usage，实际总费低于 8，
   没有未结算预留；下一次大额使用前应修正此假设。

## 8. 词汇表最终形态

| 能力 | 实际 Step / Target |
|---|---|
| 定位 | 字符串／序列化 regex、有序备用名称、exact、ladder/text/role/field、递归 within |
| 基础操作 | open、click、hover、fill、check（可含 click 后备）、press、selectOption；role 可选择 radio |
| 文本与反馈 | expectText、expectAbsent（DOM count=0）、expectFeedback、expectField（字符串／正则／变量） |
| 数量与状态 | expectCount、expectState：visible/hidden/checked/disabled/enabled/editable |
| 值与观测 | bind（source）、capture：text/value/count/screenshot、compare：equal/notEqual |
| 受限分支 | if（visible/exists）、try/fallback；任一分支 unknown 保守传播至整个场景 |
| 编译不确定性 | unknown.reason：unsupported / no-preparation-path / ambiguous-assertion，附 detail |

没有日期、排序或范围断言。Keep 指定的四个 ladder 函数已逐字比对原文件，函数体未改。
增加词汇并没有自动补齐准备状态、可靠作用域与断言含义，这是本轮校准的主要结果。

## 9. 费用与验证

按 gateway usage 和仓库确认的价格 CNY 3 / 0.1 / 9 每百万未缓存输入／缓存输入／输出
计算，**总费 CNY 1.9249914（汇报保留六位为 1.924991）**，低于 CNY 8。

| 应用 | 有 usage 的调用数 | 输入 token | 缓存输入 | 输出 token（含推理） | 其中推理 | CNY |
|---|---:|---:|---:|---:|---:|---:|
| Keep | 13 | 164,751 | 125,696 | 78,159 | 67,959 | 0.8331656 |
| Bookstack | 21 | 310,709 | 260,608 | 101,718 | 87,609 | 1.0918258 |
| 合计 | 34 | 475,460 | 386,304 | 179,877 | 155,568 | 1.9249914 |

两次旧沙箱 DNS 失败仍在账本中，费用为 0。两次 schema 修正的调用及推理 token 均已
计费；没有 qwen 对比，没有隐藏重试。请求、完整响应和用量在各 app 的 `out/` 目录，
[usage.json](../checks/out/usage.json) 是费用真源。

- `npm test`：**18/18 通过**，含真实 Bookstack 根标题识别的新增回归测试。
- `npm run typecheck`：通过。
- 项目 Python 全套：**420 tests，OK，46 skipped**；本轮解除沙箱后实测，替代旧阻塞结论。
- 三个 calibration JSON 已通过离线重新计算与 checks SHA-256 核验。
- 三份校准、官方 Bookstack 及诊断使用的 7 个后端地址均已确认关闭；临时应用副本已清理。
  见 [后端清理核验](../checks/out/validation/backend-cleanup.json)。
- 单元测试中的 synthetic fixture 不作为模型质量或浏览器一致性证据。

日志：[Vitest](../checks/out/validation/vitest-resumed.log)、
[TypeScript](../checks/out/validation/typecheck-resumed.log)、
[Python](../checks/out/validation/python-unittest-resumed.log)、
[矩阵复算](../checks/out/validation/recomputed-matrices.log)。

## 10. 复现与下一步

完整编译、起应用与校准命令见 [checks/README.md](../checks/README.md)。无需模型、
无需重新起服务器即可精确复算本轮数字：

```sh
cd ~/projects/volo-factory-worktrees/ts-kernel/checks
export PATH=~/.nvm/versions/node/v22.22.0/bin:$PATH
node --import tsx out/recompute-calibration.mjs
```

它读取保留的 checks/results/官方摘要，对比每一项矩阵、unknown、假通过与 SHA-256；
不一致即失败。重新执行浏览器完整套件可能受到异步时序影响，不能保证与单次观测逐位相同。

建议下一版只处理已证实的通用问题：

1. 为导航 exact、操作备用名称、scope 容器和保存关闭路径建立可核对的界面合约；
   不能从语义名词直接猜 ARIA role，也不能把标题节点当卡片容器。
2. 为 Bookstack 独立保留官方执行策略；让失败发生前的候选／实际命中证据可用。
3. 明确哪些 THEN 观测只做需求诊断、哪些经过校准后才可预测官方结果，再处理五个 unknown。
4. 保留本轮冻结版本和负面基线，修订另出新版本。**本轮不启用自动修复控制，不继续付费调参。**

所有步骤已分别提交；报告结论是“校准完成且不通过”，不是“组件已经可靠”。

## 第二轮

### 结论与口径

Qwen 的三份校准已完成。按本轮新口径，unknown 从召回率分母排除，
但仍保留在固定场景总数和覆盖率中；无可观测官方通过场景时，召回为 null，不能判达标。
第一轮原始口径不覆盖修改，下面同时列出可比较的排除 unknown 口径。

DeepSeek 对照已完成，三份结果与 Qwen 并列。

| 样本 | 版本 | 本地 pass / fail / unknown | 假通过 | 排除 unknown 的召回 | 固定官方通过分母的召回 | 覆盖率 | 本轮判据 |
|---|---|---:|---:|---:|---:|---:|---|
| Keep 第 5 局 | 第一轮 | 5 / 22 / 5 | 1 | 20.0% (4/20) | 16.0% | 84.4% | 未达标 |
| Keep 第 5 局 | 第二轮 Qwen | 7 / 1 / 24 | 0 | 100.0% (7/7) | 28.0% | 25.0% | 达标 |
| Keep 第 5 局 | 第二轮 DeepSeek | 9 / 11 / 12 | 0 | 52.9% (9/17) | 36.0% | 62.5% | 未达标 |
| Keep 第 7 局 | 第一轮 | 13 / 14 / 5 | 2 | 61.1% (11/18) | 50.0% | 84.4% | 未达标 |
| Keep 第 7 局 | 第二轮 Qwen | 7 / 1 / 24 | 1 | 100.0% (6/6) | 27.3% | 25.0% | 未达标 |
| Keep 第 7 局 | 第二轮 DeepSeek | 9 / 11 / 12 | 2 | 53.8% (7/13) | 31.8% | 62.5% | 未达标 |
| Bookstack 第 2 局 | 第一轮 | 10 / 24 / 0 | 3 | 63.6% (7/11) | 63.6% | 100.0% | 未达标 |
| Bookstack 第 2 局 | 第二轮 Qwen | 1 / 6 / 27 | 1 | 0.0% (0/5) | 0.0% | 20.6% | 未达标 |
| Bookstack 第 2 局 | 第二轮 DeepSeek | 6 / 10 / 18 | 2 | 57.1% (4/7) | 36.4% | 47.1% | 未达标 |

**排除 unknown 后的高召回不等于广泛覆盖。** Qwen 在 Keep 只执行 8/32 个场景，在 Bookstack 只执行 7/34 个；第一轮假通过变成 unknown 也不能算“识别了原来的缺陷”。

### 三张主矩阵与第一轮并排

每格为 **官方 pass / 官方 fail** 的数量；行是本地判定。

#### Keep 第 5 局

| 本地判定 | 第一轮 | 第二轮 Qwen | 第二轮 DeepSeek |
|---|---:|---:|---:|
| pass | 4 / 1 | 7 / 0 | 9 / 0 |
| fail | 16 / 6 | 0 / 1 | 8 / 3 |
| unknown | 5 / 0 | 18 / 6 | 8 / 4 |

[Qwen calibration](../checks/out/round2/qwen/keep-5/calibration.json) · [Qwen results](../checks/out/round2/qwen/keep-5/results.json)

#### Keep 第 7 局

| 本地判定 | 第一轮 | 第二轮 Qwen | 第二轮 DeepSeek |
|---|---:|---:|---:|
| pass | 11 / 2 | 6 / 1 | 7 / 2 |
| fail | 7 / 7 | 0 / 1 | 6 / 5 |
| unknown | 4 / 1 | 16 / 8 | 9 / 3 |

[Qwen calibration](../checks/out/round2/qwen/keep-7/calibration.json) · [Qwen results](../checks/out/round2/qwen/keep-7/results.json)

#### Bookstack 第 2 局

| 本地判定 | 第一轮 | 第二轮 Qwen | 第二轮 DeepSeek |
|---|---:|---:|---:|
| pass | 7 / 3 | 0 / 1 | 4 / 2 |
| fail | 4 / 20 | 5 / 1 | 3 / 7 |
| unknown | 0 / 0 | 6 / 21 | 4 / 14 |

[Qwen calibration](../checks/out/round2/qwen/bookstack-2/calibration.json) · [Qwen results](../checks/out/round2/qwen/bookstack-2/results.json)

### 仍然假通过的场景

| 模型 / 样本 / 场景 | 已观察差异与原因 |
|---|---|
| qwen / Keep 第 7 局 / REQ-2.7.6.2#1 | 本轮 GIVEN 只有打开首页，直接点 Notes；官方先按 Work 过滤再返回 Notes，失败时落到 /^notes$/ 的 button 后备。删掉准备路径后，跨页面状态与原故障没有被复现。不是已经修复官方失败。 |
| qwen / Bookstack 第 2 局 / REQ-4.2.1#1 | 本轮已无前置 expect，仍能点击 Shelf 4.2.1；官方在该步骤落到不存在的 button 后备并超时。本地仍是 Keep 的十级 resolveNamed 和 count/重复解析后备，Bookstack 官方是较短的 firstVisible。执行协议/采样时序差异仍存在；没有单独隔离各次解析的时序贡献。 |
| deepseek / Keep 第 7 局 / REQ-2.7.6.2#1 | 本轮 GIVEN 只有打开首页，直接点 Notes；官方先按 Work 过滤再返回 Notes，失败时落到 /^notes$/ 的 button 后备。删掉准备路径后，跨页面状态与原故障没有被复现。不是已经修复官方失败。 |
| deepseek / Keep 第 7 局 / REQ-6.1#1 | DeepSeek 只断言 Notes 可见；官方依次检查 Notes、Reminders、Edit labels、Archive、Trash，并实际失败在 Edit labels。属于编译漏断言，不能用一个导航项代表整条场景。 |
| deepseek / Bookstack 第 2 局 / REQ-4.3.2#1 | DeepSeek 只导航至新建页、点击 Cancel、断言原种子书架标题可见；官方此前在点击 Shelf 4.3.2 时落到 button 后备并超时。即使已删除额外 expect，不同 helper/异步解析仍可绕开原失败；末尾断言也未证明未创建新记录。 |
| deepseek / Bookstack 第 2 局 / REQ-4.5.2#1 | DeepSeek 导航至编辑页后直接 Cancel，只断言原书架标题。官方实际失败在精确 Edit 的 button 后备；本地解析时序不同，同时没有修改字段或验证原描述，存在编译漏测。 |

Qwen 的 Bookstack 召回为 0/5：REQ-1.1、REQ-2.1、REQ-4.1、REQ-5.1 把需求 prose 中的 `homepage`、`login form page`、`shelf list page`、`books list page` 当成实际 UI 文本；REQ-5.2.1 先用非精确 Books 导航，仍可能命中 BookStack 品牌链接，随后找不到目标书籍。名称“来自原文”并不证明它是页面可见文本。

### 编译与执行约束及校验过程

- 新增独立 version=2 格式：GIVEN 仅 open/click；WHEN 按原句分组且最多两步，只允许 hover/click/fill/check/press；THEN 仅 expectText/expectAbsent。严格对象拒绝 role、via、exact、within 和其他操作。unknown 是整个 Check 的状态，不混入可执行阶段。
- 名称由原文/种子来源校验；本轮裸动作词按当前 WHEN 原句核对，共享的引号/反引号字面量可复用。hover 必须是种子标题，实际执行却始终调用原样 hoverNamed/resolveNamed。fill 使用原样 fillField。没有增加动作前可见性探测、等待或条件后备。
- 模型不知道官方结果和 tests 内容。Qwen 输入最初含重复的共享词汇/祖先信息；DeepSeek 重试将这些相同信息去重到顶层，完整需求和合约未删除。这不是逐字相同请求的成本比较。
- 最小导航是语义要求，不能只靠结构 schema 证明。运行前检查发现模型把 Trash/Archived 的 WHEN 点击移动到 GIVEN，于是补上初始页额外导航和空动作 WHEN 的拒绝条件。原响应离线重新校验，没有付费重写来迎合官方结果。早期两份运行留在 `out/round2/qwen/before-phase-fix/`，不纳入最终矩阵。
- 修正了普通空格和 \s+ 等价形式被误拒的来源校验 bug；保留原始请求、响应和修改前产物。随后修正了含点号的引号种子名被误拒的问题；四份响应离线重验后 Keep 哈希不变，仅重新运行两个 Bookstack 套件，旧结果留在 `out/round2/before-literal-fix/`。最终 artifacts 使用新校验，原始响应未修改。
- 语义完整性仍是模型错误来源：DeepSeek 的 REQ-2.3.1 省略 More options，REQ-2.4 省略关闭编辑器，REQ-2.7.1/2 省略菜单准备。它们满足结构上的两步上限，却没有完整执行原 WHEN，保留这些失败作为对照，不能把执行覆盖率当成语义覆盖率。
- 四个 worker、10 秒用例上限、默认 Playwright expect 5 秒、默认 actionTimeout=0（由用例时限约束）、trace/video off。第一轮 expect=10 秒，本轮这一差异来自用户要求，不能把变化完全归因于模型或提示词。

### unknown 逐条清单

这里记录编译输出本身的原因，不把每个理由都当作正确的能力边界。例如 Qwen 在 REQ-4.2 声称 GIVEN 不能 click，实际规则允许必要的导航点击；这属于模型过于保守。

#### qwen / keep：24/32

| 场景 | category | reason | 原因 |
|---|---|---|---|
| REQ-2.2#1 Create Note | create | unsupported | Single WHEN sentence contains click, fill title, fill content, and close actions exceeding the two-step limit. |
| REQ-2.3.1#1 Delete | delete | unsupported | WHEN requires hover, click More options, and click Delete Note in one sentence, exceeding the 2-step limit. |
| REQ-2.3.2#1 Notification and Undo | state-toggle | no-preparation-path | Cannot prepare deleted-note state in GIVEN without performing delete operations. |
| REQ-2.3.3#1 Trash list | read-list | unsupported | 校验拒绝：Click must name an original verb or quoted literal: Trash |
| REQ-2.4#1 Update Note | edit | unsupported | Single WHEN sentence contains open, edit, and close actions exceeding the two-step limit. |
| REQ-2.5.1#1 Archive | state-toggle | ambiguous-assertion | Cannot assert note moved to archive list using only expectText or expectAbsent on the current page. |
| REQ-2.5.2#1 Archive Undo | state-toggle | no-preparation-path | Cannot prepare archive notification state in GIVEN without performing archive operations. |
| REQ-2.5.3#1 Show archived notes | read-list | unsupported | 校验拒绝：Click must name an original verb or quoted literal: Archived |
| REQ-2.6.1#1 Change note color | edit | ambiguous-assertion | Color change is a visual style property that cannot be verified with expectText or expectAbsent. |
| REQ-2.6.2#1 Choose note color when created | create | unsupported | Single WHEN sentence contains multiple actions exceeding the two-step limit. |
| REQ-2.7.1#1 Assign label to a note | edit | unsupported | Single WHEN sentence contains three sequential actions exceeding the two-step limit. |
| REQ-2.7.2#1 Remove label from a note | edit | unsupported | Single WHEN sentence contains three sequential actions exceeding the two-step limit. |
| REQ-2.7.4#1 Assign default label when creating note | create | no-preparation-path | Cannot open Take a note editor in GIVEN without a click, and WHEN has too many actions. |
| REQ-2.7.5#1 Edit labels | edit | unsupported | Single WHEN sentence contains three sequential actions exceeding the two-step limit. |
| REQ-2.8.1#1 Pin note | state-toggle | ambiguous-assertion | Pin state and pinned section placement are visual properties not verifiable with expectText or expectAbsent. |
| REQ-2.8.2#1 Unpin note | state-toggle | no-preparation-path | Cannot prepare pinned note state in GIVEN without performing pin operations. |
| REQ-2.8.3#1 Pin note when creating it | create | no-preparation-path | Cannot open Take a note editor in GIVEN without a click, and WHEN has too many actions. |
| REQ-3.1#1 Initial suggested filters | search-filter-sort | ambiguous-assertion | No specific filter name or expected result text available for expectText assertion. |
| REQ-4.1#1 Setting options list | navigation | ambiguous-assertion | No specific settings option text available for expectText assertion. |
| REQ-4.2#1 Detailed settings | navigation | no-preparation-path | Cannot prepare settings dropdown open state in GIVEN without a click. |
| REQ-5.1#1 Toggle between list and grid views | state-toggle | ambiguous-assertion | View mode switching is a layout property not verifiable with expectText or expectAbsent. |
| REQ-5.2#1 Grid View by default | read-list | ambiguous-assertion | Grid view default and toolbar toggle visibility are layout properties not verifiable with expectText or expectAbsent. |
| REQ-6.1#1 Items and styling | read-list | ambiguous-assertion | Sidebar styling and icon consistency are visual properties not verifiable with expectText or expectAbsent. |
| REQ-6.2#1 Collapsible Sidebar | state-toggle | ambiguous-assertion | Sidebar collapse and expand states are layout properties not verifiable with expectText or expectAbsent. |

#### qwen / bookstack：27/34

| 场景 | category | reason | 原因 |
|---|---|---|---|
| REQ-1.2#1 Back to Homepage from Other Pages | read-list | unsupported | 校验拒绝：Click must name an original verb or quoted literal: BookStack logo |
| REQ-2.2#1 Log In Successfully | create | unsupported | Single WHEN sentence contains four distinct operations exceeding the two-step maximum. |
| REQ-3.1#1 Enter Authenticated Homepage | read-list | no-preparation-path | Cannot reach authenticated homepage because login workflow exceeds the two-step WHEN cap. |
| REQ-4.3.1#1 Create Shelf | create | unsupported | Create workflow requires more than two operations in a single WHEN sentence. |
| REQ-4.3.2#1 Cancel Creation | create | no-preparation-path | Cannot navigate to shelf creation page within allowed GIVEN steps. |
| REQ-4.4.1#1 Confirm Delete Shelf | delete | unsupported | Delete confirmation spans multiple pages requiring more than two steps in one sentence. |
| REQ-4.4.2#1 Cancel Delete Shelf | delete | no-preparation-path | Cannot prepare delete confirmation page state within allowed GIVEN navigation. |
| REQ-4.5.1#1 Save Shelf Edits | edit | unsupported | Edit workflow requires more than two operations in a single WHEN sentence. |
| REQ-4.5.2#1 Cancel Shelf Edits | edit | no-preparation-path | Cannot prepare shelf edit page state within allowed GIVEN navigation. |
| REQ-5.3.1#1 Fill out and Save Book | create | unsupported | Create workflow requires more than two operations in a single WHEN sentence. |
| REQ-5.3.2#1 Cancel Creating Book | create | no-preparation-path | Cannot navigate to create new book page within allowed GIVEN steps. |
| REQ-5.4.1#1 Save Book Edits | edit | unsupported | Edit workflow requires more than two operations in a single WHEN sentence. |
| REQ-5.4.2#1 Cancel Book Edits | edit | no-preparation-path | Cannot prepare book edit page state within allowed GIVEN navigation. |
| REQ-5.5.1#1 Confirm Delete Book | delete | unsupported | Delete confirmation spans multiple pages requiring more than two steps in one sentence. |
| REQ-5.5.2#1 Cancel Delete Book | delete | no-preparation-path | Cannot prepare delete confirmation page state within allowed GIVEN navigation. |
| REQ-5.6.1#1 Fill out and Save Book with Shelf | create | unsupported | Create workflow requires more than two operations in a single WHEN sentence. |
| REQ-6.1.1#1 Save Page | create | unsupported | Create workflow requires more than two operations in a single WHEN sentence. |
| REQ-6.1.2#1 Save Draft | create | unsupported | Draft save requires filling content and clicking an unnamed save draft control, ambiguous within 2 steps. |
| REQ-6.1.3#1 Delete Draft | delete | unsupported | Delete draft workflow requires more than two operations in a single WHEN sentence. |
| REQ-6.2.1#1 Create Chapter | create | unsupported | Create workflow requires more than two operations in a single WHEN sentence. |
| REQ-6.3.1#1 Enter Page Reading Page | navigation | no-preparation-path | Cannot prepare a page list view within allowed GIVEN navigation without prior creation workflows. |
| REQ-6.3.2#1 Redirect to Page Edit Page | edit | no-preparation-path | Cannot prepare page reading page state within allowed GIVEN navigation. |
| REQ-7.1#1 Add to Recently Viewed | state-toggle | ambiguous-assertion | WHEN sentence provides multiple alternative navigation targets that cannot be resolved to a single executable path. |
| REQ-7.2#1 Quick Navigation from Recently Viewed | navigation | no-preparation-path | Cannot seed My Recently Viewed list within allowed GIVEN navigation. |
| REQ-8.1#1 Favorite Items | state-toggle | no-preparation-path | Cannot reach a supported content view to favorite without authentication and prior navigation exceeding limits. |
| REQ-8.2#1 Quick Navigation from Favorites | navigation | no-preparation-path | Cannot seed My Most Viewed Favorites list within allowed GIVEN navigation. |
| REQ-9.1#1 Quick Navigation from Recently Updated | navigation | no-preparation-path | Cannot seed Recently Updated Pages list within allowed GIVEN navigation. |

#### deepseek / keep：12/32

| 场景 | category | reason | 原因 |
|---|---|---|---|
| REQ-2.2#1 Create Note | read-list | unsupported | 校验拒绝：THEN name absent from THEN/literals: New\s+note |
| REQ-2.3.3#1 Trash list | read-list | unsupported | 校验拒绝：Click must name an original verb or quoted literal: Trash |
| REQ-2.5.3#1 Show archived notes | read-list | unsupported | 校验拒绝：Click must name an original verb or quoted literal: Archived |
| REQ-2.6.1#1 Change note color | edit | ambiguous-assertion | The requirement asserts a background color change, which cannot be verified with text presence or absence. |
| REQ-2.6.2#1 Choose note color when created | create | ambiguous-assertion | The requirement asserts the note is saved with a selected color, which cannot be verified with text presence or absence. |
| REQ-2.7.4#1 Assign default label when creating note | read-list | unsupported | 校验拒绝：THEN name absent from THEN/literals: New\s+note |
| REQ-2.7.5#1 Edit labels | edit | unsupported | The workflow requires clicking Edit Labels, changing a label name, and saving, which exceeds the two-step limit per sentence. |
| REQ-2.8.3#1 Pin note when creating it | create | unsupported | The workflow requires entering title, entering content, clicking pin, and closing the editor, which exceeds the two-step limit per sentence. |
| REQ-3.1#1 Initial suggested filters | search-filter-sort | ambiguous-assertion | The suggested filter to choose is not specified, so the expected filtered results cannot be determined. |
| REQ-5.1#1 Toggle between list and grid views | state-toggle | ambiguous-assertion | The requirement asserts a view mode change, which cannot be verified with text presence or absence. |
| REQ-5.2#1 Grid View by default | navigation | ambiguous-assertion | The requirement asserts the default view mode, which cannot be verified with text presence or absence. |
| REQ-6.2#1 Collapsible Sidebar | state-toggle | ambiguous-assertion | The requirement asserts the sidebar collapses and expands, which cannot be verified with text presence or absence. |

#### deepseek / bookstack：18/34

| 场景 | category | reason | 原因 |
|---|---|---|---|
| REQ-1.2#1 Back to Homepage from Other Pages | navigation | ambiguous-assertion | Click name 'BookStack logo' is not a bare action verb or quoted literal; cannot compile. |
| REQ-2.2#1 Log In Successfully | navigation | unsupported | WHEN sentence requires fill email, fill password, check Remember Me, and click Login, exceeding two-step limit. |
| REQ-3.1#1 Enter Authenticated Homepage | read-list | unsupported | WHEN sentence describes system navigation, not user actions; no valid steps. |
| REQ-4.3.1#1 Create Shelf | create | unsupported | WHEN sentence requires click New Shelf, fill information, and click Save Shelf, exceeding two-step limit. |
| REQ-4.4.1#1 Confirm Delete Shelf | delete | unsupported | WHEN sentence requires click Delete and confirm deletion, exceeding two-step limit. |
| REQ-4.5.1#1 Save Shelf Edits | edit | unsupported | WHEN sentence requires click Edit, update information, and click Save Shelf, exceeding two-step limit. |
| REQ-5.3.1#1 Fill out and Save Book | create | unsupported | WHEN sentence requires click Create New Book, fill information, and click Save Book, exceeding two-step limit. |
| REQ-5.4.1#1 Save Book Edits | edit | unsupported | WHEN sentence requires click Edit, update information, and click Save Book, exceeding two-step limit. |
| REQ-5.5.1#1 Confirm Delete Book | delete | unsupported | WHEN sentence requires click Delete and confirm deletion, exceeding two-step limit. |
| REQ-5.6.1#1 Fill out and Save Book with Shelf | create | unsupported | WHEN sentence requires click Create New Book, fill information, and click Save Book, exceeding two-step limit. |
| REQ-6.1.1#1 Save Page | create | unsupported | WHEN sentence requires click New Page, fill information, and click Save Page, exceeding two-step limit. |
| REQ-6.1.2#1 Save Draft | create | unsupported | WHEN sentence requires fill content and save draft, exceeding two-step limit. |
| REQ-6.1.3#1 Delete Draft | delete | unsupported | WHEN sentence requires open actions, click Delete Draft, and confirm, exceeding two-step limit. |
| REQ-6.2.1#1 Create Chapter | create | unsupported | WHEN sentence requires click New Chapter, fill information, and click Save Chapter, exceeding two-step limit. |
| REQ-7.1#1 Add to Recently Viewed | read-list | unsupported | 校验拒绝：Exactly one WHEN group per original sentence; do not split comma/AND clauses |
| REQ-7.2#1 Quick Navigation from Recently Viewed | navigation | no-preparation-path | Cannot prepare homepage with recently viewed item without forbidden setup mutations. |
| REQ-8.2#1 Quick Navigation from Favorites | navigation | no-preparation-path | Cannot prepare homepage with favorite item without forbidden setup mutations. |
| REQ-9.1#1 Quick Navigation from Recently Updated | navigation | no-preparation-path | Cannot prepare homepage with recently updated item without forbidden setup mutations. |

### 费用、验证与网络中断记录

- 本轮账本独立于第一轮 CNY 8 预算，限额 **CNY 5**。有 usage 的已知费用 **CNY 1.649094**；未结算预留 **CNY 0.932857**；合计占用 **CNY 2.581951**。预留不是实际账单，不能报告成精确消费。
- Qwen 价目 12/1.5/36，DeepSeek 3/0.1/9；缓存折扣和所有重试均在 [usage.json](../checks/out/round2/usage.json) 中。一次小响应探针另存 [probe](../checks/out/round2/validation/deepseek-probe.json)，用于区分服务故障与输入规模，费用也纳入上面的合计。
- 两模型均请求关闭 thinking；最终 8 次成功 HTTP 调用均有 usage（每个编译任务一次初始输出和一次修正）。DeepSeek Keep 首次 180 秒超时，去重输入重试收到 HTTP 400 proxy_error，说明 gateway→上游转发连接被重置；Bookstack 在 TLS 建立前 ECONNRESET，未发出 HTTP 请求，计费为 0。
- 期间本机 Clash 默认节点及多个备用节点失活，普通 HTTPS 也失败；18:47 复查网关恢复 HTTP 200 后，完成了两份 DeepSeek 编译及三份校准。没有修改共享代理配置，网络恢复提醒已不再阻塞任务。
- TypeScript 和 Vitest 29 项通过。Python 全套实际运行 420 项，1 个 token-budget 测试报错、46 skipped；该报错测试单独重跑通过。没有修改 volo 或用单独重跑冒充整套通过。
- 六份最终矩阵均已离线复算，四份 Check 的结构和来源校验通过；见 [schema audit](../checks/out/round2/validation/schema-audit.json) 和 [复算记录](../checks/out/round2/validation/recomputed.log)。全部测试/诊断后端已关闭，临时应用副本已清理；见 [cleanup](../checks/out/round2/validation/backend-cleanup.json)。

### 复现与判断

```sh
cd ~/projects/volo-factory-worktrees/ts-kernel/checks
export PATH=~/.nvm/versions/node/v22.22.0/bin:$PATH
node --import tsx out/round2/recompute.mjs
```

复算读取冻结 checks、results 与相同的官方摘要，核对 SHA-256 和每个矩阵字段。第一轮原始文件未覆盖。

本轮不支持“把检查变笨就能同时得到高覆盖与零假通过”的结论：Qwen 的 Keep 第 5 局达标主要伴随覆盖范围缩小，第 7 局与 Bookstack 仍有假通过。DeepSeek 对照在更高执行覆盖率下仍未过门槛。下一步应先区分路径缺失、断言缺失和 app 专属执行协议差异，再决定是否保留两步限制；不能通过把更多场景改成 unknown 来宣称泛化或可靠验收。

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

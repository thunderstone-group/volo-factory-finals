# sheet-A 校准记录（order 1–48，REQ-1-*、REQ-2-*、REQ-3-1-*）

## 结论

- 定稿后在 14 个 sheet 应用上各跑一次（`results/cal4`）。本半区 48 条的通过数与隐藏总分：去掉 sheet-1 后，Pearson 0.72、Spearman 0.71；含 sheet-1 时 Pearson 0.92。
- 满分或接近满分的是隐藏 78–82 分的应用：78-ed1e、79-4c98、80-f49b、82 都是 48/48，81 是 47/48。它们丢的 18–22 条隐藏测试，应该基本都在后半区（REQ-3-2 以后）。
- 不含 sheet-1 共 56 条失败，其中 10 条依赖有争议的假设：B1 标题 heading 3 条（79-2c8e），B2 数字框 spinbutton 6 条（78-3ba、59 各 3），B3 透视源表删除确认框 1 条（43）。其余 46 条判为应用缺陷。59 的 6 条里有 2 条同时撞上 A10，改判也照样失败。把能翻的都翻成通过后，Pearson 为 0.76、Spearman 为 0.67，与现状差不多，所以相关性不靠这几条假设撑着。
- 本机 macOS 与官方 Linux 的平台差异只影响 Ctrl+V，已在测试里抹平，见"校准中修掉的测试自身缺陷"。

## 运行方式

- `tools/debug-run.sh` 的设置与 `oracle/run.sh` 相同：同一 Playwright 1.57、1 个 worker、测试和 expect 超时都是 10 s、整套只起一次从不重置的后端、端口 3411。区别只在于保留 `report.json`，并打印每条失败的待定步骤。
- `tools/calibrate.sh cal4` 依次跑全部应用，产出三类文件：
  - `results/cal4/<app>.json`：与 run.sh 同格式；
  - `results/cal4/<app>.txt`：逐条错误；
  - `results/cal4-matrix.md`：测试 × 应用矩阵和失败原因。
- 交叉核对：用官方 `run.sh` 重跑 sheet-80-538e，得到 46/48（`results/runsh-sheet-80-538e.json`），与 cal4 一致。
- 失败原因靠探针确认：`tools/probes/*.body.cjs` 在应用上打印实际行为，只用于判定，不改断言。探针输出在 `results/probes/`；修测试之前的几轮在 `results/superseded/`（cal1–cal3），只作过程记录。

## 各应用通过数

| 应用 | 隐藏总分 | sheet-A 通过 / 48 | 失败条目 |
|---|---|---|---|
| sheet-1-4c35 | 1 | 1 | 除 1-3-1 S2 外全挂：编辑器里没有任何 gridcell |
| sheet-43-b491 | 43 | 42 | 2-1-4 S3；3-1-2 S1–S5 |
| sheet-53-e6cf | 53 | 40 | 2-1-2 S3；2-1-4 S3；2-2-1 S5；2-2-2 S2、S5；3-1-1 S3、S4；3-1-2 S2 |
| sheet-56-a440 | 56 | 36 | 1-3-2 S1、S2；2-1-2 S2；2-2-1 S2、S4；2-2-2 S2、S4；3-1-1 S1–S4；3-1-2 S3 |
| sheet-59-7936 | 59 | 37 | 2-1-2 S3；2-1-4 S3；2-2-1 S1、S3、S4、S5；2-2-2 S1、S3、S4、S5；3-1-2 S2 |
| sheet-69-ad9a | 69 | 43 | 2-1-2 S3；2-2-1 S5；2-2-2 S4、S5；3-1-2 S2 |
| sheet-78-3ba6 | 78 | 45 | 2-2-1 S5；2-2-2 S5；3-1-2 S2 |
| sheet-78-ed1e | 78 | 48 | — |
| sheet-79-2c8e | 79 | 40 | 1-1-1 S1；1-2-2 S1、S2；1-3-1 S4；2-1-1 S2；2-1-3 S1–S3 |
| sheet-79-4c98 | 79 | 48 | — |
| sheet-80-538e | 80 | 46 | 2-2-1 S5；2-2-2 S5 |
| sheet-80-f49b | 80 | 48 | — |
| sheet-81-f686 | 81 | 47 | 2-2-2 S2 |
| sheet-82-fa94 | 82 | 48 | — |

## 失败逐类

### A. 应用缺陷

| 类别 | 应用与条目 | 现象（探针或错误上下文实测） | 依据 |
|---|---|---|---|
| A1 校验规则存了但不拦截 | 53、69：2-1-2 S3、2-2-1 S5、2-2-2 S5、3-1-2 S2 | 规则保存成功，重开对话框能看到 Number range 0/100，但无论从网格还是公式栏写 101 都会被接受；下拉规则保存后不出现 `Open dropdown for C2` | REQ-5-2-1：网格、公式栏、粘贴写入都要执行规则 |
| A2 插入行列后规则没有跟着移动 | 80-538e：2-2-1 S5、2-2-2 S5 | 在第 2 行上方插入后，新空行 B2 和原格 B3 都拒绝 101，规则被复制或留在原地址 | REQ-2-2-1/2-2-2：规则随原单元格一起移动 |
| A3 删除被引用列后显示 `#ERROR!` | 81、53：2-2-2 S2 | 删除 B 列后公式格显示 `#ERROR!` | 需求明写 `#REF!` |
| A4 插列后公式引用没有改写 | 69：2-2-2 S4 | 插列前 C1=30；插入后 D1 显示 10，仍按旧的 A1+B1 计算 | "affected formulas display the adjusted original formulas" |
| A5 公式引擎算错 | 56：1-3-2 S1/S2、2-1-2 S2、2-2-1 S4、2-2-2 S2/S4、3-1-1 S1/S3、3-1-2 S3 | `=A1+B1`（2、3）得 2，刷新后又变成 4；导入的数字文本按 0 参与计算。探针在每步之间加了等待，结果依然错，排除了测试录入太快的竞态 | REQ-3-1-1、REQ-4 |
| A6 Escape 反而提交 | 56：3-1-1 S2 | Escape 后 A1 变成 Unsaved value | 需求：Escape 取消未提交的编辑 |
| A7 行内编辑器按 Enter 不提交 | 53：3-1-1 S3、S4 | `Edit A1` 按 Enter 后仍然打开，单元格为空；键盘 Enter 同样无效 | 需求：Enter 提交 |
| A8 网格只渲染已用区域 | 56：2-2-1 S2（A4 不存在）、3-1-1 S4（F12 不存在） | 删除一行后网格只剩 3 行；录入到 D8 后网格也只有 A–F × 1–8 | 模仿 Google Sheets 的空白单元格应可选中、可录入 |
| A9 外部粘贴无效，且没有网格右键菜单 | 43：3-1-2 S1–S5 | 选中格后焦点落在一个 input 上，Control+V、Meta+V、合成 paste 事件都不写入网格；右键单元格没有任何 menuitem | 需求：Ctrl+V 与右键 `Paste` 都要粘贴外部剪贴板 |
| A10 插入行列无效 | 59：2-2-1 S1/S3/S4、2-2-2 S1/S3/S4 | 菜单项存在，点击后数据不动，刷新后也不动（删除行是好的） | 需求 |
| A11 透视结果不写进 Pivot1 的单元格 | 53、59：2-1-4 S3 | 结果画在网格外的独立表格里（59 另有名为 "Pivot results" 的 grid），Pivot1 的 A1 为空；53 还多出一列 Grand Total、缺少 `SUM of Sales` | REQ-5-3-1：A1 为行字段名，B1 为 `SUM of Sales` |
| A12 删除透视源表时不弹确认框 | 43：2-1-4 S3 | 点 Delete 立即提示 `Please delete or rebuild dependent pivot tables first`，不出现 `Delete worksheet` 对话框 | 需求写的是"确认被拒绝，对话框关闭"，旧版场景也是"clicks Delete and confirms"。这一条有宽松读法，见 B3 |
| A13 字段被错误的 aria-label 覆盖 | 79-2c8e：2-1-3 S1–S3、2-1-1 S2 | 改名对话框里的输入框可访问名是 `Workbook name`，不是 `Worksheet name` | 需求原文 |
| A14 CRLF 行尾的 CSV 导入失败 | 79-2c8e：1-3-1 S4 | 导入后编辑器没有打开网格 | RFC 4180 的合法 CSV |
| A15 整个编辑器不可用 | sheet-1：47 条 | 编辑器里没有 gridcell | — |
| A16 下拉规则没有下拉入口 | 59：2-1-2 S3 | 规则已保存（重开对话框能看到 Dropdown / `Open, Closed`），非法值也被拒绝，但不出现 `Open dropdown for C2`，拒绝提示还是数字模板 "Please enter a number between undefined and undefined" | REQ-5-2-1 |

### B. 测试假设可能不对

| 编号 | 应用与条目 | 现象 | 我的读法 | 如果假设错了 |
|---|---|---|---|---|
| B1 | 79-2c8e：1-1-1 S1、1-2-2 S1、1-2-2 S2 | 编辑器标题是 `<span>`，不是 heading | 需求只说 "editor title"，我按 heading 定位 | 该应用本半区从 40 变为 43 |
| B2 | 78-3ba、59：2-2-1 S5、2-2-2 S5、3-1-2 S2 | `Minimum`/`Maximum` 是 `<input type=number>`，角色是 spinbutton | 需求原文是 "text boxes labeled"，按 textbox 定位 | 78-3ba 从 45 变为 48；59 的 2-2-1 S5、2-2-2 S5 仍会因 A10 失败，最多 +1 |
| B3 | 43：2-1-4 S3 | 不弹确认框，直接拒绝 | 按"先弹框、确认后拒绝"写 | +1 |

## 校准中修掉的测试自身缺陷

1. 拖选用了预先量好的坐标。sheet-69 的 CSS 让每个单元格占满整行，B3 落在视口外，拖选结果变成 A1:E1，连带 2-1-4 S3/S4、3-1-3 S1/S2 失败。改用 `dragTo(target, { steps: 5 })`，Playwright 会在按下后重新定位并滚动目标；修后 69 从 39 升到 43。
2. macOS 上 Ctrl+V 与 Linux 行为不同。第一版在 macOS 上补发合成 paste 事件，这对"按平台选修饰键"或"靠原生粘贴进隐藏输入框"的应用都不等价。改为：先按 `Control+V`，若页面没有 preventDefault，再按 `Meta+V`，由 Playwright 映射成原生 paste 命令。改后各应用的粘贴结果不变，43 在任何方式下都粘贴不进去。
3. REQ-2-1-4 S4 原先要求透视结果 B4=2000 才继续，把 REQ-5-3-1 的结果布局耦合进来了。改为等页面出现 `Grand Total` 文本即可；53、59 因此各 +1。
4. 模态对话框开着时断言背后的 tab（2-1-3 S2/S3）。有的实现会把背景设成 aria-hidden，所以首轮前就改成刷新后再断言。
5. 首轮校准时，我在同一端口上跑探针，杀掉了正在跑的 sheet-59 后端，那一轮的 59 结果作废。之后的探针都在校准间隙串行执行。另外 cal3 的 sheet-1 被外部 SIGTERM 中断过一次，已单独重跑；cal4 全程完整。

## 其他观察

- 种子：13 个能打开的应用里，`Q3 Sales` 的 Sheet1 都是 Region/Sales/Status 表（East/1200/Open、North/800/Closed、South/700/Open），其余工作表各不相同：
  - Sheet2 有的为空，有的是 Item/Qty；
  - 有的另有公式表 `Formulas`，或 Sheet3/Sheet4；
  - 79-2c8e 在第 6–7 行多出 East/1200、North/800。

  本半区只有 REQ-1-1-1 读种子（A1=Region、Sheet1），所以这些差异不影响本半区结果。若隐藏测试的 REQ-2 依赖"Q3 Sales 只有 Sheet1 和 Sheet2"，78-3ba、78-ed1e、79-*、82 这几个多了表的应用会在隐藏测试里吃亏，而我的测试看不出来。
- sheet-43 本半区 42/48，隐藏总分却只有 43，说明后半区几乎全挂，或者官方运行中途出了问题（例如后端在后半区崩溃）。需要和 sheet-B 的结果交叉看。
- 应用速度不是问题：最慢的通过用例约 1 s，远低于 10 s。

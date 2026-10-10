# sheet-B 测试说明（order 49–100，REQ-3-2-* / REQ-4-* / REQ-5-*）

数值多数取自 v1 原场景（`~/projects/arcbench-campaign/evidence/2026-09-24-hackathon/requirements/hackathon--sheet/requirements.yaml`，未遮蔽的场景原文，覆盖本半区 24 条）；v2 新增场景按 hidden_intent_zh + description 自拟数据。几处写法按带逐条标签的 v1 应用校准过，见 calibration.md。

52 条测试，文件 `tests/50-REQ-3-2-1.spec.cjs` … `tests/59-REQ-5-3-1.spec.cjs`，标题 `<req> S<n>: <hidden_intent_zh>`，顺序与 intents.json 的 order 一致（脚本核对过）。
测试文件由 `work/build.py` 把 `work/helpers.block.cjs`（公共 helper）和 `work/bodies/*.cjs`（测试体）拼成；改 helper 只改 block 再重建。

## 通用做法与全局假设

| 项 | 做法 | 依据 / 假设 |
|---|---|---|
| 数据隔离 | 每条测试从 `/` 点 `New blank workbook` → `Create` 建自己的工作簿，不碰种子 `Q3 Sales` | v2 各需求 GIVEN 种子互相矛盾（A1=Region / Item / 2），只能各建各的；v1 原场景写的就是 "fresh preconfigured worksheet / new workbook" |
| 录入 | 选中格 → 填 `Formula bar` → Enter；场景没点名公式栏的 WHEN 录入（REQ-4-1-1 S2、REQ-4-2-2 S1）改走网格双击 `Edit <cell>` | 后者用带标签的 v1 应用校准：这两条隐藏测试在无内联编辑器的应用上失败 |
| 拖选 | `cell(A1).dragTo(cell(B2))`：按下、移到对角格、松开，目标不在视口时先滚动 | 校准时发现自写的分步 mouse.move 在布局异常（单元格竖排超出视口）的应用上拖不到目标，而隐藏测试在同类应用上显然能拖选，改用 Playwright 标准拖拽 |
| 定位 | `gridcell` 精确坐标名（页面级）、`textbox "Formula bar"`、`rowheader "3"`、`columnheader "B"`、`tab "Pivot1"`、`region "Pivot table editor"`、`dialog "<名字>"` | 全部取自需求 description |
| 断言值 | 普通格 `toHaveText(精确值)`，空格 `''`；带下拉按钮的格用 `toContainText(值)`，且不点击该格 | 需求没规定按钮里放不放字形（▾），也有应用把按钮压在格子正中，点格子会打开下拉；这两点都不属于需求，不让它们影响取值判断（假设） |
| 持久化 | `page.reload()` 后重断言；透视表刷新后再点 `Pivot1` 标签 | brief 规定 |
| 快捷键 | Ctrl+C/X/V/Z/Y 按 Linux Chromium 的方式：keydown 带 ctrlKey，且浏览器原生触发 copy/cut/paste 事件。macOS 上 Chromium 不把 Control+C 当编辑命令，helper 用 CDP 给同一个按键附上编辑命令来模拟 Linux | 官方运行器在 Linux；不模拟的话只监听 copy/paste 事件的应用会在本机误判 |
| 外部剪贴板 | 授权 clipboard 权限 → `navigator.clipboard.writeText(TSV)` → Ctrl+V | 只在外部粘贴测试里授权；应用内复制剪切不授权 |
| 组合框 | 点 combobox → 按 role=option + 可见名点选项 | 需求写明"Options in named combo boxes use the ARIA option role"；用带标签的 v1 应用校准：该应用是原生 `<select>`，隐藏测试凡用组合框的全挂，说明隐藏测试是点 option 的写法 |
| 消息 | `page.getByText(完整消息句)` 可见（整句子串匹配，严格模式要求唯一） | 需求给出的原文 |
| 筛选隐藏行 | 隐藏行的 gridcell `toBeHidden()` | 需求只说 hidden，不限定实现 |
| Clear filter | `Data` 菜单里的 menuitem "Clear filter" | **假设**：需求没说位置，v1 原文是 "is selected"，按菜单命令理解；sheet-53 是独立按钮 |
| 校验对话框 | Save 成功后对话框关闭（断言） | 需求写明 |
| 筛选对话框 | Apply 后不断言对话框关闭 | 需求没写 |
| 数字消息 | 0–100 规则的越界用 "Please enter a number from 0 to 100"；其它区间用 "Please enter a number between <min> and <max>" | 按 v2 description 字面：通用 between，0–100 多格/区域操作场景点名 from…to |

## 逐条

| order | 测试 | 意图 | 关键断言 | 假设 / 备注 |
|---|---|---|---|---|
| 49 | REQ-3-2-1 S1 | 复制 A1:B2 到 D1:E2，相对引用调整、绝对引用保留 | A1/B1/A2=1/2/3，B2=`=A1+$B$1`，G1=Keep；拖选 A1→B2，Ctrl+C，点 D1，Ctrl+V → D1:E2=1/2/3/3、源不变、G1 不变；E2 公式栏 `=D1+$B$1`，B2 仍 `=A1+$B$1`；刷新后同 | 数值取自 v1 原场景 |
| 50 | REQ-3-2-1 S2 | 剪切 A1:B2 到 D1:E2，目标写完再清源 | A/B/C/D + G1；Ctrl+X 后源仍显示；粘贴后 D1:E2=A/B/C/D、A1:B2 空、G1 不变；刷新后同 | "剪切时不立即清源"按 description 断言 |
| 51 | REQ-3-2-1 S3 | 剪切目标违反校验时源和目标都不变 | 源 A1:B2=Item/Qty/Pen/4（v2 种子），目标 D1:E2=10/20/30/40 且设 0–100 数值规则；剪切粘贴 → "Please enter a number from 0 to 100"，源和目标原值不变，刷新后同 | 用文本值触发数值规则拒绝 |
| 52 | REQ-3-2-1 S4 | 复制单格到新位置并保留源值 | A2=Pen，Ctrl+C，D4 Ctrl+V → D4=Pen、A2=Pen、B2=4、E4/D5 空；刷新后同 | |
| 53 | REQ-3-2-2 S1 | 撤销后重做并持久化 | A1 唯一值；Undo → 空；Redo → 值；刷新后仍在 | 用工具栏按钮 |
| 54 | REQ-3-2-2 S2 | 撤销后新修改清除重做分支 | 旧值→Undo（Redo 可用）→新值：Redo 禁用；Ctrl+Y 后仍是新值；刷新后仍是新值 | Ctrl+Y 后等 200ms 再做否定断言 |
| 55 | REQ-3-2-2 S3 | 撤销/重做源值编辑同步依赖公式 | A1 2→3，B1=`=A1*2`；Undo → 2/4 且 B1 公式栏 `=A1*2`；Redo → 3/6；刷新后 3/6 + 公式 | v1 原场景 |
| 56 | REQ-3-2-2 S4 | 撤销/重做批量粘贴恢复整个矩形 | B2=Old、A1=Outside；在 B2 粘 `P1\tP2\nP3\tP4`；Undo → B2=Old、其余三格空；Redo → 四格；刷新后同 | |
| 57 | REQ-3-2-2 S5 | 撤销/重做区域移动同时恢复源和目标 | A1:B2=M1..M4、D1=Target；剪切到 D1；Undo → 源回来且 D1=Target、E1/D2/E2 空；Redo → 移动后状态；刷新后同 | |
| 58 | REQ-3-2-2 S6 | 连续撤销/重做行列结构，值和下拉入口一起走 | A1=Keep + 下拉规则（Keep, Drop）；行 1 上插一行、列 A 左插一列，再 Undo×2、Redo×2：值和 "Open dropdown for X" 依次在 A2→B2→A2→A1→A2→B2，旧位置按钮消失且为空；刷新后 B2 | v1 原场景 |
| 59 | REQ-3-2-2 S7 | 一个工作簿的撤销不改另一个 | 工作簿 1 写 A1 → 新建工作簿 2 写 A1 → Undo（工作簿 2 的 A1 变空）→ `page.goto(工作簿1地址)` → A1 仍在 | 只撤销一次。v1 应用上撤销历史跨工作簿，第二次撤销会改到工作簿 1，但隐藏测试在该应用上是通过的，所以隐藏测试只撤销一次；回到工作簿 1 用记下的地址（首页按名字点会撞同名 Untitled） |
| 60 | REQ-4-1-1 S1 | 括号+引用表达式，持久化原公式和结果 | A1=3、B1=4，C1=`=(A1+B1)*2` → 14，公式栏原文；刷新后同 | v1 原场景 |
| 61 | REQ-4-1-1 S2 | 聚合函数忽略空格、函数名大小写不敏感 | B2/B4/B6=2/4/6，网格内编辑录入 D2..D6 = `=sum(B2:B10)`、AVERAGE、COUNT、MIN、MAX → 12/4/3/2/6 | v1 原场景；录入走网格编辑器（见上） |
| 62 | REQ-4-1-1 S3 | 常量、减法、除法与优先级 | `=10-6/2`=7、`=9-3-2`=4、`=20/4/5`=1、`=7.5-2.5/5`=7；公式栏原文 | 含左结合和小数常量 |
| 63 | REQ-4-1-1 S4 | 括号混合算术并保持结果 | `=(2+3)*4-10/(1+1)` → 15，公式栏原文，刷新后同 | |
| 64 | REQ-4-1-1 S5 | 多个依赖单元格刷新后仍正确 | A1=2、B1=3、C1=`=A1+B1`、D1=`=C1*2` → 5/10；刷新后值和公式原文 | 数值即 v2 种子 |
| 65 | REQ-4-1-2 S1 | 向下复制公式调整相对引用、保留绝对引用 | A1=1、B1=2、A2=10、C1=`=A1+$B$1`；复制 C1 到 C2 → C2 `=A2+$B$1`=12，C1 不变；刷新后两格公式 | v1 原场景 |
| 66 | REQ-4-1-2 S2 | 复制公式偏移越界显示并持久化 #REF! | A1=5、B2=`=A1`；复制 B2 到 B1（引用变第 0 行）→ B1 显示 `#REF!`、公式栏 `=#REF!`，B2 不变；刷新后同 | 用单引用公式，避免 `=#REF!+1` 这类写法歧义 |
| 67 | REQ-4-2-1 S1 | 多级依赖按序重算，不影响其它工作表 | Sheet1 A1=10、B1=`=A1*2`、C1=`=B1+5`；Add worksheet 得 Sheet2（aria-selected）写 Other 和 `=1+1`；回 Sheet1 改 A1=20 → 40/45；Sheet2 仍 Other/2/`=1+1`；刷新后 Sheet1 40/45 | v1 原场景 |
| 68 | REQ-4-2-1 S2 | 批量粘贴源值后重算直接和间接依赖 | A1=1、A2=2、B1=`=A1+A2`、C1=`=B1*10`；在 A1 粘 `5\n6` → 11/110，公式栏原文；刷新后同 | |
| 69 | REQ-4-2-1 S3 | 移动值覆盖公式源后重算 | A1=2、B1=3、C1=`=B1*2`、D1=`=C1+1`；剪切 A1 粘到 B1 → A1 空、B1=2、C1=4、D1=5，公式不变；刷新后同 | v1 原场景 |
| 70 | REQ-4-2-2 S1 | 五类错误显示并持久化，不阻断无关单元格 | 网格内录入 B1..B5 = `=1/0`、`=A0`、`=UNSUPPORTED(1)`、`=1+`、`=B5` → #DIV/0!、#REF!、#NAME?、#ERROR!、#REF!；A1 改为 Edited；刷新后错误值、A1、五个公式原文 | v1 原场景；录入走网格编辑器 |
| 71 | REQ-4-2-2 S2 | 修复除零错误并持久化 | A1=2、B1=`=1/0` → #DIV/0!；B1 改 `=A1*3` → 6，公式栏原文；刷新后同 | v1 原场景 |
| 72 | REQ-4-2-2 S3 | 间接循环引用全部显示 #REF! 并持久化 | A1=`=B1`、B1=`=C1`、C1=`=A1` → 三格 #REF!；刷新后同，公式原文 | 用纯引用环：v1 应用对 `=B1+1` 式环给 #ERROR!、对纯引用环给 #REF!，而隐藏测试在该应用上通过，所以隐藏测试是纯引用环 |
| 73 | REQ-4-2-2 S4 | 未知函数和不完整表达式显示错误、保留原文 | `=NOPE(2)` → #NAME?、`=(1+2`、`=3*` → #ERROR!；三个公式栏原文 | 未刷新（标题没要求） |
| 74 | REQ-4-2-2 S5 | 自引用错误被有效公式覆盖 | A1=4、B1=`=B1` → #REF!；改 `=A1*5` → 20，公式栏原文；刷新后同 | 纯自引用，理由同 72 |
| 75 | REQ-5-1-1 S1 | 按 Sales 稳定降序，范围外不动 | A1:C5 表头 + East/1200/Open、North/800/Closed、South/1200/Pending、West/500/Open，E1=Outside；拖选 A1→C5，Data→Sort range：Sort by=Sales、Order=Descending、勾表头、Sort → East, South, North, West，表头在第 1 行，E1 不变；刷新后同 | v1 原场景 |
| 76 | REQ-5-1-1 S2 | 文本升序与 ISO 日期降序 | Name/Joined/Score 四行；按 Name 升序 → Alpha, Bravo, Charlie, Delta（整行随动）；再按 Joined 降序 → Charlie, Delta, Alpha, Bravo；刷新后同 | |
| 77 | REQ-5-1-1 S3 | 排序后公式与数值校验跟随对应列 | Item/Score/Double，Double=`=Bn*2`，B2:B4 规则 0–10；按 Score 升序 → Bravo/1/2、Charlie/2/4、Alpha/3/6，C2 公式 `=B2*2`、C4 `=B4*2`；B2 输 11 → "Please enter a number between 0 and 10"，B2=1、C2=2；刷新后排序结果不变 | v1 原场景；**消息假设**：v1 原文是 "from 0 to 10"，这里按 v2 description 的通用格式 |
| 78 | REQ-5-1-1 S4 | 排序后已有筛选条件继续生效 | Item/Score：Alpha/3、Bravo/1、Charlie/2；筛选 Score Greater than 1（Bravo 隐藏）；排序 → "Filter Score" 仍在，第 2 行隐藏，A3/B3=Charlie/2、A4/B4=Alpha/3；刷新后同 | v1 原场景 |
| 79 | REQ-5-1-1 S5 | 重复值排序保持相对顺序 | P1/5、P2/3、P3/5、P4/3、P5/1 升序 → P5, P2, P4, P1, P3 | 未刷新 |
| 80 | REQ-5-1-1 S6 | 日期降序后表头和范围外不动 | Event/Date 三行（A1:B4），C2=Note、A5=Tail、D1=Outside；按 Date 降序 → Launch, Review, Kickoff，表头和三个范围外格不变 | 范围外格紧贴选区 |
| 81 | REQ-5-1-2 S1 | Region 值 + Sales 数值条件组合，刷新保持，可无损清除 | A1:C6 为 v1 原数据；Create filter；Filter Region：Clear selection→勾 East→Apply；Filter Sales：Greater than 1000；可见表头（A1 含 Region）和第 2、5 行，3/4/6 隐藏；刷新后同；Data→Clear filter → 2–6 行原顺序原值 | v1 原场景；表头必须可见；Clear filter 位置见上 |
| 82 | REQ-5-1-2 S2 | 文本包含、日期 Before、为空组合，再改非空 | Name/Date/Note 五行；Text contains Alpha → Before 2024-02-01 → Note Is empty → 只剩第 2 行；Note 改 Is not empty → 只剩第 4 行 | 数据自拟 |
| 83 | REQ-5-1-2 S3 | CSV 导出包含被筛选隐藏的行 | Region/Sales 三行，Sales Greater than 150 隐藏 East 行；Export CSV 下载名以 .csv 结尾，内容（去 BOM、CRLF→LF、去尾换行）= `Region,Sales\nEast,100\nWest,200\nNorth,300`；导出后筛选视图不变 | 用条件筛选（v1 应用上隐藏测试挂在组合框，说明该条用了条件） |
| 84 | REQ-5-1-2 S4 | 清除后再用不同条件，已保存行都还在 | Item/Qty 四行；Qty>10 → 只剩 Book/Desk；Clear filter → 四行原值；重新 Create filter，Item Text contains "e" → Pen/Desk；再 Clear → 四行原值 | **假设**：Clear filter 后重新 Create filter 再设条件 |
| 85 | REQ-5-1-2 S5 | 筛选到空结果，刷新仍为空结果 | Score Greater than 100 → 三行全隐藏，"Filter Score" 和表头可见；刷新后同 | |
| 86 | REQ-5-2-1 S1 | A1:A2 下拉规则，选值并持久化各自入口 | 拖选 A1:A2，Dropdown "Not Started, In Progress, Completed"（去空格）；打开 A1 下拉见三个 option，点 In Progress；A2 有自己的按钮；刷新后 A1 值和两个按钮都在 | v1 原场景 |
| 87 | REQ-5-2-1 S2 | 数值范围拒绝越界，刷新后仍接受边界 | B2:B4=50/60/70 设 0–100；B3 输 101 → "Please enter a number from 0 to 100"、B3 仍 60；刷新后再输 101 同样被拒；B3=100、B2=0 被接受 | 按 description "persisted multi-cell 0-to-100 boundary scenario, rejecting 101 in B3" 设计；**假设**：隐藏测试断言的是 from…to 句式 |
| 88 | REQ-5-2-1 S3 | 网格内编辑违反数值规则保留原值 | A1=5 设 1–10；双击 A1 在 "Edit A1" 输 11 回车 → "Please enter a number between 1 and 10"，A1 和公式栏仍 5；刷新后 5 | 用非 0–100 区间走通用句式 |
| 89 | REQ-5-2-1 S4 | 修改和删除规则不改现有值 | B2:B3=50/80 设 0–100；重选 B2:B3 打开 Data validation：Minimum=0、Maximum=100 预填、有 Delete rule；改 Maximum=60 保存 → 关闭，B3 仍 80；B2 输 70 → "…between 0 and 60"、B2 仍 50；再打开点 Delete rule → 关闭、值不变；B2 输 70 被接受；刷新后 70/80 | 不断言 Rule type 组合框的显示值（实现各异），但保存必须成功 |
| 90 | REQ-5-2-1 S5 | 下拉规则拒绝未允许值，刷新后仍生效 | A1=Open，Dropdown "Open, Closed"；公式栏输 Pending → "Please select one of the following values: Open, Closed"，A1 仍 Open、公式栏回到 Open；刷新后再输 Pending 仍被拒 | v1 原场景 |
| 91 | REQ-5-2-1 S6 | 多个下拉格各选不同允许值 | A1:A3 Dropdown "Red, Green, Blue"，依次选 Red/Green/Blue；刷新后三格各自保持 | |
| 92 | REQ-5-3-1 S1 | Pivot1 按 Region 汇总 Sales，源表不变 | 源为 v1 原数据（A1:B6）；对话框显示 "Source range: A1:B6"，选 New worksheet → Create → Pivot1；Rows=Region、Values=Sales、Summarize by=SUM、Apply → A1:B5 = Region/SUM of Sales、East 1800、North 1500、South 1000、Grand Total 4300；Sheet1 不变；刷新后 Pivot1 同 | v1 原场景 |
| 93 | REQ-5-3-1 S2 | 刷新已有透视表覆盖旧汇总并持久化 | East1200/North800/East600 → 1800/800/2600；Sheet1 B2 改 1500；Pivot1 点 Refresh pivot table → 2100/800/2900；Sheet1 不被刷新改动；刷新页面后 Pivot1 同 | v1 原场景；不断言刷新前是否自动更新 |
| 94 | REQ-5-3-1 S3 | 行列字段 + COUNT 二维汇总并持久化 | 种子列序 Region/Sales/Status，前三行即 v2 种子（East/1200/Open、North/800/Closed、South/700/Open），再加 East/900/Closed、East/500/Open；Rows=Region、Columns=Status、Values=Sales、COUNT → B1/C1/D1=Open/Closed/Grand Total，East 2/1/3、North 0/1/1、South 1/0/1、Grand Total 3/2/5；刷新后同 | 列值和行值按首次出现排序；含两个 0 格 |
| 95 | REQ-5-3-1 S4 | AVERAGE 忽略非数值，源不变 | East100/West300/East pending/East200 → East 150、West 300、Grand Total 200，B1=AVERAGE of Sales；Sheet1 原样 | 若把 pending 当 0 会得 100/150 |
| 96 | REQ-5-3-1 S5 | 无效数值聚合报错并保留上次结果 | SUM of Sales 成功后，把 Values 改 Owner（文本）再 Apply → "Value field requires numeric values"，旧结果不变；Sheet1 原样 | |
| 97 | REQ-5-3-1 S6 | 刷新时汇总被筛选隐藏的源记录 | 先建透视（East400/West200/North400/1000）；Sheet1 建筛选只留 East，改 B2=150；Refresh → East 450、West 200、North 400、Grand Total 1050 | 先建透视再筛选，避免拖选到隐藏行 |
| 98 | REQ-5-3-1 S7 | 源区域插入行列后刷新用调整后范围 | East100/North200/East300 → 400/200/600；第 3 行上插一行填 East/50，Refresh → 450/200/650；B 列左插一列（Sales 到 C 列），Refresh 仍 450/200/650；刷新页面后同 | v1 原场景 |
| 99 | REQ-5-3-1 S8 | 删除已选源字段后刷新报错并保留上次结果 | 同上数据 → 400/200/600；删 B 列；Refresh → "Pivot field is no longer available. Select a new field."，结果不变；Sheet1 Region 列不变；刷新页面后结果仍在 | v1 原场景 |
| 100 | REQ-5-3-1 S9 | 按 Status 生成 COUNT 透视并刷新保持 | v2 种子三行（Region/Sales/Status）；Rows=Status、Values=Sales、COUNT → Status/COUNT of Sales、Open 2、Closed 1、Grand Total 3；刷新后同 | Values 用数值列，避免把"COUNT 计文本"混进来 |

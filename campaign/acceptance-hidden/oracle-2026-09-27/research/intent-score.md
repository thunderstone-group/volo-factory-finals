# 隐藏测试意图还原 —— 评分报告

评分对象：便宜模型（deepseek-v4-flash）从被遮蔽的 sheet / github 需求文档还原出的隐藏测试意图，对照真实隐藏意图（`oracle/{sheet,github}-intents.json` 的 `hidden_intent_zh`）逐条打分。

- **A. 同序号匹配**：还原结果里同一 req、同一 n 的那条，是否在测同一件事（操作 + 期望结果的核心一致，细节可以不同）。
- **B. 同需求覆盖**：同一 req 的所有还原条目里，是否有任何一条在测这件事。

## 汇总

- sheet（97 条已知隐藏意图）：A（同序号匹配） yes=31, partial=20, no=46；B（同需求覆盖） yes=63, partial=19, no=15
- github（97 条已知隐藏意图）：A（同序号匹配） yes=81, partial=4, no=12；B（同需求覆盖） yes=93, partial=3, no=1


## 逐条表格

### sheet

| task | req | n | 隐藏意图 | A 同序号匹配 | B 同需求覆盖 | 理由 |
|---|---|---|---|---|---|---|
| sheet | REQ-1-1-1 | n1 | 从首页打开已保存工作簿，并通过稳定 URL 恢复状态 | yes | yes | recon n1 打开工作簿+刷新同URL恢复，对应稳定URL恢复状态 |
| sheet | REQ-1-1-1 | n2 | 从首页打开指定工作簿时不会带入其他工作簿数据 | partial | yes | recon n2 测的是后续会话直接访问URL而非首页点击打开，但recon n1/n2 checks 都含「不带入其他工作簿数据」的隔离断言 |
| sheet | REQ-1-2-1 | n1 | 创建空白工作簿，并在刷新后保留 Sheet1 与 A1 选中状态 | yes | yes | recon n1 完全对应：创建空白工作簿+刷新保留Sheet1/A1 |
| sheet | REQ-1-2-2 | n1 | 保存有效工作簿名，并在首页和重新打开后保持一致 | yes | yes | recon n1 完全对应：改合法名+首页/重新打开一致 |
| sheet | REQ-1-2-2 | n2 | 纯空格名称被拒绝，重新打开后仍保留原名称 | yes | yes | recon n2 完全对应：纯空格名被拒+刷新后原名保留 |
| sheet | REQ-1-3-1 | n1 | 导入 UTF-8 CSV，并在刷新后保持原始行列与特殊字段 | yes | yes | recon n1 对应：UTF-8混合内容导入+刷新后行列/内容不变 |
| sheet | REQ-1-3-2 | n1 | 导出活动工作表的计算结果与特殊文本，且刷新后原数据不变 | partial | partial | hidden n1 要求「计算结果+特殊文本」同一测试内验证，recon n1 只是通用「当前工作表值不变」，计算结果和特殊文本分别在 recon n4/n3 才验证，未合一 |
| sheet | REQ-1-3-2 | n2 | 导出公式结果不会改写原公式或活动工作表 | no | yes | recon n2(索引2)测空字段导出，与「导出不改写原公式」无关；但 recon n4 明确验证导出后「formula bar 仍显示原公式」 |
| sheet | REQ-1-3-2 | n3 | 导出当前活动的第二个工作表内容 | no | no | hidden n3 是「导出当前激活的第二个工作表」，即导出跟随激活sheet切换；recon 4条测试都没有测试切换到非Sheet1后再导出 |
| sheet | REQ-1-3-2 | n4 | 切回 Sheet1 后导出仍只包含当前工作表内容 | no | no | hidden n4 是「切回Sheet1后导出仍只含当前表」，同样是多工作表激活态相关，recon全部未覆盖 |
| sheet | REQ-2-1-1 | n1 | 新增并持久化 Sheet2，且不修改现有工作表数据 | yes | yes | recon n1 完全对应：新增Sheet2+不改Sheet1+持久化 |
| sheet | REQ-2-1-1 | n2 | 新增工作表使用第一个未占用的 SheetN 名称 | yes | yes | recon n2 完全对应：已有Sheet1/2时新增用Sheet3 |
| sheet | REQ-2-1-2 | n1 | 切换工作表时恢复各自数据、选中单元格和公式栏 | yes | yes | recon n1 完全对应：切换标签恢复网格/选中/公式栏等并持久化 |
| sheet | REQ-2-1-2 | n2 | 切换工作表时恢复公式原文并隔离普通值 | yes | yes | recon n2 完全对应：切换后公式栏显示原公式/普通值区分 |
| sheet | REQ-2-1-2 | n3 | 切换工作表时筛选与校验入口保持隔离 | no | yes | recon n3(索引3)测的是「无历史时默认选中A1」，非「筛选/校验入口隔离」；但 recon n1 checks 含「filter buttons, validation entry points... match target worksheet」覆盖该点 |
| sheet | REQ-2-1-2 | n4 | 在三张工作表之间切换时分别恢复各自选中单元格 | partial | partial | hidden n4 强调三张表之间切换各自恢复选中；recon n4 只是两表来回切换(A<->B)的验证，规模较弱，未证明多于2张表也各自独立记忆 |
| sheet | REQ-2-1-2 | n5 | 切换工作表时保持各自公式栏原文与计算结果 | partial | yes | recon n5(索引5)测刷新/重新打开恢复各表选中，动作是整页刷新而非「切换工作表」；但 recon n2 已经验证切换时公式栏显示原文与结果 |
| sheet | REQ-2-1-3 | n1 | 保存唯一工作表名称，并在刷新后保持 | yes | yes | recon n1 完全对应：改唯一名+刷新后保持 |
| sheet | REQ-2-1-3 | n2 | 重复工作表名称被拒绝，原名称保持不变 | no | yes | recon n2(索引2)测的是空名拒绝，hidden n2 是重复名拒绝——顺序错位；recon n3 才是重复名场景，B覆盖 |
| sheet | REQ-2-1-3 | n3 | 空工作表名称被拒绝，刷新后仍保留原名称 | no | yes | recon n3(索引3)测的是重复名拒绝，hidden n3 是空名拒绝——顺序错位；recon n2 才是空名场景，B覆盖 |
| sheet | REQ-2-1-4 | n1 | 删除多工作表中的当前工作表，并在刷新后保持删除状态 | yes | yes | recon n1 完全对应：删除当前工作表+相邻表激活+持久化 |
| sheet | REQ-2-1-4 | n2 | 最后一个工作表不能删除，刷新后仍然存在 | no | yes | recon n2(索引2)测删除透视结果表(对应hidden n4)，hidden n2 是最后一张表不可删——顺序错位；recon n4 才是该场景，B覆盖 |
| sheet | REQ-2-1-4 | n3 | 透视表源工作表不能删除，源数据和透视结果均保持 | yes | yes | recon n3 恰好同索引对应：透视源表不可删，源数据和透视结果保留 |
| sheet | REQ-2-1-4 | n4 | 删除透视结果工作表会移除配置并允许随后删除原源表 | no | yes | recon n4(索引4)测最后一张表不可删(对应hidden n2)，hidden n4 是删透视结果表后可删源表——顺序错位；recon n2 才是该场景，B覆盖 |
| sheet | REQ-2-2-1 | n1 | 在第 3 行上方插入空白行，整行数据下移且刷新后保持 | yes | yes | recon n1 完全对应：第3行上方插入+整体下移+持久化 |
| sheet | REQ-2-2-1 | n2 | 删除第 3 行后后续数据上移，重新打开后顺序保持 | no | yes | recon n2(索引2)是「插入到下方」对应hidden n3，hidden n2 是删除第3行——顺序错位；recon n3 才是删除场景，B覆盖 |
| sheet | REQ-2-2-1 | n3 | 在目标行下方插入空白行并保持其他数据 | no | yes | recon n3(索引3)是删除第3行，对应hidden n2；hidden n3 是插入到下方——顺序错位；recon n2 才是该场景，B覆盖 |
| sheet | REQ-2-2-1 | n4 | 插入行后调整公式引用并保持计算结果 | no | yes | recon n4(索引4)测校验规则跟随行移动后仍生效(对应hidden n5)，hidden n4 是公式引用调整——顺序错位；recon n1 checks 内含「Formula bar displays adjusted original formulas」，B覆盖 |
| sheet | REQ-2-2-1 | n5 | 插入行时校验规则随原单元格下移 | no | yes | recon n5(索引5)是透视表刷新场景，不在hidden 5条之列，属recon自行发挥；hidden n5 是校验规则随行插入下移，recon n4 恰好测的是这个，B覆盖 |
| sheet | REQ-2-2-2 | n1 | 在 B 列左侧插入空白列，整列数据右移且刷新后保持 | yes | yes | recon n1 完全对应：B列左侧插入+整体右移+持久化 |
| sheet | REQ-2-2-2 | n2 | 删除公式直接引用的 B 列后显示引用错误，重新打开后保持 | no | yes | recon n2(索引2)是插入到右侧对应hidden n3，hidden n2 是删除引用列显示#REF!——顺序错位；recon n3 才是该场景，B覆盖 |
| sheet | REQ-2-2-2 | n3 | 在目标列右侧插入空白列并保持其他数据 | no | yes | recon n3(索引3)是删除列显示#REF!对应hidden n2；hidden n3 是插入到右侧——顺序错位；recon n2 才是该场景，B覆盖 |
| sheet | REQ-2-2-2 | n4 | 插入列后调整公式引用并保持计算结果 | no | yes | recon n4(索引4)是校验规则随列移动仍生效(对应hidden n5)，hidden n4 是公式引用调整——顺序错位；recon n1 checks 内含「formula references in B+ shift right together」，B覆盖 |
| sheet | REQ-2-2-2 | n5 | 插入列时校验规则随原单元格右移 | no | yes | recon n5(索引5)是透视表列移动刷新场景，不在hidden 5条之列；hidden n5 是校验规则随列插入右移，recon n4 恰好测的是这个，B覆盖 |
| sheet | REQ-3-1-1 | n1 | 通过公式栏提交单元格值，依赖公式重算并持久化 | partial | partial | hidden n1 强调「通过公式栏提交+依赖公式重算」，recon n1 只测网格/公式栏提交值本身，未测依赖单元格联动重算(该断言散见于 recon n3 但主体是网格公式输入非公式栏) |
| sheet | REQ-3-1-1 | n2 | Escape 取消网格内未提交编辑，刷新后保留原值 | yes | yes | recon n2 完全对应：Escape取消未提交编辑，刷新保留原值 |
| sheet | REQ-3-1-1 | n3 | 通过网格提交文本、数字、布尔值、日期文本和公式 | no | no | hidden n3 要求文本/数字/布尔值/日期文本/公式多种类型均可通过网格提交，recon 4条里布尔值和日期文本两种类型完全没有测试用例 |
| sheet | REQ-3-1-1 | n4 | 在更深的单元格位置提交公式并在刷新后保持 | no | no | hidden n4「更深单元格位置提交公式」(疑似大网格/靠后位置的健壮性)，recon 4条都没有测试非首屏/远端单元格位置 |
| sheet | REQ-3-1-2 | n1 | 从 B2 原子粘贴二维表格，保留空字段和矩形外数据 | yes | yes | recon n1 完全对应：B2起粘贴二维表，空字段保留，矩形外不变 |
| sheet | REQ-3-1-2 | n2 | 粘贴中任一值违反校验时整批拒绝且不留下部分状态 | no | yes | recon n2(索引2)测右键菜单Paste机制存在，hidden n2 是校验冲突整批拒绝——顺序错位；recon n5 才是该场景，B覆盖 |
| sheet | REQ-3-1-2 | n3 | 右键粘贴替换目标公式并重算依赖项 | no | partial | recon n3(索引3)测Ctrl+V与菜单Paste等效，hidden n3 是右键粘贴替换公式+重算依赖——两者都只是「粘贴入口」相关但语义不同；「替换公式+重算」实际由 recon n4 覆盖，但入口是「在A1粘贴」非「右键」，两处均不完全对应 |
| sheet | REQ-3-1-2 | n4 | 从 A1 粘贴单行表格并保持外部单元格不变 | yes | yes | recon n4 与hidden n4 位置(A1)、外部不变均对应，虽同时验证了公式替换重算(更接近hidden n3内容)，核心「A1+外部不变」仍命中 |
| sheet | REQ-3-1-2 | n5 | 从 C3 粘贴两行两列表格并保留源外内容 | no | no | hidden n5 是「从C3粘贴2行2列，保留源外内容」，recon全部5条都没有测试C3起点或2x2尺寸的粘贴场景，只测了B2和A1两个起点 |
| sheet | REQ-3-1-3 | n1 | 拖拽选择精确的矩形区域 | yes | yes | recon n1 完全对应：拖拽选择矩形+刷新后aria-selected保持 |
| sheet | REQ-3-1-3 | n2 | 刷新后恢复完整选区，新的单元格选择会替换该选区 | yes | yes | recon n2 完全对应：新选择替换旧选择+刷新/切表恢复完整选区 |
| sheet | REQ-3-2-1 | n1 | 复制 A1:B2 到 D1:E2，并调整相对引用、保留绝对引用 | partial | yes | recon n1(索引1)只测复制后数据镜像，未提及相对/绝对引用调整这一核心断言；该断言由 recon n3 精确覆盖(offset调整、$A$1不变) |
| sheet | REQ-3-2-1 | n2 | 剪切 A1:B2 到 D1:E2，目标完整写入后清空源区域 | yes | yes | recon n2 完全对应：剪切到D1:E2，目标写完才清空源 |
| sheet | REQ-3-2-1 | n3 | 剪切目标违反校验时保留完整源区域和原目标值 | no | yes | recon n3(索引3)测的是复制公式引用调整(对应hidden n1)，hidden n3 是剪切违反校验保留源与目标——顺序错位；recon n4 覆盖该场景，B覆盖 |
| sheet | REQ-3-2-1 | n4 | 复制单个单元格到新位置并保留源值 | no | no | hidden n4 是「复制单个单元格到新位置，保留源值」，recon全部4条测试都是A1:B2整块范围复制/剪切，没有单一单元格粒度的复制测试 |
| sheet | REQ-3-2-2 | n1 | 撤销单元格修改后重做，并在刷新后保留重做结果 | partial | yes | hidden n1 是「撤销后重做，刷新后保留重做结果」的完整流程，recon n1(索引1)只测了撤销半程(未做重做)；recon n2 才是「redo after undo...persist」完整对应hidden n1 |
| sheet | REQ-3-2-2 | n2 | 撤销后提交新修改会清除原重做分支 | no | yes | recon n2(索引2)测重做本身有效，hidden n2 是撤销后新提交会清空重做分支——顺序错位；recon n7 明确覆盖「new edit after undo disables Redo」 |
| sheet | REQ-3-2-2 | n3 | 撤销和重做源值编辑会同步恢复依赖公式结果 | no | yes | recon n3(索引3)测Ctrl+Z/Ctrl+Y与按钮等效，hidden n3 是撤销源值联动恢复依赖公式结果——顺序错位；recon n1 checks 含「Dependent calculation results return to their pre-edit values」覆盖该点 |
| sheet | REQ-3-2-2 | n4 | 撤销并重做批量粘贴会恢复整个矩形 | partial | partial | recon n4 只验证了撤销批量粘贴恢复整矩形，未测「撤销后重做」的重做半程，hidden n4 要求撤销+重做都验证 |
| sheet | REQ-3-2-2 | n5 | 撤销并重做区域移动会同时恢复源区域和目标区域 | partial | partial | recon n5 只验证了撤销区域移动同时恢复源/目标，同样缺重做半程验证 |
| sheet | REQ-3-2-2 | n6 | 连续撤销和重做行列结构修改会恢复数据与校验入口 | partial | partial | recon n6 验证了连续撤销/重做的通用机制，但未专门针对「行列结构修改+校验入口恢复」这一具体组合，只是泛化的多步撤销重做 |
| sheet | REQ-3-2-2 | n7 | 在一个工作簿撤销不会修改另一个工作簿 | yes | yes | recon n7 完全对应：撤销不影响另一工作簿(虽同时捆绑了新编辑清空重做的内容) |
| sheet | REQ-4-1-1 | n1 | 计算带括号的引用表达式，并持久化原公式和结果 | yes | yes | recon n1 公式=(A1+B1)*2-4/2 覆盖带括号引用表达式+刷新持久化 |
| sheet | REQ-4-1-1 | n2 | 聚合函数忽略空单元格且函数名不区分大小写 | no | partial | hidden n2 要求「忽略空单元格」与「函数名大小写不敏感」在同一断言中出现；recon n3(大小写)与recon n4/n5(忽略空/文本)分属不同测试，从未合一 |
| sheet | REQ-4-1-1 | n3 | 计算数字常量、减法和除法并遵循运算优先级 | no | partial | hidden n3 想测纯数字常量+减法+除法+运算优先级，recon n1 的公式虽含减法除法优先级但混有单元格引用，非纯常量场景，只能算部分覆盖 |
| sheet | REQ-4-1-1 | n4 | 计算带括号的混合算术表达式并保持结果 | no | yes | recon n4(索引4)是COUNT忽略空/文本，hidden n4 是带括号混合算术表达式持久化——顺序错位；recon n1 的公式恰好是带括号混合算术且验证了刷新后持久化，B覆盖 |
| sheet | REQ-4-1-1 | n5 | 计算多个依赖单元格并在刷新后继续显示结果 | no | yes | recon n5(索引5)是AVERAGE/MIN/MAX/SUM忽略空/文本，hidden n5 是「多个依赖单元格」计算并刷新后持久化——若理解为公式依赖多个源单元格，recon n4/n5 对A1:A4范围聚合刷新后仍持久化的验证可算覆盖 |
| sheet | REQ-4-1-2 | n1 | 向下复制公式时调整相对引用并保留绝对引用 | yes | yes | recon n1 完全对应：相对/绝对混合公式复制，相对偏移、绝对不变(方向为对角非严格向下，细节差异) |
| sheet | REQ-4-1-2 | n2 | 复制公式产生无效偏移引用时显示并持久化引用错误 | yes | yes | recon n2 完全对应：复制产生越界引用显示并持久化#REF! |
| sheet | REQ-4-2-1 | n1 | 源值变化后按顺序重算多级依赖，且不影响其他工作表 | yes | yes | recon n1 完全对应：源值变化多级重算+不影响其他工作表 |
| sheet | REQ-4-2-1 | n2 | 批量粘贴源值后重算直接和间接依赖 | yes | yes | recon n2 完全对应：批量粘贴源值后直接/间接依赖重算 |
| sheet | REQ-4-2-1 | n3 | 移动值覆盖公式源单元格后重算直接和间接依赖 | no | partial | hidden n3 是「移动值覆盖公式源单元格」(剪切/拖动覆盖)后重算，recon n3(索引3)测的是插入行导致公式随结构调整——机制不同(结构位移 vs 值覆盖)；recon n2 的批量粘贴覆盖源单元格效果上有部分相似，但不是「移动」操作 |
| sheet | REQ-4-2-2 | n1 | 显示并持久化五类公式错误，且不阻断无关单元格编辑 | partial | partial | hidden n1 要求单测展示五类公式错误且不阻断其他单元格，recon n1(索引1)只展示了DIV/0一种类型，「不阻断」断言存在但错误类型覆盖不全，五类分散在recon n1/n2/n3/n4/n5各自单独测试里，无一条合一 |
| sheet | REQ-4-2-2 | n2 | 用有效公式修复除零错误，并持久化新公式和结果 | no | yes | recon n2(索引2)测删除引用列产生#REF!，hidden n2 是用有效公式修复除零错误——顺序错位；recon n3 的NAME错误改为有效公式=A1+B1的「先错后修复」流程与hidden n2机制相同(仅起始错误类型不同，DIV/0→NAME)，B部分可信覆盖 |
| sheet | REQ-4-2-2 | n3 | 间接循环引用中的所有公式显示并持久化引用错误 | no | no | hidden n3 要求「间接循环引用」(多单元格构成环)，recon 5条测试里只有n5测了直接自引用(=A1+1 in A1)，没有任何测试构造跨单元格的间接循环引用 |
| sheet | REQ-4-2-2 | n4 | 未知函数和不完整表达式都显示错误并保留公式原文 | partial | partial | recon n4(索引4)只测了「不完整表达式」半边(=1+)，hidden n4 要求「未知函数」与「不完整表达式」两者都测；未知函数的验证在recon n3但那里没有走「显示错误后保留公式原文」独立断言的完整对应 |
| sheet | REQ-4-2-2 | n5 | 自引用错误可被有效公式覆盖并保持新结果 | partial | no | recon n5(索引5)只展示了自引用初始报错，未测「被有效公式覆盖后保持新结果」的修复步骤；现有的修复流程范式(recon n3)针对的是NAME错误而非自引用，自引用修复涉及打破循环依赖，机制上不能简单等同 |
| sheet | REQ-5-1-1 | n1 | 按 Sales 稳定降序排列完整记录，并保持范围外数据 | partial | yes | hidden n1 要求按Sales降序，recon n1(索引1)是升序，方向相反；但recon n4正是Sales降序，且recon n1已验证范围外数据不变，两者合起来覆盖了核心诉求 |
| sheet | REQ-5-1-1 | n2 | 按文本升序和 ISO 日期降序排列完整记录 | partial | partial | hidden n2 是「文本升序+ISO日期降序」组合，recon n2(索引2)只测ISO日期升序(方向不对)，未测文本排序；文本排序存在于recon n3但主旨是重复键稳定性非单纯升序演示，日期降序则完全没有测试 |
| sheet | REQ-5-1-1 | n3 | 排序完整记录后公式与数值校验继续作用于对应列 | no | partial | hidden n3 是排序后公式与数值校验仍作用于对应列，recon n3(索引3)测的是文本列重复键稳定顺序——不同主题；recon n1 checks 提到「Formula bar references/results are consistent with the new positions」覆盖公式半边，校验规则跟随排序完全未提及 |
| sheet | REQ-5-1-1 | n4 | 排序后已有筛选条件继续控制对应数据行 | no | no | hidden n4 是排序后已有筛选条件仍作用于对应数据行，recon 6条测试全部没有涉及筛选与排序的交互 |
| sheet | REQ-5-1-1 | n5 | 对重复数值排序时保持同值记录的相对顺序 | no | yes | recon n5(索引5)测「不含表头」排序场景，hidden n5 是重复数值排序保持相对顺序——顺序错位；recon n3 虽用文本重复键而非数值，但「相同键保持原相对顺序」的核心稳定性机制一致，可视为细节替换 |
| sheet | REQ-5-1-1 | n6 | 按日期降序排序后保留表头和范围外单元格 | no | no | hidden n6 是按日期降序排序保留表头和范围外单元格，recon 6条里没有任何一条做日期降序排序，recon n2只测了日期升序 |
| sheet | REQ-5-1-2 | n1 | 组合 Region 值与 Sales 数值条件，刷新后保持并可无损清除 | partial | partial | hidden n1 是Region值筛选组合Sales数值条件(非单值)，且可无损清除；recon n1(索引1)用的是Sales=1200值筛选而非数值条件，且未测清除筛选这一半，两个子诉求都不完整 |
| sheet | REQ-5-1-2 | n2 | 组合文本包含、日期比较和为空条件，并支持非空条件 | no | no | hidden n2 要求文本包含、日期比较、为空/非空条件类型，recon全部5条测试只出现过Region值筛选和Sales的Greater than数值条件，文本包含/日期比较/空值条件完全未出现 |
| sheet | REQ-5-1-2 | n3 | CSV 导出包含被筛选隐藏的已保存行 | yes | yes | recon n3 完全对应：筛选生效时导出CSV仍含被隐藏的行 |
| sheet | REQ-5-1-2 | n4 | 清除筛选后再次应用不同条件仍保留已保存行 | partial | partial | hidden n4 是清除筛选后再应用不同条件仍保留已保存行(筛选级clear+reapply循环)，recon n4(索引4)测的是筛选对话框内checkbox「Clear selection」再勾选——粒度不同，只在对话框内而非整个筛选器级别的清除重来 |
| sheet | REQ-5-1-2 | n5 | 筛选到空结果后刷新仍保持空结果状态 | no | no | hidden n5 是筛选到空结果集后刷新仍是空结果，recon全部5条测试筛选后都至少留有一行可见，没有测试全部隐藏(0行)这一边界情形 |
| sheet | REQ-5-2-1 | n1 | 为 A1:A2 创建下拉规则，选择值并持久化独立入口 | yes | yes | recon n1 完全对应：A1:A2下拉校验+每格独立入口+拒绝非法值 |
| sheet | REQ-5-2-1 | n2 | 数值范围拒绝越界输入并在刷新后继续接受包含边界 | partial | no | hidden n2 强调「包含边界」即恰好输入0或100应被接受，recon n2(索引2)只验证了150被拒和50(非边界值)被接受，未验证0/100本身被接受，边界值本身缺失测试 |
| sheet | REQ-5-2-1 | n3 | 网格内编辑违反数值规则时保留原值 | yes | yes | recon n3 完全对应：网格内违反数值规则(101)保留原值 |
| sheet | REQ-5-2-1 | n4 | 修改和删除校验规则不会自动改写现有单元格值 | no | partial | hidden n4 要求「修改」和「删除」规则都不改写现有值，recon n4(索引4)测的是粘贴/移动违反校验被拒——不同主题；delete半边由recon n5覆盖，modify半边由recon n6覆盖，但二者分离未合一 |
| sheet | REQ-5-2-1 | n5 | 下拉规则拒绝未允许的值并在刷新后继续生效 | no | yes | recon n5(索引5)测删除规则不改写现有值，对应hidden n4的一半；hidden n5 是下拉规则拒绝非法值+刷新后仍生效——顺序错位；recon n1 checks 含「Rule remains active after refresh」明确覆盖 |
| sheet | REQ-5-2-1 | n6 | 下拉规则可在多个单元格上选择不同允许值 | no | partial | recon n6(索引6)测修改规则参数不改写现有值，对应hidden n4的另一半，非hidden n6(下拉在多单元格选不同值)；recon n1 虽建立了A1/A2两个独立下拉入口，但未实际验证两格可各自持有不同的合法值 |
| sheet | REQ-5-3-1 | n1 | 在 Pivot1 按 Region 汇总 Sales，并保持源表不变 | yes | yes | recon n1 完全对应：Pivot1按Region汇总SUM(Sales)+源表不变 |
| sheet | REQ-5-3-1 | n2 | 刷新已有透视表后覆盖旧汇总，并持久化新结果 | no | yes | recon n2(索引2)是新增列字段的2D透视(SUM)，hidden n2 是刷新覆盖旧汇总——顺序错位；recon n5「Refresh pivot table after source value edits recomputes...old summary is completely replaced」精确覆盖 |
| sheet | REQ-5-3-1 | n3 | 使用行列字段和 COUNT 生成二维汇总并持久化 | yes | yes | recon n3 恰好同索引对应：行列字段+COUNT生成二维汇总 |
| sheet | REQ-5-3-1 | n4 | AVERAGE 忽略非数值记录并保持源数据不变 | partial | no | hidden n4 强调AVERAGE「忽略非数值记录」(部分非数值时仍平均数值部分)，recon n4(索引4)只是普通AVERAGE正确性验证，没有非数值记录场景；recon n9测的是「整字段全非数值→报错」这一更严格的all-or-nothing行为，与「忽略非数值、继续计算数值部分」的宽容语义并不一致，可能是理解偏差 |
| sheet | REQ-5-3-1 | n5 | 无效数值聚合显示错误并保留上一次成功结果 | no | yes | recon n5(索引5)是刷新重算源值编辑后的结果，对应hidden n2；hidden n5 是无效聚合报错保留上次结果——顺序错位；recon n9「Value field requires numeric values...preserves old result」精确覆盖 |
| sheet | REQ-5-3-1 | n6 | 刷新透视表时汇总被筛选隐藏的源记录 | no | no | hidden n6 是刷新透视表时汇总被筛选隐藏的源记录(即透视应忽略筛选可见性)，recon全部9条测试都没有出现「筛选」与「透视」的交互场景 |
| sheet | REQ-5-3-1 | n7 | 源区域插入行列后刷新会使用调整后的完整范围 | no | yes | recon n7(索引7)是删除已选字段刷新报错，对应hidden n8；hidden n7 是源区域插入行列后刷新用调整后范围——顺序错位；recon n6 精确覆盖该场景 |
| sheet | REQ-5-3-1 | n8 | 删除已选源字段后刷新显示错误并保留上次结果 | partial | yes | recon n8(索引8)是「无效源范围或字段选择」的泛化报错测试，可算作hidden n8(删除已选字段)的一个更宽泛版本，非精确对应；recon n7 才是精确对应，B覆盖充分 |
| sheet | REQ-5-3-1 | n9 | 按状态字段生成 COUNT 透视表并在刷新后保持 | no | partial | hidden n9 是按Status字段生成COUNT透视并持久化(类比n1但字段和聚合不同)，recon n9(索引9)测的是SUM/AVERAGE遇全非数值字段报错——完全不同主题；recon n3 的COUNT测试中使用了Status字段(作为列字段，非单独行分组)，只能算部分沾边 |

### github

| task | req | n | 隐藏意图 | A 同序号匹配 | B 同需求覆盖 | 理由 |
|---|---|---|---|---|---|---|
| github | REQ-1-1-2 | n1 | 已验证账户使用正确凭据登录，并在重新打开后保持会话 | yes | yes | recon n1 完全对应：用户名登录进入工作区+刷新/直接访问受保护页保持会话 |
| github | REQ-1-1-2 | n2 | 错误凭据只显示通用失败信息且不创建会话 | no | yes | recon n2(索引2)测的是邮箱登录成功(对应hidden n3)，hidden n2 是错误凭据通用失败——顺序错位；recon n3 的「incorrect password」子场景covers该点 |
| github | REQ-1-1-2 | n3 | 使用已验证邮箱而非登录名也能建立会话 | no | yes | recon n3(索引3)测的是未知用户名/错误密码同一失败信息(对应hidden n4)，hidden n3 是用邮箱登录成功——顺序错位；recon n2 才是邮箱登录场景，B覆盖 |
| github | REQ-1-1-2 | n4 | 未知账户与错误密码显示相同的通用失败结果 | partial | yes | recon n4(索引4)测「不可用账户」单独场景，未显式做「未知账户 vs 错误密码」两者返回相同结果的对比断言；该对比断言精确存在于recon n3标题本身 |
| github | REQ-1-1-3 | n1 | 本地重置流程显示固定验证码并直接进入下一步 | yes | yes | recon n1 覆盖：固定验证码123456显示+直接进入密码重置步骤(同时捆绑了后续更新) |
| github | REQ-1-1-3 | n2 | 错误验证码不会更新密码，旧密码仍可登录 | yes | yes | recon n2 完全对应：错误验证码000000不更新密码，旧密码仍可用 |
| github | REQ-1-1-3 | n3 | 固定验证码配合合规新密码更新凭据 | no | yes | recon n3(索引3)测的是不合规新密码/确认不一致被拒绝的失败场景，hidden n3 是固定验证码+合规新密码成功更新凭据——两者valence相反(失败vs成功)；recon n1 内已完整演示该成功流程 |
| github | REQ-1-2 | n1 | 已登录用户确认退出后，受保护页面重新要求身份验证 | yes | yes | recon n1 完全对应：确认退出后受保护页刷新/回退/直接打开均需重新认证 |
| github | REQ-1-2 | n2 | 退出后直接重新打开受保护页面仍需重新认证 | no | yes | recon n2(索引2)测的是取消退出对话框保持会话有效——与hidden n2(退出后直接打开受保护页仍需认证)主题不同(取消 vs 真退出后的直接访问)；recon n1 checks 已含「directly reopening... requires authentication」覆盖 |
| github | REQ-1-3 | n1 | 使用当前密码修改密码后，新密码可用于后续登录 | yes | yes | recon n1 完全对应：用当前密码改密码，新密码可登录 |
| github | REQ-1-3 | n2 | 当前密码错误或确认密码不一致时，密码不会被修改 | yes | yes | recon n2 完全对应：当前密码错误或确认不一致，密码不变 |
| github | REQ-1-3 | n3 | 缺失当前密码时拒绝更新，旧密码保持有效 | yes | yes | recon n3 完全对应：缺失当前密码拒绝更新，旧密码有效 |
| github | REQ-2-1-1 | n1 | 访客可筛选公共组织仓库并进入所选仓库概览 | yes | yes | recon n1 完全对应：访客筛选公共仓库+打开概览+私有仓库隐藏 |
| github | REQ-2-1-1 | n2 | 访客不会在公共组织仓库列表中看到私有仓库 | no | yes | recon n2(索引2)测的是已登录用户按读权限过滤仓库列表，非「访客」视角，与hidden n2(访客看不到私有仓库)主体不完全一致；recon n1 checks 已含「Private repository name is never displayed」覆盖该点 |
| github | REQ-2-1-2 | n1 | 已登录用户创建唯一组织后可重新打开其概览 | yes | yes | recon n1 完全对应：创建唯一组织，成为Owner，持久化 |
| github | REQ-2-1-2 | n2 | 重复组织名不会创建新的组织 | yes | yes | recon n2 完全对应：重复组织名拒绝，即使缺显示名 |
| github | REQ-2-1-2 | n3 | 不合规组织名或空显示名会被拒绝且不创建组织 | yes | yes | recon n3 完全对应：非法标识符与空白显示名均被拒绝 |
| github | REQ-2-2-1 | n1 | 组织所有者创建团队后，团队归属在重新打开后保持 | yes | yes | recon n1 完全对应：Owner创建团队+可选父团队+持久化 |
| github | REQ-2-2-1 | n2 | 不合规或重复团队名不生成团队 | no | no | hidden n2 是「不合规或重复团队名」不生成团队(名称校验)，recon n2(索引2)测的是非Owner权限不能创建团队(权限校验)——完全不同的失败原因，且全req只有2条测试，没有任何一条测试团队名称本身的校验 |
| github | REQ-2-2-2 | n1 | 团队维护者添加并移除成员，成员列表会同步更新 | yes | yes | recon n1 完全对应：维护者增/删成员+父团队保存，持久化 |
| github | REQ-2-2-2 | n2 | 不能把团队的后代团队设为父团队形成循环层级 | yes | yes | recon n2 完全对应：选后代团队为父团队被拒，原父团队保留 |
| github | REQ-2-2-3 | n1 | Owner 直接添加 Member 后成员关系在双方页面持久化 | yes | yes | recon n1 完全对应：Owner添加Member，双方页面持久化同一关系 |
| github | REQ-2-2-3 | n2 | 已有成员或未知账户不会产生重复成员关系 | partial | partial | recon n2(索引2)只测了「未知账户」被拒这一半，hidden n2 还要求「已有成员」重复添加不产生重复关系，这一半完全没有测试用例 |
| github | REQ-2-2-4 | n1 | 组织所有者移除成员后，该成员不再出现在组织人员列表 | yes | yes | recon n1 完全对应：Owner移除成员，人员列表不再出现 |
| github | REQ-2-2-4 | n2 | 非组织所有者不能移除其他组织成员 | yes | yes | recon n2 完全对应：非Owner无移除入口或被拒绝 |
| github | REQ-2-3 | n1 | 管理员向团队授予仓库角色后，授权在重新打开时仍可见 | yes | yes | recon n1 完全对应：向团队授予Write，单条记录持久化 |
| github | REQ-2-3 | n2 | 修改已有团队角色会替换原授权而不会生成重复记录 | yes | yes | recon n2 完全对应：改Write为Read替换原授权，仅一条记录 |
| github | REQ-3-1 | n1 | 访客搜索可见仓库并从结果打开仓库概览 | yes | yes | recon n1 完全对应：访客搜索关键词+打开公共仓库概览+私有隐藏 |
| github | REQ-3-1 | n2 | 访客搜索时不会得到无权访问的私有仓库结果 | no | yes | recon n2(索引2)测的是已登录用户搜索并打开(非访客视角)，与hidden n2(访客搜索不返回无权限私有仓库结果)主题不同；recon n1 checks「No result for secret-research is shown to the visitor」+recon n4 均覆盖该点 |
| github | REQ-3-1 | n3 | 无匹配搜索显示空结果而不会展示无关仓库 | yes | yes | recon n3 完全对应：无匹配查询显示空结果，返回重复查询仍空 |
| github | REQ-3-1 | n4 | 公开仓库搜索结果在刷新后仍然可见 | no | yes | recon n4(索引4)测的是私有仓库名精确搜索对访客不可见(与hidden n2主题重复)，hidden n4 是公开仓库搜索结果刷新后仍可见——顺序错位；recon n2 的「已登录搜索acme-docs后刷新/重新打开保持可见」在「公开仓库」这一点上可类比覆盖 |
| github | REQ-3-2-1 | n1 | 已登录用户以指定可见性和 README 初始化创建仓库 | yes | yes | recon n1 完全对应：指定可见性+README初始化创建仓库并持久化 |
| github | REQ-3-2-1 | n2 | 重复仓库名不会创建半完成的仓库 | partial | partial | recon n2(索引2)将「重复名」和「空名」合并测试，但侧重「表单不关闭/不创建」，未显式验证hidden n2强调的「不留半完成仓库(无部分分支/README/提交)」这一原子性断言；该断言存在于recon n3但触发条件是「无权限命名空间」而非「重复名」 |
| github | REQ-3-2-1 | n3 | 空仓库名不会创建仓库并显示字段错误 | no | yes | recon n3(索引3)触发条件是无权限组织命名空间，hidden n3 触发条件是空仓库名——两者都测「拒绝+不创建」但触发原因不同；recon n2 checks 含「An empty repository name is rejected」精确覆盖 |
| github | REQ-3-2-2 | n1 | 用户将可访问仓库 Fork 到个人命名空间后可查看来源链接 | yes | yes | recon n1 完全对应：Fork到目标命名空间+显示来源链接+持久化 |
| github | REQ-3-2-2 | n2 | 目标命名空间已有同名 Fork 时不创建第二个 Fork | yes | yes | recon n2 完全对应：目标命名空间已有同名Fork时拒绝创建 |
| github | REQ-3-2-3 | n1 | 访客复制 HTTPS 克隆地址时得到可粘贴 URL 且仓库内容不变 | yes | yes | recon n1 完全对应：访客复制HTTPS/SSH克隆值+仓库内容不变 |
| github | REQ-3-2-3 | n2 | 用户选择 SSH 时复制 SSH 克隆地址 | partial | partial | hidden n2 强调「选择SSH协议」这一操作本身，recon n2(索引2)侧重私有仓库+已登录用户权限和刷新持久化，SSH只是顺带提及，没有专门验证选中SSH标签后取得的是SSH格式地址 |
| github | REQ-3-3 | n1 | 访客打开公共仓库概览可查看身份、可见性和内容入口 | yes | yes | recon n1 完全对应：访客打开公共仓库概览，身份/可见性/内容入口均可见 |
| github | REQ-3-4 | n1 | 仓库管理员确认变更可见性后，访客访问规则同步更新 | yes | yes | recon n1 完全对应：管理员改为Public后访客访问规则同步更新 |
| github | REQ-3-4 | n2 | 无管理员权限的用户不能看到可执行的可见性修改入口 | yes | yes | recon n2 完全对应：非管理员看不到可执行的可见性修改入口 |
| github | REQ-4-1 | n1 | 用户可逐级浏览目录并查看所选分支中的文件内容 | yes | yes | recon n1 完全对应：逐级点击目录+查看文件内容+按分支过滤 |
| github | REQ-4-2-1 | n1 | 用户可查看分支提交历史中的消息、作者和时间 | yes | yes | recon n1 完全对应：提交历史显示消息/作者/相对时间 |
| github | REQ-4-2-2 | n1 | 用户打开提交后可查看变更文件和新增/删除差异 | yes | yes | recon n1 完全对应：打开提交查看变更文件+增删行 |
| github | REQ-4-2-3 | n1 | 用户在仓库范围搜索代码并打开匹配文件 | yes | yes | recon n1 完全对应：仓库范围搜索代码+打开匹配文件 |
| github | REQ-4-2-3 | n2 | 仓库代码无匹配项时显示空结果且保持仓库搜索范围 | yes | yes | recon n2 完全对应：无匹配显示空结果，保留查询与过滤条件 |
| github | REQ-4-2-3 | n3 | 代码搜索结果在刷新后仍然保留当前文件上下文 | yes | yes | recon n3 完全对应：搜索结果打开文件后刷新仍保留上下文 |
| github | REQ-4-2-3 | n4 | 空代码搜索在返回代码页后仍保持空结果 | yes | yes | recon n4 完全对应：空搜索返回页面重复搜索仍是空结果 |
| github | REQ-4-3-1 | n1 | 用户从分支选择器切换分支，浏览上下文随之变化 | yes | yes | recon n1 完全对应：分支选择器切换，文件列表/内容随之变化 |
| github | REQ-4-3-1 | n2 | 分支搜索无匹配项时保持当前活动分支不变 | yes | yes | recon n2 完全对应：分支搜索无匹配，当前活动分支不变 |
| github | REQ-4-3-2 | n1 | 有协作权限的用户从现有修订创建并切换到新分支 | yes | yes | recon n1 完全对应：从现有修订创建并切换新分支 |
| github | REQ-4-3-2 | n2 | 非法分支名不会创建分支 | yes | yes | recon n2 完全对应：非法分支名不创建分支 |
| github | REQ-4-3-3 | n1 | 管理员修改默认分支后，新打开的仓库使用新分支且旧分支保留 | yes | yes | recon n1 完全对应：改默认分支，旧分支保留 |
| github | REQ-4-3-3 | n2 | 没有仓库管理权限的用户不能修改默认分支 | yes | yes | recon n2 完全对应：无管理权限用户不能改默认分支 |
| github | REQ-4-4 | n1 | 有写权限的用户通过 Web 编辑器提交文件变更并保留提交历史 | yes | yes | recon n1 完全对应：Web编辑器提交文件变更，保留提交历史 |
| github | REQ-4-4 | n2 | 空提交消息或非法文件路径不会改变分支内容 | yes | yes | recon n2 完全对应：空提交信息或非法路径不改变分支内容 |
| github | REQ-5-1-1 | n1 | 用户按状态和关键词筛选议题，筛选不改变原议题 | yes | yes | recon n1 完全对应：按状态+关键词+标签筛选，不改变议题数据 |
| github | REQ-5-1-1 | n2 | 按关闭状态筛选时只显示匹配的已关闭议题 | yes | yes | recon n2 完全对应：Closed筛选+标题搜索只显示匹配的已关闭议题 |
| github | REQ-5-1-2 | n1 | 用户打开议题详情可查看标题、描述、状态和讨论 | yes | yes | recon n1 完全对应：打开议题详情查看标题/描述/状态/讨论，刷新保留 |
| github | REQ-5-1-2 | n2 | 议题详情在刷新后仍保持标题和描述可见 | no | yes | recon n2(索引2)测的是只读权限用户看不到可编辑控件——与hidden n2(刷新后标题描述仍可见)主题不同；recon n1 checks「Refreshing or reopening the same issue number shows the same title...」已覆盖 |
| github | REQ-5-1-2 | n3 | 离开后重新打开议题仍显示同一详情 | no | yes | recon n3(索引3)测的是无仓库查看权限用户被拒绝访问——与hidden n3(离开重新打开议题仍显示同一详情)主题不同；recon n1 checks「...or reopening the same issue number shows the same title」已覆盖 |
| github | REQ-5-2-1 | n1 | 已登录用户创建非空议题后，详情和列表均可找到该议题 | yes | yes | recon n1 完全对应：创建非空议题，详情和列表均可找到 |
| github | REQ-5-2-1 | n2 | 空白标题不会创建议题 | yes | yes | recon n2 完全对应：三个空格标题视为空白，拒绝创建 |
| github | REQ-5-2-2 | n1 | 有编辑权限的用户保存新标题和描述，重新打开后仍显示新值 | yes | yes | recon n1 完全对应：保存新标题和描述，重新打开显示新值 |
| github | REQ-5-2-2 | n2 | 空白标题保存失败且重新打开后仍保留原标题 | yes | yes | recon n2 完全对应：空白标题保存失败，重新打开保留原标题 |
| github | REQ-5-2-3 | n1 | 已登录用户发布非空评论后，评论和作者持久化在时间线中 | yes | yes | recon n1 完全对应：发布非空评论，作者与内容持久化在时间线 |
| github | REQ-5-2-3 | n2 | 空白或纯空格评论不会新增时间线记录 | yes | yes | recon n2 完全对应：纯空格评论不产生新记录 |
| github | REQ-5-3-1 | n1 | 用户分配并取消分配可用成员，议题元数据会同步更新 | yes | yes | recon n1 完全对应：分配并取消分配成员，元数据同步更新 |
| github | REQ-5-3-2 | n1 | 用户为议题应用当前仓库标签，重新打开后标签仍可见 | yes | yes | recon n1 完全对应：应用当前仓库标签，重新打开仍可见 |
| github | REQ-5-3-3 | n1 | 用户将议题归入当前仓库里程碑，关联在重新打开后仍存在 | yes | yes | recon n1 完全对应：归入当前仓库里程碑，重新打开关联仍存在 |
| github | REQ-5-4 | n1 | 有权限的用户关闭并重新打开议题，状态转换会记录在活动中 | yes | yes | recon n1 完全对应：关闭并重新打开议题，状态转换记录在活动中 |
| github | REQ-5-4 | n2 | 没有议题管理权限的用户不能关闭或重新打开议题 | yes | yes | recon n2 完全对应：无权限用户不能关闭或重新打开 |
| github | REQ-6-1 | n1 | 管理员保存分支保护规则后，规则在重新打开时仍可见 | yes | yes | recon n1 完全对应：创建分支保护规则，重新打开仍可见(同时捆绑了check更新) |
| github | REQ-6-1 | n2 | 非仓库管理员不能创建或修改分支保护规则 | yes | yes | recon n2 完全对应：非管理员不能创建或修改保护规则 |
| github | REQ-6-1 | n3 | 管理员将当前比较提交的 test 检查更新为 success 且结果持久化 | yes | yes | recon n3 完全对应：管理员将当前比较提交的test检查更新为success并持久化 |
| github | REQ-6-2-1 | n1 | 用户按打开状态筛选拉取请求并打开目标提案 | yes | yes | recon n1 完全对应：按Open状态筛选PR并打开目标提案 |
| github | REQ-6-2-1 | n2 | 打开状态筛选在刷新后仍保持相同提案可见 | yes | yes | recon n2 完全对应：刷新或重新打开后同一Open提案仍可见(同时覆盖了n3) |
| github | REQ-6-2-1 | n3 | 离开后重新进入拉取请求列表仍能找到打开状态提案 | no | yes | recon n3(索引3)测的是Closed筛选显示已关闭PR——与hidden n3(离开重新进入列表仍能找到Open提案)主题不同；recon n2 checks「Leaving and reopening the list then selecting Open again shows the same PR」已覆盖 |
| github | REQ-6-2-2 | n1 | 协作者比较两个不同分支后可查看提交数、文件和差异摘要 | yes | yes | recon n1 完全对应：比较两分支显示提交数/文件/差异摘要 |
| github | REQ-6-2-2 | n2 | 基础分支和比较分支相同时不能创建拉取请求 | yes | yes | recon n2 完全对应：基础分支等于比较分支时禁止创建PR |
| github | REQ-6-2-3 | n1 | 协作者基于有效比较创建打开状态的拉取请求 | yes | yes | recon n1 完全对应：基于有效比较创建Open状态PR |
| github | REQ-6-2-3 | n2 | 空白标题不会从比较结果创建拉取请求 | yes | yes | recon n2 完全对应：空白标题不创建PR记录 |
| github | REQ-6-2-4 | n1 | 协作者创建草稿拉取请求后显示 Draft 且不可合并 | yes | yes | recon n1 完全对应：创建草稿PR显示Draft且Merge禁用 |
| github | REQ-6-2-4 | n2 | PR 作者可将草稿标记为可评审且不改变其内容 | yes | yes | recon n2 完全对应：标记为可评审，状态变Open，内容不变 |
| github | REQ-6-3-1 | n1 | 评审者可在拉取请求查看概览、提交和变更文件上下文 | yes | yes | recon n1 完全对应：概览/提交/变更文件三个标签均可查看 |
| github | REQ-6-3-1 | n2 | 拉取请求详情在刷新后仍保留标题和标签页入口 | yes | yes | recon n2 完全对应：刷新后标题、分支、标签页入口不变 |
| github | REQ-6-3-1 | n3 | 离开后重新打开同一拉取请求仍能查看概览和变更文件 | yes | yes | recon n3 完全对应：离开重新打开同一PR恢复概览和标签 |
| github | REQ-6-3-2 | n1 | 访客查看拉取请求差异时可看到文件路径和增删行汇总 | yes | yes | recon n1 完全对应：访客查看差异，文件路径+增删行汇总 |
| github | REQ-6-3-3 | n1 | 评审者在变更行添加单条评论后，评论会显示在讨论中 | yes | yes | recon n1 完全对应：变更行添加单条评论，显示在讨论中 |
| github | REQ-6-3-3 | n2 | 开始评审时行内评论保持待提交状态而不立即发布 | yes | yes | recon n2 完全对应：Start a review时评论保持待提交 |
| github | REQ-6-3-4 | n1 | 评审者提交批准决定后，拉取请求显示该评审状态 | yes | yes | recon n1 完全对应：提交Approve后显示该评审状态 |
| github | REQ-6-3-4 | n2 | 评审者请求修改时保存评审意见和 Changes requested 状态 | yes | yes | recon n2 完全对应：Request changes保存意见和状态 |
| github | REQ-6-4 | n1 | 作者请求并移除评审者后，评审者区域同步更新 | yes | yes | recon n1 完全对应：请求并移除评审者，区域同步更新 |
| github | REQ-6-5 | n1 | 维护者合并满足条件的拉取请求后，详情显示 merged 状态 | yes | yes | recon n1 完全对应：合并满足条件的PR，显示merged状态 |
| github | REQ-6-5 | n2 | 未满足评审或保护规则时不能合并拉取请求 | yes | yes | recon n2 完全对应：未满足条件时不能合并 |
| github | REQ-6-6 | n1 | 作者关闭并重新打开拉取请求，状态转换保留在活动记录中 | yes | yes | recon n1 完全对应：作者关闭并重新打开PR，状态记录在活动中 |
| github | REQ-6-6 | n2 | 非作者且非维护者不能关闭或重新打开拉取请求 | yes | yes | recon n2 完全对应：非作者非维护者不能关闭或重新打开 |

## B=no 全部列表（按类型归类）

### sheet：B=no 全部列表（按类型归类，共 15 条）

**具体数据类型覆盖**（1 条）
- **REQ-3-1-1 n3**（Edit a Cell Through the Grid or Formula Bar）：通过网格提交文本、数字、布尔值、日期文本和公式 —— hidden n3 要求文本/数字/布尔值/日期文本/公式多种类型均可通过网格提交，recon 4条里布尔值和日期文本两种类型完全没有测试用例

**具体边界值**（4 条）
- **REQ-3-1-1 n4**（Edit a Cell Through the Grid or Formula Bar）：在更深的单元格位置提交公式并在刷新后保持 —— hidden n4「更深单元格位置提交公式」(疑似大网格/靠后位置的健壮性)，recon 4条都没有测试非首屏/远端单元格位置
- **REQ-3-1-2 n5**（Paste Two-Dimensional Table Data）：从 C3 粘贴两行两列表格并保留源外内容 —— hidden n5 是「从C3粘贴2行2列，保留源外内容」，recon全部5条都没有测试C3起点或2x2尺寸的粘贴场景，只测了B2和A1两个起点
- **REQ-5-1-2 n5**（Filter Rows by Value or Condition）：筛选到空结果后刷新仍保持空结果状态 —— hidden n5 是筛选到空结果集后刷新仍是空结果，recon全部5条测试筛选后都至少留有一行可见，没有测试全部隐藏(0行)这一边界情形
- **REQ-5-2-1 n2**（Set Dropdown or Numeric Validation for a Range）：数值范围拒绝越界输入并在刷新后继续接受包含边界 —— hidden n2 强调「包含边界」即恰好输入0或100应被接受，recon n2(索引2)只验证了150被拒和50(非边界值)被接受，未验证0/100本身被接受，边界值本身缺失测试

**多工作表**（2 条）
- **REQ-1-3-2 n3**（Export the Current Worksheet as CSV）：导出当前活动的第二个工作表内容 —— hidden n3 是「导出当前激活的第二个工作表」，即导出跟随激活sheet切换；recon 4条测试都没有测试切换到非Sheet1后再导出
- **REQ-1-3-2 n4**（Export the Current Worksheet as CSV）：切回 Sheet1 后导出仍只包含当前工作表内容 —— hidden n4 是「切回Sheet1后导出仍只含当前表」，同样是多工作表激活态相关，recon全部未覆盖

**操作粒度缺失**（1 条）
- **REQ-3-2-1 n4**（Copy, Cut, and Paste Cell Ranges）：复制单个单元格到新位置并保留源值 —— hidden n4 是「复制单个单元格到新位置，保留源值」，recon全部4条测试都是A1:B2整块范围复制/剪切，没有单一单元格粒度的复制测试

**方向/类型组合缺失**（1 条）
- **REQ-5-1-1 n6**（Sort a Data Range by a Specified Column）：按日期降序排序后保留表头和范围外单元格 —— hidden n6 是按日期降序排序保留表头和范围外单元格，recon 6条里没有任何一条做日期降序排序，recon n2只测了日期升序

**条件类型覆盖**（1 条）
- **REQ-5-1-2 n2**（Filter Rows by Value or Condition）：组合文本包含、日期比较和为空条件，并支持非空条件 —— hidden n2 要求文本包含、日期比较、为空/非空条件类型，recon全部5条测试只出现过Region值筛选和Sales的Greater than数值条件，文本包含/日期比较/空值条件完全未出现

**行为语义理解偏差**（1 条）
- **REQ-5-3-1 n4**（Create and Refresh a Basic Pivot Table）：AVERAGE 忽略非数值记录并保持源数据不变 —— hidden n4 强调AVERAGE「忽略非数值记录」(部分非数值时仍平均数值部分)，recon n4(索引4)只是普通AVERAGE正确性验证，没有非数值记录场景；recon n9测的是「整字段全非数值→报错」这一更严格的all-or-nothing行为，与「忽略非数值、继续计算数值部分」的宽容语义并不一致，可能是理解偏差

**跨功能联动**（2 条）
- **REQ-5-1-1 n4**（Sort a Data Range by a Specified Column）：排序后已有筛选条件继续控制对应数据行 —— hidden n4 是排序后已有筛选条件仍作用于对应数据行，recon 6条测试全部没有涉及筛选与排序的交互
- **REQ-5-3-1 n6**（Create and Refresh a Basic Pivot Table）：刷新透视表时汇总被筛选隐藏的源记录 —— hidden n6 是刷新透视表时汇总被筛选隐藏的源记录(即透视应忽略筛选可见性)，recon全部9条测试都没有出现「筛选」与「透视」的交互场景

**错误情形细分**（2 条）
- **REQ-4-2-2 n3**（Display and Fix Formula Errors）：间接循环引用中的所有公式显示并持久化引用错误 —— hidden n3 要求「间接循环引用」(多单元格构成环)，recon 5条测试里只有n5测了直接自引用(=A1+1 in A1)，没有任何测试构造跨单元格的间接循环引用
- **REQ-4-2-2 n5**（Display and Fix Formula Errors）：自引用错误可被有效公式覆盖并保持新结果 —— recon n5(索引5)只展示了自引用初始报错，未测「被有效公式覆盖后保持新结果」的修复步骤；现有的修复流程范式(recon n3)针对的是NAME错误而非自引用，自引用修复涉及打破循环依赖，机制上不能简单等同


### github：B=no 全部列表（按类型归类，共 1 条）

**验证类型缺失(权限vs名称)**（1 条）
- **REQ-2-2-1 n2**（Create an Organization Team）：不合规或重复团队名不生成团队 —— hidden n2 是「不合规或重复团队名」不生成团队(名称校验)，recon n2(索引2)测的是非Owner权限不能创建团队(权限校验)——完全不同的失败原因，且全req只有2条测试，没有任何一条测试团队名称本身的校验


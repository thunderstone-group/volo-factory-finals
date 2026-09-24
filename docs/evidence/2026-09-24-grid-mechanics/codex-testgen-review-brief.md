# 任务

只读的对抗性设计评审：把「按需求生成 Playwright 测试 → 在初稿上跑 → 按失败修复」接进一次性生成包（VOLO Factory one-shot），用于 ARC-Bench 初赛的两道正式题。给出结论（做 / 改后做 / 不做）、按严重度排序的风险、对设计的具体修改，以及写死判据的最便宜证伪实验。报告用中文，写到本 job 目录的 `review.md`，最终消息给同样内容的摘要。

# 上下文（你看不到我的对话，前提都在这里）

## 赛制（真源 ~/projects/volo-factory/docs/reference/preliminary-rules.md）
- 初赛 09-24 00:00 到 09-30 23:59，成绩取所有正式提交里最高的一次。正式提交串行：一次提交同时跑两题，跑完才能发下一次。每队比赛券 500 元，现余约 494 元。
- 得分 S = p / (b/(1.2p))^0.1（b ≤ 1.2p 时）。p 为两题合计通过率（百分数），b 为两题总费用（元）。费用乘以 k 相当于 p 乘以 k^(−1/11)。
- 运行环境：镜像 mcr.microsoft.com/playwright/python:v1.57.0-noble，Node 20，1 核 CPU，2 GB 内存；隐藏测试 Playwright 1 个 worker，单测试和断言超时都是 10 秒；只放行软件源（npm/pip）和官方模型网关。智能体契约：`python3 main.py <需求目录> --output-dir ...`，退出码 0，交付 frontend/ + backend/。单任务最长 48 小时。
- 合规：包里不能有针对具体题目的页面、业务逻辑、专名；不能泄露、推测或绕过隐藏测试。平台 run 记录里有 `failed_tests`（逐条失败名和报错），我们只拿来诊断通用问题，不进包。

## 两道正式题（需求在 ~/projects/arcbench-campaign/evidence/2026-09-24-hackathon/requirements/）
- `hackathon--sheet`：在线表格，24 个 ATOMIC、48 个场景、73 KB 需求，100 条隐藏测试。
- `hackathon--github`：GitHub 协作平台，47 个 ATOMIC、64 个场景、181 KB 需求，100 条隐藏测试。其中 93 条目前被评测方漏配的 `E2E_*` 环境变量挡住（报 `Evaluation fixture is missing`），主办方答复会补上并重评旧提交，并说应用要把需求末尾 `data` 字段描述的种子数据写进自己的库。具体怎样对上，重评前未知。
- 两题需求都极细：控件角色和可访问名逐字给出（例如 “New blank workbook”、“Edit <cell coordinate>”、“Formula bar”、“Sort range” 对话框里的 “Sort by”/“Order” 组合框）。

## 隐藏测试的形态（只来自 failed_tests）
- TypeScript，路径形如 `/workspace/tests/REQ-1-1-3-password-recovery.spec.ts`，有 helper（`openAccountAccess(page)`、`openSignUp`），测试名是中文描述，前缀需求编号，例如 `REQ-5-1-1：按 Sales 稳定降序排列完整记录，并保持范围外数据`。每个 ATOMIC 约 2–9 条，数量多于需求里的场景数。
- 定位用 `getByRole(role, { name, exact: true })`、`getByLabel(label, { exact: true })`，严格模式；GitHub 失败例：页头和正文各有一个 “Sign in” 链接 → strict mode violation。Sheet 的失败全部只有一行 `Test timeout of 10000ms exceeded.`，看不到定位器。
- Sheet 需求的 data 节写明剪贴板测试用真实的 Ctrl+C/X/V 或网格右键菜单 “Paste”，由测试把文本放进浏览器剪贴板。

## 正式提交账本（~/projects/volo-factory/docs/progress.md 末尾的表）
| # | 包 | GitHub | Sheet | 元 | S | 改动 |
|---|---|---|---|---|---|---|
| 1 | bb73b7f4 | 5 | 3 | 1.95 | 4.4 | 基线 |
| 2 | 14297021 | 3 | 42 | 2.10 | 29.0 | 共享状态脚手架：记录经服务器在浏览器会话间共享（PR #65） |
| 3 | 1b4e26a8 | 1 | 跑中 | | | 可点击组合框 `ARC.combobox` + 方言卡「名字精确、唯一、不被嵌套污染」（PR #67） |
榜上第一 Iris 28.5%，我们 22.5% 第二。

提交 2 的 Sheet：失败 58 条全是超时。按需求编号（用提交 1 的 97 条失败名推出提交 2 通过了哪些）：REQ-5（排序、筛选、校验、透视，共 26 条）全挂；REQ-3-1-2 粘贴 5 条全挂；REQ-3-2-1 复制剪切挂 3/4；其余需求大多部分通过。原始数据：~/projects/arcbench-campaign/evidence/2026-09-24-hackathon/official/run-*.json（19ec9fcc0139 = 提交 1 Sheet，1d84ee5aa3d4 = 提交 2 Sheet，56e06858dc92 / 02eb86092cc9 = 提交 1/2 GitHub）；两次 Sheet 的产物 bundle-*.zip 同目录。

## 当前包（~/projects/volo-factory，main 47c9fd4）
- `oneshot/main.py`：flash（deepseek-v4-flash）一次调用写完整应用（Sheet 约 9 万 completion token，其中大半是推理，app.js 71 KB 单文件，约 15 分钟，0.93 元）→ 冒烟门禁（构建、启动、语法、jsdom 点击遍历）→ 静态门禁 → 场景自检（`scenarios.py` 规则解析 + `scenario_translate.py` 一次 flash 翻译 + `scenario_check.py/.cjs` 在 Chromium 里执行）→ `repair_delivery()` 场景驱动修复循环（`judge()`：至少修好一条、每丢 1 条要多过 3 条、改名否决、复查抖动；每题修复封顶 3 元、6 次调用、连续 3 次被拒即停）。
- **场景自检在两道正式题上覆盖率约 0**（规则 0/48、0/64，加模型翻译 0/48、1/64，翻译各花 0.22/0.25 元），所以正式题上修复循环从不启动，包实际上是「初稿 + 静态门禁」。
- 脚手架 `oneshot/scaffold/`（README 是架构说明），方言卡 `oneshot/dialect.md`。

## 已有原型（不在包里）
- `~/projects/volo-factory/docs/evidence/2026-09-24-opening-day/testgen/`：`testgen_proto.py` 一次 flash 调用写 `fixtures.cjs`（通过应用 UI 建前置状态），再按顶层需求目录并行各一次调用写 `REQ-n.spec.cjs`（每个场景一条测试，共 48 条）。Sheet 五次 spec 调用共 2.41 元，每次 290–630 秒、3–7 万 completion token。`run_suite.sh`：Playwright 1.57、1 worker、15 秒测试、5 秒动作、剪贴板权限。
- 在提交 2 的 Sheet 产物上：48 条里过 28、挂 20。其中 12 条是测试自己的 bug（fixtures 用了未定义的 `page`，ReferenceError）；手修后 REQ-5 全部因原生 `<select>` 的选项点不到、或同一选项名在三个 select 里重复（严格模式）而失败——这是 PR #67 的证据。其余真失败：工作表标签名被嵌套按钮污染、缺双击出现的 “Edit A1” 行内编辑框、粘贴、绝对引用。所有「测试因应用缺陷失败」的需求在隐藏测试里也有失败；但本地测试通过、隐藏测试却超时的也不少（例如 REQ-2-2-1 本地过，隐藏 5 条挂 3 条）。
- 早上你做过一次方向评审（~/projects/volo-factory/docs/evidence/2026-09-24-opening-day/codex-direction-review.md），把「A 模型全量写测试」排最后，推荐「E 小范围可校准探针」。那次评审早于共享状态修复和上面这份原型数据。

# 我提议的设计 v0（请攻击它）

1. 起草开始时，在后台线程并行生成测试（只依赖需求，不看应用）：先 fixtures，再按顶层需求目录并行写 spec；与起草并行，不增加墙钟。
2. 起草交付后：npm 装 `@playwright/test@1.57.0` 到临时前缀（包里已经这样装 `playwright@1.57.0`；镜像自带 Chromium），对整份应用起一个后端，1 worker 顺序跑全部生成测试（与隐藏测试同形：同一个实例、状态会累积）。
3. 分类：pass；app-fail（Playwright 定位或断言失败，且失败步骤里的名字在需求原文里逐字出现，或是本测试刚生成的值）；test-error（测试代码自身抛 ReferenceError/TypeError/SyntaxError、文件加载失败、定位名字在需求里找不到）。test-error 不进修复，也不计入得失。
4. 生成的测试结果按现有场景报告的形状交给 `repair_delivery()`：修复请求里给失败测试名、失败的那行测试代码、报错（定位器、期望与实际）、以及要保持通过的测试。`judge()` 用重跑整套测试的结果比较得失，沿用「至少修好一条、每丢 1 条多过 3 条」。
5. 在这两道题上，场景解析和翻译调用直接去掉（覆盖率约 0 却每题花 0.2 元），由生成测试取代。
6. 预算：生成测试每题约 2.5–4 元，修复沿用每题 3 元封顶。单次提交总费用从约 2 元升到约 12–18 元；按公式 p 要从 22.5 提到约 26 以上才不亏。
7. 另一项独立的小机制：确定性的「同名控件」门禁——在真浏览器里走一遍能点到的页面，需求里引号引用的控件名在同一屏出现多于一个可见元素就报问题，并允许它单独触发一次修复（现在的规则是静态门禁不单独触发修复）。

# 请回答
1. 结论：做 / 改后做 / 不做，一句话理由。和你早上把 A 排最后的判断相比，新证据改变了什么、没改变什么。
2. v0 最可能失败的三处，每处给出能在本地用现有产物证伪的实验和写死的判据。重点：测试自身错误怎样识别（fixtures 错一处能打挂一半测试；隐藏测试和我们的测试对同一需求可能选择不同交互路径，例如直接在网格打字 vs 双击出 “Edit A1”）；本地通过而隐藏超时这类假通过对修复的意义；修复整份重发 71 KB app.js 的倒退风险。
3. 修复的接受规则要不要改（例如按需求编号而不是按测试条数计得失、对 fixtures 级失败单独处理）。
4. 成本和时间：生成测试能不能更便宜（例如 reasoning_effort=low、按 ATOMIC 分批、只给相关需求子树），会不会伤质量；1 核上跑 48–64 条测试加 2–3 轮修复的墙钟。
5. 第 7 项同名门禁：值不值得单独做、放在哪一层（门禁触发修复 vs 脚手架运行时自动去重同 href 的重复链接）、风险。
6. 如果只能先做一件事拿分，你选什么。

# 边界
- 只读：可以读仓库、证据、需求，可以跑本地只读命令和已有测试，不改仓库文件、不提交、不调用模型网关、不上传、不起官方评测。
- 输出只写到本 job 目录（review.md）。
- 质疑前提时给证据（文件:行号或数据）。不要泛泛而谈。

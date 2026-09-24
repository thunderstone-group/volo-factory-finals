# 任务
对「初赛正式题开赛后，VOLO Factory harness 接下来 6～24 小时该做什么」做一次对抗式评审：挑出我的方案里的错误前提和盲点，按「每工程小时能换来多少期望得分」给出排序后的推荐，并为推荐的第一项写出可执行、可验收的判据。只读评审，不改任何仓库文件。

# 上下文（你看不到我的对话历史，前提全写在这里）

## 赛制（真源 ~/projects/volo-factory/docs/reference/preliminary-rules.md）
- 初赛 09-24 00:00～09-30 23:59，成绩取队伍所有正式提交里的历史最高分。每次正式提交同时跑两道题，跑完才出分；同一队伍不能并行两次正式评测。
- 得分 S：p 为两题合计通过数/合计测试数（百分数），b 为两题总费用（元）；b ≤ 1.2p 时 S = p / (b/(1.2p))^0.1。我们费用一直远低于 1.2p，所以费用只占 0.1 次方，通过率几乎决定一切。
- 比赛额度 500 元，提交次数不限。单次正式提交预计 5～10 元，所以大约能交 50 次。
- 平台只返回每题的通过数和费用，不给逐条测试结果。每任务 1 核 2 GB，Playwright 1 worker，单测试和断言超时都是 10 秒，应用端口 3000，单任务最长 48 小时。
- 合规：包里不能有针对具体任务的页面、业务逻辑或功能组件；业务代码必须来自模型输出；不能推测或绕过隐藏测试。

## 两道正式题（需求原文已下载）
- ~/projects/arcbench-campaign/evidence/2026-09-24-hackathon/requirements/hackathon--github/requirements.yaml（181 KB，47 个 ATOMIC 需求，64 个场景，隐藏测试 100 条）
- ~/projects/arcbench-campaign/evidence/2026-09-24-hackathon/requirements/hackathon--sheet/requirements.yaml（73 KB，24 个 ATOMIC，48 个场景，隐藏测试 100 条）
- 两题各占一半权重。reference/ 下的截图我们不读（须知说定位以需求文字为准）。
- 关键原文（GitHub 的 ROOT 描述）：「Values described as existing accounts, organizations, teams, repositories, branches, files, commits, issues, milestones, pull requests, reviews, and permission relationships are evaluation seed data. The evaluation environment must provision those records before the corresponding scenario and supply each account through an isolated browser session; they are not extra features that a participant must expose through a test-only API. Generated names may contain a unique suffix」。Sheet 的场景写「A fresh preconfigured worksheet is open; A1 is ...」。需求里没有任何具名种子数据。我的推断：隐藏测试的 fixture 通过我们应用自己的界面流程（注册、登录、建仓库、网页编辑文件、新建工作簿、输入单元格等）造数据，所以这些创建流程是几乎所有测试的必经路径。请核实或推翻这个推断。
- 需求把控件名、ARIA 角色写得非常具体（例如 grid 名为 “Worksheet grid”、gridcell 的可访问名是坐标 A1、按钮 “New blank workbook”、链接 “Create an account”）。Sheet 还要求右键菜单、拖拽/区域选择、Ctrl+V 粘贴、撤销重做、公式、排序筛选、数据校验、数据透视。
- 练习题的公开测试风格（隐藏测试最接近的样本）：~/projects/arcbench-campaign/upstream/hackathon-local-simulation/public-exercise/{keep,bookstack}/tests/（helpers.ts 的 resolveNamed 阶梯：role+name 正则，再 label、placeholder、text；练习题用的是应用自带的具名种子数据，正式题不同）。

## harness 现状（仓库 ~/projects/volo-factory，main df9fcce，开赛包 SHA-256 bb73b7f4…43aa）
- 入口 oneshot/main.py：一次 flash（deepseek-v4-flash）调用写全应用（带 oneshot/scaffold 脚手架和 oneshot/dialect.md 方言卡），截断时续写；然后跑静态门禁（语法、启动、jsdom 点击遍历、若干名字门禁）和场景自检（oneshot/scenarios.py 规则解析 + oneshot/scenario_translate.py 让 flash 把解析不了的场景翻译成操作 DSL，oneshot/scenario_check.py/.cjs 在 Chromium 里执行），场景失败驱动有界修复（每题修复预算 3 元，接受规则：多过的场景数要比丢的场景数多 3 倍，整应用故障修好就收）。
- 路线图和证据：docs/reference/roadmap.md（第 4、5、12 节），docs/SESSION_HANDOFF.md，docs/progress.md 末尾。
- 练习题上的成绩：Keep 32/32、BookStack 32–34/34（场景自检翻译覆盖率在这两题上约 94%）；旧写法 12306 大题本地 101、98/135，大题修复 7 轮只收 1 轮（整份重发大 app.js 容易改坏别处）。

## 今天 11:00 后的新事实
- 场景自检在正式题上失效：规则解析 Sheet 0/48、GitHub 0/64；加上 flash 翻译后 Sheet 0/48、GitHub 1/64。拒绝原因：Sheet 以「不支持拖拽 11、公式栏内容无法校验 9、不支持右键 4、不支持区域选择 3」为主；GitHub 几乎全是「没有具名的账号/组织/仓库，无法建立前置状态」。翻译证据：/private/tmp/claude-501/-Users-e0-7-projects/cb5d46b2-3d9d-4aaa-84d7-d1724ef3bfcc/scratchpad/cov/{sheet,github}.json。
- 所以现在的包在正式题上等于「一次起草 + 静态门禁」，场景驱动的修复不会触发。
- 开赛包的第一次正式提交已在跑（submission 36429109d6ac，run 56e06858dc92 GitHub、19ec9fcc0139 Sheet），结果大约 1～2 小时后出；本地两题各一次生成也在跑。拿到数字后我会续聊补给你。

## 我目前倾向的方向（请重点攻击）
A. 把自检换成「模型按需求写 Playwright 测试」：每个 ATOMIC 需求让 flash 写测试文件，用一套通用 helper（按角色+精确名定位，与公开 helper 同语义），测试自己通过界面造前置数据（注册唯一后缀用户、建仓库、新建工作簿、输入单元格等）；在生成的应用上跑，失败的测试加错误上下文驱动修复，接受规则沿用「通过数净增」。同一套测试在开发期也当本地影子测试集，用来不花比赛额度地比较候选。
B. 大题分模块生成：先生成骨架（数据模型、路由、布局、认证），再按需求文件夹分批生成各模块，减少一次写完 47 个功能的浅实现和截断。
C. 通用的提示/脚手架补强：让起草把「创建类流程」当作必经路径写扎实（精确名、成功后跳转、刷新后持久），不写任何题目专属内容。
D. 直接多次采样同一个包（取最高分）。

# 你要交付的（写进最终汇报）
1. 我的推断和方案里哪些前提是错的或没证据，指出具体文件和原文。
2. A/B/C/D（以及你认为更好的 E）按「每工程小时的期望得分增量」排序，每项给出理由、主要风险和一个最便宜的证伪实验。
3. 对排第一的那项：写出实现要点（改哪些文件、新增什么模块、怎样接进 main.py 的现有修复循环）和写死的完成判据（能在本地、在不花比赛额度的前提下验收）。
4. 你认为今天必须避免的坑（例如费用、1 核 2 GB 的耗时、测试自身出错驱动坏修复、合规）。

# 边界
- 只读：不修改 ~/projects 下任何文件，不 git commit，不调用任何模型网关、不上传、不启动平台 run。
- 可以读任意文件、跑只读命令（grep、python 读 json 等）。
- 汇报用中文，结论先行，完整句子。

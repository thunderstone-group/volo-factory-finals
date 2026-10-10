# 仿隐藏测试评估器（oracle）编写说明

所有路径里的 `$SP` = `/private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad`。

## 边界（硬性）

- 只在你分到的目录 `$SP/oracle/<你的目录>/` 里写文件。
- 不调用任何 LLM 网关，不运行 `arcbench`，不碰比赛平台，不改 `~/projects/volo-factory`，不 git 提交。
- 这套测试只用于本地评估我们自己的应用，永远不会进参赛包。

## 背景

我们参加 ARC-Bench hackathon：参赛 agent 按需求文档生成网页应用，平台用 100 条隐藏 Playwright 测试打分，每个需求场景对应一条。官方运行器的做法：
- 1 个 worker，`fullyParallel: false`，每条测试总超时 10 秒，`expect` 超时 10 秒；
- 全套测试按文档顺序跑，跑在同一个从不重置的应用实例上，前面测试留下的数据后面都看得到；
- 每条测试用 Playwright 默认的新浏览器上下文（未登录），baseURL 是应用首页；
- 失败全部表现为 "Test timeout of 10000ms exceeded"。

隐藏测试的真实意图我们是知道的。`$SP/oracle/<task>-intents.json` 里，每个场景都带 `hidden_intent_zh`，也就是该条隐藏测试的中文标题。这些标题来自平台早期返回的失败记录，和场景一一对应，按顺序和保留词核对过。新版需求把场景文字做了模板化或遮蔽（Sheet 里是 "the requested workflow"，GitHub 有 36 条空泛模板），所以写测试请以 `hidden_intent_zh` 加上该需求的 `description` 为准。场景 GIVEN 里的种子值（账号、密码、工作簿名、仓库名等）仍然有效。个别场景的意图是 unknown，按 description 和残留词推断最可能的意图，并在 notes 里标出。

需求原文：`~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements/hackathon--<task>/requirements.yaml`。文件很长，只读你负责的需求，再加上 ROOT 和各级 FOLDER 的 description（全局约定写在那里）。

## 隐藏测试的写法（照这个风格写）

- 控件按 role 加需求里引号给出的精确可访问名定位，例如 `page.getByRole('button', { name: 'Create filter', exact: true })`。遵守严格模式：命中两个元素就算失败，不许用 `.first()/.last()/.nth()` 绕过。需求说某控件是 link 就用 link，是 button 就用 button。没说的，按原文最自然的读法选，并记为「假设」。
- 从首页 `/` 出发，点击可见控件到达目标。除非意图本身就是「稳定 URL」「重新打开同一地址」，才用 `page.goto` 打开之前记下的 `page.url()`。
- 断言需求写明的东西：文字、状态、数值、消息，用精确值，不用宽松正则或子串去凑。「刷新后保持」「重新打开后仍在」这类意图，要 `page.reload()` 或从入口重新进入后再断言。「被拒绝」「不会创建」这类意图，要断言拒绝消息，并且断言状态没变。
- 种子数据：应用应该自带需求 GIVEN 里写的种子，测试直接用。会破坏共享种子的操作，例如改密码、删除、改名，要先自己创建带唯一后缀的记录再操作，除非意图明确针对种子本身。目标是：在一个完美实现上，整套按文档顺序、在同一个不重置的应用上跑，能 100% 通过。
- 每条测试都要能在 10 秒内跑完，不要 `waitForTimeout` 长等。

## 文件格式

- `$SP/oracle/<你的目录>/tests/NN-REQ-x.spec.cjs`，CommonJS：`const { test, expect } = require('@playwright/test');`。文件名排序就是文档顺序；`NN` 用下面给你的起始编号。
- 每个场景写一条 `test(...)`，放在对应需求的文件里，顺序和 intents.json 的 `order` 一致。
- 标题：
  - Sheet：`<req> S<n>: <hidden_intent_zh>`，例如 `REQ-4-2-2 S3: 间接循环引用中的所有公式显示并持久化引用错误`；
  - GitHub：直接用 `scenario_name` 原文，例如 `REQ-1-1-2: Sign In with an Existing Account - Scenario 2`。
- 同一个文件里的测试可以共用 helper 函数，但每条测试必须能独立理解。

## 独立性（最重要）

测试只能依据需求文本和意图来写，**不要读我们应用的源码来迁就它**。这是评估器，要像出题方一样独立。

可以在应用上运行测试，用来发现**测试自身**的 bug（语法、时序、选择器拼错）。但只能修测试自身的错误，不能因为「应用就是这么做的」去改断言。需求确实没规定的细节，按原文最自然的读法写，并在 notes 里登记为假设。

## 运行与校准

- 运行：`$SP/oracle/run.sh <你的目录> <应用目录> <输出.json> <你的端口>`。它会复制应用、起后端、按官方设置跑你目录下的全部测试，并输出每条测试的状态。只调试一条时，加第 5 个参数作为 `--grep` 的正则。
- 被测应用在 `$SP/oracle/apps/<task>-<隐藏通过数>-<runid>/`。目录名里的数字就是该应用 100 条隐藏测试里过了几条。
- 同时有别的 agent 在跑，只用你自己的端口。

## 产出

1. 测试文件。
2. `$SP/oracle/<你的目录>/notes.md`：每条测试一行，写意图、关键断言、做了哪些假设。
3. `$SP/oracle/<你的目录>/calibration.md`：你的测试在各校准应用上的通过数；典型失败逐条写原因，并判断是「应用缺陷」还是「测试假设可能不对」。

最后回复（中文，不超过 600 字）：
- 写了几条；
- 各应用上的通过数；
- 你判断最常见的 3–5 类应用缺陷（要能泛化到别的应用，不要题目专名层面的描述）；
- 你最不确定的测试假设。

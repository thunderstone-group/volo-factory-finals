# 升级草稿 SEARCH/REPLACE 机制验收（2026-10-06）

已实现默认关闭的 `ONESHOT_UPGRADE_PATCH=1`。三道练习进化题和一份大应用起点共四组真实模型对照中，开启版本的 **64/64 个 hunk 全部应用，纠正 0，未命中 0，现有文件整份重写 0**。两组最终自带验收均为 **24/24**；八次运行共 45 次网关请求，按返回用量估算 **CNY 4.279497 / 15**。四组草稿的静态源码保留率均高于关闭版本。这是本地机制与保留文本的证据，尚无独立旧行为验收或正式决赛成绩。

[证据 JSON](2026-10-06-upgrade-patch-draft.json)包含逐次调用用量、请求/响应哈希、输入与包哈希、文件列表、保留指标和测试结果。[实现](../../oneshot/upgrade_patch.py)、[定向测试](../../tests_oneshot/test_upgrade_patch.py)、[实跑与计量入口](../../scripts/measure_upgrade_patch.py)。

1. **协议和设计。** 只在开关开启且存在升级模板时进入新 executor。复用修复的 `=== EDIT: path ===`、`<<<<<<< SEARCH`、`=======`、`>>>>>>> REPLACE`、`=== END ===` 语法，单独解析整个 block，避免沿用修复 parser 的宽松空白匹配和失败 hunk 跳过策略。现有 UTF-8 文本超过 **4096 字节**必须 EDIT；现有文件不超过该阈值或全新文件可以 FILE。4 KiB 把整份重写限制在短配置和入口的规模，适用所有文件类型，不依赖任务或应用名称；这不是小文件语义安全的保证。提示词移除了升级时互相冲突的“所有文件整份输出”指令，并给源码清单中的每个文件标明字节数和允许模式。执行端再次核验阈值，二进制、元数据和任务输入仍不可写。

   每个 SEARCH 必须逐字、唯一匹配当前文件，连重叠命中也判为歧义；不做模糊或缩进修正。**同一回复中，同一规范化路径的所有 block 是一个事务**，hunk 按顺序在内存中执行，全部成功后才通过临时文件重命名提交。一个失败就保留该文件回复前的版本，其他文件的成功事务保留。选择按文件回滚，是为了避免留下同文件内“调用方已改、函数定义未改”的半成品；跨文件依赖由原有交付检查和修复继续处理。

   截断时只接受完整 block；同一回复里先前已闭合、但之后又被截断的同文件 block 也不应用。续写要求重新输出该文件本轮全部修改，并基于本轮回复前的内容。草稿续写结束后集中反馈一次失败事务，附带搜索文本、原因和带行号的当前邻近源码；歧义展示最多三个命中位置，长行明确标为截短。模糊相似度只选择诊断片段，绝不参与应用。纠正有独立的一个完成调用名额，计入真实调用/费用与共享传输失败账本，避免四次草稿续写耗尽纠正机会。仍失败的事务进入报告和后续对话，正常检查、测试生成与修复继续；全体草稿 hunk 失败也能进入修复。纠正自身截断不会再开第二个纠正回合。

   `proposed_hunks` 计完整 block 中的提议，重发计重复；`applied_hunks` 只计提交成功的 hunk；`corrected_hunks` 是纠正回合成功提交的数量，包含按文件重发的原可匹配 hunk。最终的 `unmatched_hunks` 与 `unapplied_hunks` 分别记录未解决 SEARCH 和事务回滚扣留量；未闭合 block 另外列出，不能算已应用。测试生成、守卫、修复匹配与发布算法没有改动。

2. **确定性验证。** 新增 **21 项定向测试，21 通过、0 跳过**：混合 EDIT/FILE、严格唯一匹配、歧义/未命中、文件级回滚与路径别名、顺序 hunk 和 CRLF、字节阈值、禁止整文件兜底、一次纠正、草稿限额与纠正名额、截断及断流恢复、纠正截断、全体失败后继续修复、元数据/requirements/越界/符号链接保护。所有传输 fixture 均标为 synthetic。

   关闭开关对照修改前提交 `9e1051e3fd207b90fc371e7b64e0e3e65ce7e711`：三种初始对话（新建、升级、scaffold）的序列化字节哈希一致；一次整文件升级及其长度截断续写的 **两次完整 HTTP 请求体字节哈希、输出文件字节一致**。开启开关的新建应用也保持原提示词。完整 `tests_oneshot` **345 项：342 通过、3 跳过、0 失败/错误**；三项均是旧 `ScenarioCheckEndToEnd` 要求完整 Chromium executable，机器已有的 headless shell 已执行本次真实验收。legacy `tests` **226 项：214 通过、12 跳过**，原因是既有 Docker/可选浏览器环境条件，逐项见 JSON。

3. **真实模型方法与输入。** 从 allowlist ZIP 解包后调用其真实 `main()`，使用 `deepseek-v4-flash-vision-exp` 和 `https://api.arc-bench.com/v1`，密钥只从用户指定 env 文件载入进程。BookStack、Keep、12306 使用 `2026-10-06-finals/base-recovered/<task>` 起点和对应的原始练习需求；大应用使用用户指定的 `v7-official-github-79/application`，搭配**原样 Keep 练习需求**，用于跨应用保留压力测试。没有编造或读取正式决赛需求。每组都有一个开启和一个关闭开关的新鲜样本。

   按平台布局把整份需求目录复制到每个输出目录的 `requirements/`，将该目录传给入口。八份需求副本结束后与原始目录哈希一致，四份外部起点源码也复核未变。所有输出在本工作树 `runs/upgrade-patch/`。两个版本都使用默认测试生成、宽松回归守卫和进化跳过源码审查；Light 编译器保持关闭。为控制总预算，双方都设置 `ONESHOT_REPAIR_CNY=1`、`FALLBACK_MODEL=''`，其余调用/修复策略沿用原值。计量器在请求前预留输入字节上界与最大输出额度，45 次请求最终均收到完整 usage，无失败或未知计费调用；调用日志数与费用账本逐组一致。没有平台 API、上传、推送或合并。

下表均为**草稿结束、进入测试和修复之前**的指标。“开/关”顺序固定；completion tokens 含网关计入的 reasoning tokens。

| 起点与需求 | 开启版 hunk 提议/应用/纠正/未命中 | completion tokens 开/关 | 草稿估算 CNY 开/关 | 源码行保留率 开/关 | 具名函数保留 开/关 |
|---|---:|---:|---:|---:|---:|
| BookStack + 对应练习需求 | 16/16/0/0 | 49,154 / 47,046 | 0.217203 / 0.188804 | 807/831（97.11%）/ 763/831（91.82%） | 50/50 / 50/50 |
| Keep + 对应练习需求 | 20/20/0/0 | 78,579 / 75,209 | 0.336996 / 0.301542 | 943/1086（86.83%）/ 611/1086（56.26%） | 49/54 / 33/54 |
| 12306 + 对应练习需求 | 22/22/0/0 | 69,322 / 89,698 | 0.321868 / 0.359891 | 1592/1639（97.13%）/ 1516/1639（92.50%） | 47/48 / 46/48 |
| GitHub 起点 + Keep 练习需求 | 6/6/0/0 | 68,867 / 71,347 | 0.328605 / 0.338321 | 2892/2893（99.97%）/ 742/2893（25.65%） | 78/78 / 12/78 |

保留率使用原 `.js/.cjs/.mjs/.html/.css` 文件的非空源码行多重集，与**同路径**草稿求逐字交集。函数指标按 `function NAME(` 词法提取、逐路径统计原名称是否仍存在，不涵盖箭头函数/对象方法，也不判断函数体正确性。合法需求修改、改名和格式变化都会降低指标；重复或不可达代码可能抬高指标。因此这些数字能观察重写损失与修改范围，不能证明旧行为全部保持。

开启版本四次均只有 EDIT，**FILE 重写 0、新建文件 0**。路径清单如下；其余源码逐字节保留。

| 起点 | 开启版 EDIT 路径 | 关闭版 FILE 路径 |
|---|---|---|
| BookStack | `frontend/public/index.html` | `backend/server.js`、`frontend/public/index.html` |
| Keep | `backend/server.js`、`frontend/public/index.html` | 同左 |
| 12306 | `frontend/public/app.js`、`frontend/public/lib/arc.js`、`frontend/public/seed.js`、`frontend/public/styles.css` | 除 `seed.js` 外同左 |
| GitHub 起点 | `frontend/public/app.js`、`frontend/public/seed.js`、`frontend/public/styles.css` | 同左 |

完整流程的自带验收如下。P/F/E 分别为通过、失败、检查错误；它们是模型写出的需求验收，非独立或官方成绩。检查错误可以由原有测试修补流程修正，所以应用修复轮数为 0 也可能从 5P/1E 达到 6P。

| 运行 | 草稿首次自测 P/F/E | 最终自测 P/F/E | 应用修复轮数 | 全流程估算 CNY | 本地秒数 |
|---|---:|---:|---:|---:|---:|
| BookStack 开 | 5/1/0 | 6/0/0 | 1 | 0.368463 | 361 |
| BookStack 关 | 3/3/0 | 6/0/0 | 2 | 0.432941 | 465 |
| Keep 开 | 4/1/1 | 6/0/0 | 1 | 0.541321 | 492 |
| Keep 关 | 4/1/1 | 6/0/0 | 2 | 0.680891 | 734 |
| 12306 开 | 6/0/0 | 6/0/0 | 1 | 0.392026 | 355 |
| 12306 关 | 6/0/0 | 6/0/0 | 1 | 0.491049 | 441 |
| GitHub 起点开 | 5/0/1 | 6/0/0 | 0 | 0.490210 | 462 |
| GitHub 起点关 | 6/0/0 | 6/0/0 | 2 | 0.882594 | 762 |

开启版合计 265,922 completion tokens、草稿 CNY 1.204673；关闭版 283,300、CNY 1.188558。输出 token 少约 6.1%，草稿费用反而高约 1.4%，缓存命中和输入用量也影响费用；不据此承诺省 token 或省钱。完整流程开启版 CNY 1.792022、应用修复 3 轮，关闭版 CNY 2.487475、修复 7 轮。GitHub 关闭对照经两轮普通修复，最终具名函数也恢复到 **78/78**、源码行恢复到 **2890/2893**；不能把草稿的 12/78 当成最终交付结果。

费用按仓库 10-02 网关价表折算：输入/缓存输入/输出为每百万 token CNY 1/0.02/4；未查询平台账户余额或账单。不同对照运行共享本机资源，墙钟时间只作本次记录。每组一个样本，不足以判断泛化或方差；大应用的跨领域压力测试尤其不能代替正式决赛需求。

4. **包、复验与交付。** 实跑开启版包为 `a9aa3ac433192609bf1cae1e7a4aff60c87f62b8c4adf8760e138510ac4c6a3a`，关闭版为 `abbe7c1d6b1fb023e67c03ed696cdb02ecf4b56023284d311b79e63e08af598c`。运行启动后补齐了“所有事务失败也继续检查”、跨回复同文件续写说明、纠正截断及未应用计数等边界；四个开启实跑都在第一回复成功，未进入这些分支。最终包 **`6293670acb85669f24ff381e0700cada14229c467b2fa647a2b6b38ab9a28bd6`** 实际解包后重放这四份真实模型回复，**64 个 hunk、32 个文件全部与实跑草稿逐字节相同**；四组最终完整初始提示词也与实跑请求逐字节相同。边界恢复另由上述确定性测试覆盖，不冒充真实模型纠正成功的证据。

原始日志、草稿、最终应用、需求副本、自带测试和包保存在 `runs/upgrade-patch/`，另归档为 `retained-evidence.tar.gz`；归档 SHA-256 和大小记在证据 JSON。报告及旁边的证据 JSON 随本地代码提交，原始大文件保留在忽略目录。开关继续默认关闭，当前分支只本地提交。

复验命令（使用本机已有运行库；`TMPDIR` 放在工作树以隔离产物）：

```sh
NODE_PATH=/var/folders/j8/60kxyby16mzdsdsy73k7w4bc0000gn/T/oneshot-playwright-test-1.57.0/node_modules \
PYTHONPATH=.:tests_oneshot PYTHONDONTWRITEBYTECODE=1 TMPDIR="$PWD/runs/upgrade-patch/tmp" \
~/projects/volo-factory/.venv/bin/python -m unittest discover -s tests_oneshot -v

~/projects/volo-factory/.venv/bin/python scripts/package_oneshot.py --output runs/upgrade-patch/candidate.zip

# 真实运行会付费。BASE_APP 与 REQUIREMENT_DIR 只读；分别以 --flag 1 和 0 使用不同 WORK_DIR。
NODE_PATH=/var/folders/j8/60kxyby16mzdsdsy73k7w4bc0000gn/T/oneshot-playwright-test-1.57.0/node_modules \
PYTHONDONTWRITEBYTECODE=1 TMPDIR="$PWD/runs/upgrade-patch/tmp" ONESHOT_REPAIR_CNY=1 \
~/projects/volo-factory/.venv/bin/python scripts/measure_upgrade_patch.py \
  --package runs/upgrade-patch/candidate.zip --base "$BASE_APP" --requirements "$REQUIREMENT_DIR" \
  --work "$WORK_DIR" --ledger runs/upgrade-patch/budget.json --flag 1 \
  --env-file ~/.config/arcbench/volo.env --budget-cny 15
```

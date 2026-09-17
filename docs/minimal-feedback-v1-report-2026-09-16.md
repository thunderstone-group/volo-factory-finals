# 极简版第一阶段：失败定位续报

日期：2026-09-16。沿用 `feat/minimal-feedback-v1-20260916` 与现有未提交原型。
本轮没有改变执行单、main、默认生成器或参赛包，也没有付费调用、上传、push 或合并。

## 当前验收结果

原有两项失败均已定位到可复现的测试前提问题并修正。指定离线套件现为
**68 项全部通过，0 failure / error / skip，4.133 秒，退出码 0**。
这仅说明语法反馈、路径/交付保护和进程限制通过本轮离线验收；仍没有真实模型修复、
构建、启动或独立行为验收，不能宣布整个极简版已经完成或质量提高。

## 两项失败的证据与修正

| 原失败 | 本轮证据 | 修改 |
| --- | --- | --- |
| 输出上限断言得到 timeout | 未改代码时两个旧用例自然重跑均通过。输出探针正常只需 0.0243 秒；对真实 Popen 注入 0.25 秒启动延迟，旧 0.2 秒测试稳定得到 timeout、0 字节；同一延迟与 3 秒测试期限得到 output_limit、16,384 字节 | 将 timeout 与 output_limit 分成独立真实进程测试。timeout 仍用 0.2 秒；输出测试有独立 3 秒期限且显式覆盖慢启动，不改变生产检查的 10 秒总期限 |
| 重复路径断言得到 environment_error | 原路径用例先为每个非法响应执行两次真实 Node 检查；本次 20 次 Node 调用均正常（约 0.04–0.10 秒）。注入前置检查 timeout 时，即使响应有重复路径，程序仍应在消费响应前停止，replay_calls=0 | 路径协议测试使用明确标记的合成 product_fail 前提，检查越界、受保护路径和规范化重复路径均被拒绝；另测环境故障优先、响应不消费、原始产物保留。真实 Node 的修复及跨轮回归测试保留 |

**证据边界：旧日志没有保留当时那一次 environment_error 的底层原因，不能反推为
Node 故障、机器负载或权限问题。** 本轮证明的是两种失效条件及测试耦合，未自然重现
原运行时的瞬时原因。自然重跑的 22 次进程记录与故障注入都单独保留。
运行耗时 4.133 秒不能与旧环境的 99.473 秒直接比较为性能提升。

## 运行时的小范围修正

`oneshot/minimal_feedback.py:_process()` 现在：

- 记录 timeout_seconds、spawn_seconds、elapsed_seconds 和清理后的实际退出码。
- spawn/capture 错误保留异常类型、errno 和脱敏描述，归为 environment_error。
- 剩余检查额度已耗尽时不再启动一个注定超时的 Node 进程；仍不重试或修产品。
- 所有已启动进程仍在 finally 清理，测试实际检查进程已 wait/reap 且管道已关闭。

产品失败仍必须来自带匹配源码路径的 Node SyntaxError；截断输出保持 unknown。
没有放宽 product_fail 判据，没有把 unknown 当 pass，working/retained 的原有规则未改。

## 精确命令和证据

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=.:tests_oneshot ~/projects/volo-factory/.venv/bin/python -B -m unittest test_minimal_feedback test_oneshot.OfflineCase test_oneshot.PackageTests test_evolution test_arc_read -v
```

本轮证据目录：`runs/minimal-feedback-v1/diagnosis-20260916/`。

- `before/`、`before-sha256.json`：接手时原型、执行单、报告和测试的副本/哈希。
- `reproduction-processes.json`：未改代码时两个旧测试自然通过的 22 次进程记录。
- `fault-injection-before.json`：慢启动和前置检查超时的可控复现。
- `targeted-tests.log`：12 项定位/进程测试通过。
- `final-offline-tests.log`：最终指定 68 项全部通过。
- `execution-capability.json`：只读 Docker 能力探针，不运行容器或应用。
- `integrity.json`、`final.zip`、`final.zip.manifest.json`：冻结源码与执行单未变；隔离 ZIP
  与 canonical 默认包同为 `8e59406c7960f4301d51c7f20978e0cf58bdd5bc22a6aedfce0174a5c183d007`。

原始 63 项失败日志没有覆盖。旧完整 suite 的 6 fail / 81 error / 12 skip 也仍是失败记录；
本轮仅只读检查该日志，不把它改记为通过，不以扩大权限重跑被拒绝的绑定端口测试。
其中 11 个 KeyError 都出现在测试读取缺失结果字段时；日志不足以逐一归因，保持未解决。
其实现位于冻结旧 harness，未被本轮变更触及。

## 构建、健康和行为反馈的最小接入边界

当前只读 `docker info` 返回 exit 1：Docker daemon 在本机 socket 上不可连接。
本轮未启动守护进程、安装运行时、监听端口或执行生成应用。
清空环境变量、临时目录和进程组清理不足以隔离任意 npm/Node 代码对宿主文件与网络的访问，
因此本轮没有把它们宣称为完整隔离方案。

后续仍属于第一阶段的最小实施顺序：

1. 先建立可用的既有隔离执行器（若以容器实现，使用已准备好的运行时镜像、关闭网络、
   无凭据、只读输入/独立可写应用副本、资源/日志/时间上限，结束统一删除该次容器）。
   暂不做镜像下载、任意 npm install 或整套旧 harness 移植。
2. 第一条反馈只接 build 和服务启动/健康协议。缺执行器、缺依赖或无法连接测试设施是
   environment_error；成功构建或 health 200 只能证明对应范围，不赋予行为通过。
3. 行为阶段只接明确提供给运行时、固定且经过校准的只读 suite。当前该输入是 absent；
   没有它仍保留 behavior=unknown，不临时编造检查器，也不回灌开发者离线测试结果。
4. 用合成正确/错误应用证明判定与清理边界，再交规划负责人审阅；阶段二的真实付费
   配对实验不随本报告自动放行。

这份续报不修改执行单的决策。工作区保留供审阅，代码未推送/合并。

---

# 上一轮审阅记录（历史，保留原始失败与限制）

# 极简版（minimal）第一阶段审阅收尾报告

日期：2026-09-16。基线提交：`b07f6f4bf4727cb671f5497e1e0a8d8822b6276d`。
工作区：`~/projects/volo-factory-worktrees/minimal-feedback-v1-20260916`，
分支：`feat/minimal-feedback-v1-20260916`。本次沿用已有实现，只修审阅点；未提交。

## 结果与范围

修复了第二轮重复使用 A0 源码/诊断的问题，新增跨文件累计修复及回归保护用例。
指定最终离线套件 **63 项，61 通过、2 失败、0 error、0 skip，99.473 秒，退出码 1**。
第二包来源、真实新诊断、working 哈希、累计修复和失败/回归交付 A0 的用例通过，
但完整指定套件未全绿，不能报告第一阶段已验收通过。

这是**离线语法反馈原型**，不是实际模型调用或完整行为闭环。响应是预先注入的合成文本；
记录的反馈包没有交给真实模型生成下一次响应。无官方比赛成绩或提分证据。

当前方向统一称为「极简版 / minimal」；one-shot 仅指历史首次生成基线。
新增 [minimal.md](minimal.md)，在 [oneshot.md](oneshot.md) 顶部增加链接并保留历史内容。
`oneshot/`、`tests_oneshot/`、`scripts/package_oneshot.py` 继续作为兼容路径，默认入口、
默认行为和三文件打包白名单未变；原型模块仍不进入默认包。

## 实际数据流与反馈矩阵

本表来自现有源码调用点，没有重新调查平台或假定隐藏输入存在。

| 输入或反馈 | 来源文件及调用点 | 运行时实际可得性与本原型接入 | 独立性与可判定范围 | 未知或限制 |
| --- | --- | --- | --- | --- |
| 用户需求 | `oneshot/main.py:main()` 读取指定目录的 `requirements.yaml`，传给 `generate()` 组装消息 | 明确提供的 YAML 真实可得；首次生成使用，语法修复包不再读取需求文件 | 外部需求输入，不是生成器的自评 | 无法从未提供的需求/图片推导隐藏断言；本次未调用生成网关 |
| 既有模板与资源 | `read_template()`、`template_context()`；CLI 检测预置应用或显式 `--template-dir` | 明确提供的应用源码真实可得；有界快照，文本进入首次生成上下文，二进制仅记录大小/哈希并保留 | 模板输入，不是验收结果 | 排除点文件、依赖/构建缓存；没有自动获取可选参考图片的链路，不补不存在的输入 |
| 交付契约及静态检查 | `oneshot/dialect.md`、`main.py:CONTRACT`、`missing_required()` | 首次生成带契约；原型复用静态文件、manifest、入口检查 | 检查逻辑独立于响应文本，但只是开发者定义的交付约束 | 脚本存在不等于执行成功；缺输入归为 unknown，不盲修 |
| 后端 JavaScript 语法 | `minimal_feedback.py:check_syntax()` 调 `_process([node, "--check", ...])` | 本机真实执行；若目标运行时没有 Node 则 environment_error；原型是显式离线入口，默认运行不接入 | Node 解析器独立于生成器；匹配文件位置和 `SyntaxError` 的退出码 1 才是 product_fail | 仅 `.js/.cjs/.mjs` 语法；不运行应用、不检查依赖解析、状态或文案；语法 pass 不是需求通过 |
| 构建、进程启动、健康反馈 | 本原型无调用点；`missing_required()` 只读脚本声明 | **未接入**；需具备安全执行、清理和隔离条件后另行实现 | 真实构建/进程/健康结果可独立于生成器，但需区分产品与环境故障 | 本次不执行 npm build、应用入口或监听端口，不能报告构建/健康通过 |
| 运行时独立行为验收 | 默认生成入口和原型都没有 suite 参数或加载调用点 | **absent**，没有明确提供并校准的运行时行为验收 | 当前无法赋予需求 verified 状态 | `behavior` 保持 unknown，`verified_requirements` 始终为空；官方成绩另行记录 |
| 开发者下载的 tests、隐藏断言及离线测分 | 原型不读取这些输入；反馈包只选受检后端 JS 与 `backend/package.json`，失败来自固定解析器 | 不回灌、不用于逐轮选择候选；本次未运行比赛或官方行为 tests | 可用于冻结产物后的独立测分，不是本原型的修复信号 | `test_no_offline_suite_or_self_check_enters_packet_or_executes` 用合成 sentinel 验证来源分离；不能把下载的 tests 混进应用源码输入 |
| 模型自编检查 | 原型不加载/执行 `checks/`，不接受任意 checker 回调 | 本轮 absent | 即使以后提供也只能作为诊断线索 | 自编检查不是独立验收，本次不以它赋予通过状态 |

输入边界仍依赖调用者提供干净应用 A0：`read_template()` 是应用源快照机制，不是语义上的
测试内容识别器；把离线断言人为塞进可编辑的后端 JS 不会因此自动变成合法输入。

## 最小代码修改

实现位于 `oneshot/minimal_feedback.py:run()`：

1. retained 初始为隔离的 A0 副本；另设 working 和 working_snapshot，最初同样指向 A0。
2. 每轮反馈包包含 A0、retained、working 的源码哈希；源码取自 working_snapshot，
   failures 取自对该版本的真实 Node 检查。下一候选从 working 复制。
3. product_fail 候选只有在所有既有 protected syntax passes 仍通过时才能成为 working。
   同步其新诊断/源码，并把新增语法通过项并入 protected；retained 不变，accepted 仍为 false。
4. 全部受检语法通过才替换 retained 并发布候选。两轮仍失败、unknown、environment_error、
   已知语法回归、非法/截断响应均停止并交付 A0；A0 自身可能有语法错误，不宣称其行为正确。
5. 不修改原始应用。原有路径限制、完整文件替换、不可编辑元数据、检查前后源码对比、
   发布前 retained 哈希和原始源/元数据 stamp 检查保留；working 无变化也按 no_change 拒绝。

每轮的 `working_source_sha256` 是修复前版本，`candidate_source_sha256` 是修复后版本；
每轮 `retained_source_sha256` 是该轮开始时的保留版本，顶层同名字段是最终交付版本。
`modified` 保留相对 A0 的累计文件列表。哈希覆盖 `read_template()` 的完整源码快照，
不覆盖被排除的本地元数据；反馈包仅含上述相关源码，且哈希在日志脱敏前计算。

响应最多两份，统一 `CallBudget(limit=2)`，没有真实调用、重试或续写。
`model_api_calls=0`，replay 次数单独记账，`cost=None`、`cost_status=offline_no_billing`；
合成响应没有真实用量，不能据此推算真实模型成本。

## 验证命令与证据

最终源码版本执行的完整指定命令：

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=.:tests_oneshot ~/projects/volo-factory/.venv/bin/python -B -m unittest test_minimal_feedback test_oneshot.OfflineCase test_oneshot.PackageTests test_evolution test_arc_read -v
```

输出保存在 `runs/minimal-feedback-v1/after-review-offline-tests.log`。结果如前述：
`Ran 63 tests in 99.473s`，`FAILED (failures=2)`，退出码 1。新增/更新的三项回归测试均通过：

- `test_second_response_uses_failed_candidate_source_diagnostic_and_hash`：第二包包含第一候选源码、
  与真实检查记录完全一致的新诊断，哈希与独立重建的 working 快照一致；retained 仍为 A0。
- `test_partial_syntax_repairs_accumulate_across_rounds`：先修 server.js，再只改 another.cjs，
  最终两者都保留，原始 A0 不变。
- `test_partial_repair_followed_by_failure_or_new_pass_regression_keeps_a0`：第二轮仍失败或破坏
  第一轮新增通过项都交付原始 A0。既有 baseline protected 回归和两次失败用例也通过。

本次未通过的两项，不隐藏也不以 skip 替换：

| 用例 | 实际观察 | 证据边界 |
| --- | --- | --- |
| `test_actual_process_timeout_output_cap_and_reaping` 的 output_limit 子例 | 期待 output_limit，实际 timeout；既有测试给两个分支同样的 0.2 秒上限 | 本次未证明输出上限分支通过，未继续归因或修改测试超时 |
| `test_traversal_preserved_frontend_manifest_and_duplicate_paths_cannot_be_repaired` | 最后的重复路径断言期待 invalid_repair，实际 environment_error | 最终日志未带具体环境错误原因，不能判定根因；不算本次该用例通过 |

修复前还执行过仅含上述三项新回归的检查，日志为
`runs/minimal-feedback-v1/review-regressions-before-fix.log`：3 项、24.752 秒、3 fail。
其中两项先遇 environment_error，另一项观察到应报回归却报 round_limit；不把全部失败当作
旧数据流缺陷的运行证明。修复后指定套件已真实覆盖这三项。

首任务 `feedback-tests.log` 的 17 项成功发生在其最后编辑之前；`oneshot-tests.log` 等旧日志
均保留，但不作为本次最终验证。当前新日志单独命名，无覆盖旧证据。

首任务旧全仓 suite 只读检查了已有 `legacy-tests.log`，**本次没有重跑或修复**：
226 项、124.428 秒、6 fail / 81 error / 12 skip，未通过。81 个 error 中，70 个 traceback
明确出现 `PermissionError: [Errno 1] Operation not permitted`；另 11 个是缺少 cases、
timed_out、executed_checks、retained_self_check 或 defective_check 的 KeyError，尚未归因。
6 个 fail 中两个结果含 Operation not permitted、一个含 timeout，另三个为断言不满足；
这些也不足以证明所有旧失败都是环境问题。12 个 skip 不计通过。

反馈链路仅执行既有真实 Node --check；响应为注入的合成文本。保留的进程限额单测使用原有
固定 Python 子进程探针，不执行生成应用。本次没有绑定端口、扩权、浏览器、其他代理、
网关请求、上传或比赛运行；未访问会话或凭据文件。

## 隔离包与不变边界

```sh
PYTHONDONTWRITEBYTECODE=1 ~/projects/volo-factory/.venv/bin/python -B scripts/package_oneshot.py --output runs/minimal-feedback-v1/after-review.zip
git diff --check
git diff --exit-code b07f6f4bf4727cb671f5497e1e0a8d8822b6276d -- main.py volo harness_lab scripts/package.py oneshot/main.py oneshot/dialect.md oneshot/requirements.txt oneshot/source_manifest.json scripts/package_oneshot.py
```

隔离包及 manifest 位于 `runs/minimal-feedback-v1/after-review.zip` 和同名 `.manifest.json`，
打包命令退出码 0；日志为 `after-review-package.log`。ZIP 仍只含 main.py、dialect.md、
requirements.txt，与主 checkout 的默认 `oneshot/dist/oneshot.zip` 同为 SHA-256：

`8e59406c7960f4301d51c7f20978e0cf58bdd5bc22a6aedfce0174a5c183d007`

当前 worktree 原本没有 `oneshot/dist`，本次未创建；主 checkout 默认包只读核对。
工作区旧 `dist/volo-factory.zip` 也未改。基线生成源、root main.py / volo / harness_lab /
scripts/package.py、打包脚本与给定 Git 基线相同。
执行单最新 SHA-256 为 `b117fb611b9d8ff97e25dc97d93644aa89d26e687339df628212dbc0884b27b2`，
本次没有改写协调者追加的命名/审阅内容。

开始时的受保护文件哈希保存在 `review-input-sha256.json`；最终核对见同目录
`after-review-integrity.json`。`git diff --check` 和受保护路径对比均退出码 0。
这些是代码/工件不变证据，不是行为或评分证据。

## 未知与下一最小缺口

本原型不能检出已知 Counter 的后端状态继承错误，也不能检出 Ticket 的状态/文案错误或
补全输入中未提供的标题、参考图。没有构建、健康及独立行为结果，更没有真实模型的
按反馈修复质量、收敛率、成本或泛化证据，不能宣称提分。

当前首先保留两项离线失败供独立验收，不把套件标绿。反馈能力的下一最小缺口是：在获得
安全执行条件后，选择一条来自明确公开需求、实际提供给运行时并经过校准的独立行为验收，
同时记录构建/健康反馈，区分产品失败与环境故障，再验证工作候选选择。不回灌开发者下载的
测试或隐藏断言；不以增加第三次尝试替代缺失的证据。真实付费配对生成仍待另行授权。

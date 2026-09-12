# 公开答案缓存与极低模型成本：授权对抗复现

本次按用户转述的主办方需求，在用户明确指定的 **VOLO AI 现有练习榜账号**执行。
所有新提交均以 `SECURITY-REPRO` 命名，产物和日志声明为对抗验证，不声明通用 Agent 能力。
目标是提供可复现路径，帮助主办方区分成品正确性、模型参与程度和评测数据边界。

## 已取得的结果

| 对照 | 官方通过率 | 实际模型调用 | Token | 官方模型费用（CNY） | 效率表现 |
|---|---:|---:|---:|---:|---|
| 固定公开答案，仅 Counter | 100%（1/1） | 0 | 0 | 0 | 子榜 `cost_efficiency=null` |
| 固定公开答案＋极短分类，两项 Smoke | 100%（2/2） | 2 | 50 | **0.000072** | **Smoke 总榜第 1，1,388,888.8889** |
| 此前实际生成页面的参考版本，两项 Smoke | 100%（2/2） | 2 | 452 | 0.002114 | 47,303.6897；本次对照之后总榜第 2 |

分类版每题 25 Token、CNY 0.000036。模型只选择 Counter 或 Dice，程序据此选择包内预置页面。
分类输出确实影响程序：本地控制测试中，将 Counter 输入对应的模型回答改成 Dice，会安装 Dice 页面。
这不是应用源码生成过程；源码已经存在于提交包中。代码和日志均明确记录这一点。
从官方 source 接口取回的 Counter HTML，在零调用和分类两组中逐字节相同。
分类组增加的模型响应仅为 `Counter`；Dice 组的响应仅为 `dice`。

分类版比此前生成版的表面费用低约 29.36 倍，但工作负担已经不同，不能把它解释为模型生成能力提升。
效率字段的本次数值为 `100 / 0.000072 = 1,388,888.8889`，其中 100 是百分制通过率。
它不表示实际完成了 138 万个任务。50 Token 按百万单位显示时也会接近或显示为 `0.0M`。

零调用控制在官方系统内显示 `PASSED`、0 Token、CNY 0、生成耗时 0 秒。
其 Counter 子榜记录的 `efficiency_eligible` 仍为 `true`，但效率值为 `null`，当时排名落到第 16。
后续分类控制完成后，Counter 子榜恢复为第 1，费用 CNY 0.000036、效率 2,777,777.7778。
这里记录的是连续快照，不据此推断尚未取得的后台聚合算法。

## 可核验的运行与代码

| 控制 | 提交 ID | 运行 |
|---|---|---|
| 零模型调用 | `4dc548c49e40` | [Counter：5328c93e9838](https://arc-bench.com/runs/5328c93e9838) |
| 固定答案＋分类 | `8f6c053c90cc` | [Counter：6076600e642d](https://arc-bench.com/runs/6076600e642d)、[Dice：03d81f1d24ed](https://arc-bench.com/runs/03d81f1d24ed) |

零调用控制源码提交为 `fd64f2b`，分类控制为 `691a6c8`。
源文件是 [public_answer_baseline.py](../harness_lab/public_answer_baseline.py)，
构建器是 [package_public_answer.py](../scripts/package_public_answer.py)。
输入严格限定为四个已公开任务的指纹，普通 Agent 打包不会包含这组对照代码。

- 零调用 ZIP SHA-256：`a4fb48fad3aaba12244eddaf412f8dca2433010cdf8dd2a10641a74281bc7172`
- 分类 ZIP SHA-256：`b6331161c3d8c70474a985b3d6a68f07b35d43bcfc2a5bfa223661504f52b415`
- 共用原始包 SHA-256：`dc071c4d398a25c0d4e325d5d163c392e2b8d925010922e604d260ac17f0ae95`

两个控制包只替换入口并加入专用模块，保留原包其他文件和公开测试的原始字节。
上传后均通过下载和 SHA-256 核对再运行。模型走主办方配置的网关；分类请求最多一次、最多四个输出 Token。
官方费用、Token、通过率直接来自平台结果，不由对照脚本填写。

复现的操作顺序是：构建独立包，上传并核对哈希，串行执行任务，读取官方结果，再下载本次自己的声明、trace 和 Playwright 报告。
例如分类包的构建入口为：

```sh
python3 scripts/package_public_answer.py \
  --base /path/to/frozen-practice4-agent.zip \
  --output /path/to/security-repro-router.zip --tiny-router
```

运行后的核心证据位于 `.factory/security-reproduction.json`、`.factory/events.jsonl` 和 `.arc/playwright-report.json`。
结构化汇总与哈希见 [证据索引](evidence/2026-09-13-security-reproduction.json)。
原始完整记录保存在 canonical checkout 的 `runs/security-reproduction-20260912/`。

本地验证使用真实 HTTP 和浏览器，四个固定答案通过了未改动的六个公开用例。
零调用入口的模拟网关观察到零请求；分类入口的模拟响应验证了模板选择的实际依赖。
最后一轮回归共 186 项：181 通过，5 项因未配置容器镜像而跳过。
随后三次官方运行提供真实平台结果。模拟响应只用于本地程序验证。

## 主办方需要分别处理的两件事

**公开题的答案缓存。** 本次极低成本路径不需要读取服务端隐藏信息：公开需求和公开用例已经足以制作固定页面。
加密服务端测试文件无法消除这个对照。若榜单目标是衡量生成与泛化能力，应在冻结 Agent 后使用未公开的新任务或语义变化，
并单独披露预置方案、缓存命中、模型路由和模型生成。单纯要求 Token 大于零，不能证明模型生成了应用。
传统代码或模板复用是否允许，应由赛制明确；本次不把功能真实通过本身称为伪造结果。

**运行时的数据隔离。** 此前 [199816b1dd39](https://arc-bench.com/runs/199816b1dd39) 已实测参赛代码可读取本次测试目录中的公开测试指纹和运行配置，
并通过自己的产物文件与官方 source 接口取回，评测容器无需连接我们的服务器。
因此，仅限制公网访问不能防止已经可读的数据经正常产物渠道返回。
这次读取的是公开测试与配置，尚未验证隐藏题、其他队伍数据或后台计分源码的可访问性。

建议将生成程序、受测应用和可信验收分开运行。验收用例、解密材料和评分输出留在候选程序不可见、不可写的文件系统与进程边界内；
应用只提供被测试的接口。只读挂载只能限制写入，不能满足隐藏用例的保密目标。
Docker 的命名空间、权限和能力限制可作为实现基础，但本次没有部署或验收服务端整改。
参见 [Docker Engine security](https://docs.docker.com/engine/security/)。

生成阶段的模型访问可经受控网关；验收阶段应限制不必要的出站连接，并继续考虑日志与产物这一允许的返回通道。
完全禁网的独立容器可使用 `--network none`，此时仅保留 loopback；需要跨容器测试时，应设计相应的受控连接。
参见 [Docker none network](https://docs.docker.com/engine/network/drivers/none/)。

CPU、内存和阶段耗时也应明确配置并记录。当前取得的报告不足以确认正式容器的资源上限；不能从 Docker 默认值推断平台实配。
参见 [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)。

本次证明了一条能产生同量级极低成本数据的路径，没有证明其他队伍使用了这条路径。
新榜首是明确标注的审计对照，应由主办方在分析和正式成绩中按用途分类处理。
通用 `main` 分支及普通 Agent 包保持原样；未继续运行 Ticket，也未修改线上计费或测试结果。

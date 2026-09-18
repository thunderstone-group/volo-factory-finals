# Verified harness core — 实际实现与使用边界

> Historical branch record for `8f0f25d`. For the combined implementation and current paths,
> see [the consolidation review](harness-consolidation-2026-09-12.md) and [lab map](../../../harness_lab/README.md).

2026-09-12，开发分支 `feat/verified-harness-core`，基于研究提交 `4d8f619`。

## 本次实现范围

这是 G0 的独立验收基础和 G1 的部分离线接线验证，不是新的官方分数，也不是已完成的 Pi 比赛方案。

- `volo/agent.py`：dev30 在首次截断后解除整包/单补丁强制模式，允许普通文件工具；连续三次截断停止。残缺响应的所有工具均不执行，已存在源码保留。没有新增 Ticket 业务规则。
- `harness_lab/evaluate.py`：对任意执行器产出的候选目录做独立容器验收。生成器退出码和自测文件不决定外层通过。
- `harness_lab/pi_adapter.py`：固定 Pi 版本和网关的显式调用配置；禁用隐式个人/项目资源、自动重试和自动压缩。此配置是离线接线起点，不是大任务优化参数。
- `harness_lab/pi_probe.py`：调用实际已安装的 Pi，以本机脚本化 SSE 响应完成正常写文件及无效工具参数两种控制；可继续将产物交给独立容器验收。

`harness_lab/`、校准样例和测试不在 `scripts/package.py` 的上传允许列表中。旧 `main.py` 仍是原始 Agent 入口；内部自测判定本轮没有冒充独立验收。官方模型对照和新的比赛提交尚未运行。

## 独立验收协议

候选源码和可信验收目录必须互不包含。执行前分别生成受限源码快照，拒绝符号链接、硬链接及特殊文件；忽略 Git、虚拟环境、node_modules、trace、明显的 .env 配置。已有依赖应放在本地镜像中，评估过程不下载依赖。生产者须先停止写入；评分绑定实际快照，而不是可能继续变化的原目录。

可信目录含 `contract.json`。完整例子在 `examples/external-verifier/suite/`：

```json
{
  "schema_version": 1,
  "requirements_file": "requirements.txt",
  "requirements_sha256": "<original file sha256>",
  "provenance": "原始需求与人工维护的验收来源",
  "cases": ["case-a", "case-b"],
  "candidate_argv": ["node", "server.cjs"],
  "verifier_argv": ["python3", "/suite/check.py"],
  "port": 3000
}
```

要求提供实际原始需求文件，运行时重新计算哈希，不只接受写在 JSON 里的声明。原始 YAML 或其他文本文件也可以使用。检查脚本由操作者维护/校准，不从候选工作区自动寻找或加载模型自测。

检查程序输出一个 JSON 对象：

```json
{"schema_version":1,"cases":[{"id":"case-a","status":"passed"},{"id":"case-b","status":"failed","detail":"observed state differs"}]}
```

每个约定 ID 必须且只能出现一次。空输出、空 case 集合、缺失/重复/未知 ID、未知状态均不能通过。`failed` 是行为失败，`error` 是执行/测量错误，`skipped` 导致 `incomplete`；即使 JSON 全部为 passed，进程非零退出也按 error 处理。只覆盖已声明的场景，不推断未声明需求已完成。

两个容器使用固定的本地镜像 ID、非 root 用户、只读根文件系统、无附加权限及资源上限。候选容器仅看到只读源码挂载，并在一次性 tmpfs 目录运行；验收容器仅看到只读检查挂载。它们不共享 PID 或文件系统。候选网络为 none，验收仅加入其网络命名空间来访问应用；无宿主端口、外部网络、Docker socket 或宿主密钥。成功结果前读取 Docker inspect，核对实际网络、用户和挂载分离，并把筛选后的证据写入报告。

报告包含候选/验收文件清单与哈希、原始需求哈希、镜像 ID、控制器源码哈希、资源限制、case 结果和清理错误。超时也清理本轮命名的容器；清理失败明确报告，不能伪装成功。执行期限之外每个容器最多另有十秒清理期限。

**不可夸大的边界：** 固定验收代码也可能错误，必须用正确/错误产物双向校准。容器隔离不证明测试准确性。当前随附校准是 HTTP 与隔离检查，不是 Ticket GUI、视觉质量、持久化或权限覆盖。任意其他可信框架可以通过 `verifier_argv` 接入，但须在镜像里实际具备该运行时/浏览器并输出上述报告；缺浏览器是 error，绝不降级称通过。本轮未补齐竞赛等价的 GUI 镜像和权威场景集。

## 运行示例

在已安装本项目 Python 依赖且有本地 Docker 镜像的环境中：

```sh
python -m harness_lab.evaluate \
  --candidate examples/external-verifier/candidate \
  --suite examples/external-verifier/suite \
  --image hermes-agent:latest \
  --output runs/local-evaluation-001.json
```

镜像必须预先存在，标签会一次性解析成精确 ID，不会自动拉取。示例镜像是本机已有的 Node/Python 镜像，不代表官方评测镜像。结果文件使用独占创建，避免覆盖已有实验。

真实 Pi + 脚本化网关的端到端接线检查：

```sh
python -m harness_lab.pi_probe --image hermes-agent:latest
python -m harness_lab.pi_probe --invalid-arguments
```

本轮实际检测并使用的版本是 **Pi 0.83.0 / 本机 Node 22.22.0**；此前研究中的 0.85.1 未安装也未宣称测试过。默认要求精确版本相符，不静默更新或换 provider。配置在独立临时 HOME 中，API key 仅由显式环境字段提供，不落盘或进入命令行；测试用的是无价值的合成 key。

合成网关只返回固定、已审查的工具参数：写入微型服务器，或者故意提供残缺参数。它没有推理能力，不测试模型质量。终结的 assistant 事件才计 usage，流式增量和 agent_end 副本不重复计数。合成回包的 240 token 是协议测试数据，不是实际模型消费；账单字段保持 unknown。

`prepare_pi` 只准备命令，不擅自启动真实请求；网关仅接受主办方 HTTPS 地址或数字回环地址。真实模型工具执行仍需要完整 OS 沙箱、用量/预算控制、图片交接及预注册实验。离线 probe 在宿主临时目录执行的是固定安全动作，不是允许真实模型直接操作宿主。Pi 本身不提供这种沙箱，不能把配置隔离当作权限隔离。

## 验证与后续门槛

```sh
HARNESS_TEST_IMAGE=hermes-agent:latest python -m unittest discover -s tests -v
```

现有四项真实浏览器回归需设置 `FACTORY_TEST_PLAYWRIGHT_MODULE` 和 `FACTORY_TEST_CHROMIUM_EXECUTABLE`，具体值指向本机已有安装，不下载浏览器。未设置时按 skip 报告，不能称全部执行。

保存的验证证据位于 `docs/evidence/2026-09-12-verified-harness-core.json`。测试分别覆盖：截断后真实 HTTP 修复；外置验收的正反控制、空评分器、需求字节变化、超时/清理；Pi 凭据配置和 usage 去重；实际 Pi 正常与无效工具调用。

下一门槛是：用原样公开 GUI 测试/可信场景校准新外壳，落实真实 Pi 执行的沙箱和预算，再执行冻结 VOLO 与 Pi 的同模型配对。不能以本轮接线通过声称 Pi 更好、竞赛恢复或分数提升；旧内部验收的已知局限仍保留在审计记录里。

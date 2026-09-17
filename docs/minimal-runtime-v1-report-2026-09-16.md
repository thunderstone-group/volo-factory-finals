# 极简版：隔离运行反馈与配对实验

日期：2026-09-16。工作区分支 `feat/minimal-feedback-v1-20260916`，基线 `b07f6f4`。
当前实现已完成真实容器验收及一次真实模型修复冒烟。用户随后要求改为 Lite 批量观察，
旧配对批次停在 8 份完成记录和 1 份中断；Lite 六份批量实验已完成，
最新结果见 `minimal-lite-batch-report-2026-09-16.md`，范围见 `minimal-lite-batch-plan-2026-09-16.md`。

## 实现与验证

- 保留原语法入口及 working / retained 循环，新增显式 runtime 模式和真实模型修复选项。
- 新增 `oneshot/minimal_runtime.py` 与只读 `runtime_probe.cjs`，验证固定公开交付契约。
  可编辑源文件与检查 ID 分离，manifest/构建源码可修；不开放任意新增、删除或测试修改。
- 所有实际应用执行均在低权限、无外网、无宿主端口、只读根目录、资源受限容器内。
  `/input` 为只读干净快照，构建写入新 tmpfs；旧 dist 不传入。可信探针和应用 UID 分离，
  镜像自带 ARC 语料在应用容器被遮蔽。清理按每次随机名称及所有权标签核对，不碰其他资源。
- 后端启动依据真实退出状态；健康依据真实 HTTP 状态与 JSON 对象；首页依据 HTML 类型、
  非空响应和新构建 index.html 的字节哈希。应用输出的 passed/JSON 不作为权威结果。
- `scripts/evaluate_minimal.py` 只做冻结产物的独立评分，与修复过程分离。评测容器仅加入
  应用的 network-none 网络命名空间；其测试挂载和文件系统不对应用容器开放。

最终指定测试包含原 68 项范围和 14 项新增测试：**82 项通过，0 失败/错误/跳过，19.771 秒**。
其中 **10 项真实容器测试**，4 项协议/传输测试（传输响应为合成）与原 68 项分别可定位。

真实容器覆盖：正确应用不修复；语法正确但启动异常；构建失败后暴露健康错误、两轮累积；
manifest 引入依赖属于产品错误；旧 dist/假成功输出不能蒙混通过；错误健康 JSON；源码被
应用改写时拒绝；修复退步保留 A0；超量输出成为 unknown 且不修；凭据、验证器和网络隔离。
跨轮源码/新诊断、已保护项复验、原始输入不变继续受到原测试覆盖。

另对保留的 Smoke counter 初始应用完成不改源码的真实构建/健康回放：pass，cleanup=true。
独立容器评分基础探针同一应用 1/1；此项不是新的模型生成样本。

## 环境与版本

Docker Desktop 4.67.0 的 CLI/LaunchServices 启动报 `unmarshaling start request: unexpected EOF`。
用户手动打开后恢复，Engine 29.3.1 可用。本轮没有安装软件、修改权限或切换全局 context。
该报错与 [Docker 上游记录](https://github.com/docker/desktop-feedback/issues/444) 相似，
版本不同，不能由此认定完全相同根因；不宣称已修复 Docker 本身。

使用本机已存在的 `arc-reproduction` 镜像，来源为此前主办方公开仓库的本地构建记录
（canonical `docs/arc-bench-corpus-2026-09-14.md`）。运行时只使用不可变 ID：

`sha256:57acabb2b05fc9abd27e596264dab52647b3fafe1bf966bd25c817e9646afca2`

实际 Node v22.17.0、npm 10.9.2、arm64。独立评分使用该镜像已有的 Playwright 1.61.1 和
Chromium 1228，1 worker、10 秒 test/expect、0 retries、trace/video/screenshot off。
这是本地 Linux 容器评测，不是官方托管成绩；版本也不同于此前 macOS Playwright 1.57.0
回放，因此只能直接比较本批 A/B，不能把跨环境历史成绩当严格对照。

安全配置依据 [Docker run](https://docs.docker.com/engine/containers/run/) 与
[none 网络](https://docs.docker.com/engine/network/drivers/none/)。所有应用命令均不含安装步骤。

## 真实修复冒烟（不计入质量样本）

明确标记的合成输入语法正确，但后端立即抛异常。真实运行检查报 start/product_fail；
使用现有 deepseek-v4-flash 网关一次真实修复后，构建、启动、健康、首页、完整性均通过，
原始输入和清理条件成立。1 次请求，1,479 prompt + 29,410 completion tokens。
余额 63.541969 到 63.272842，实际观测减少 **CNY 0.269127**，待结算为 0。

这是接口与反馈流程的实测，不是某个竞赛任务被模型修好的分数证明。

## 配对实验协议（已冻结）

任务：Evolution counter（2）、Evolution dice（2）、Ticket（10）、Lite Keep（32），每项
3 次独立首次生成。首次生成使用默认 ZIP `8e59406c…`，默认提示与模型配置未改。
Evolution 使用固定的历史 Smoke 应用模板作为共同输入；每次升级是独立模型请求。
首次生成最多 3 个内部请求，修复最多 2 个请求，修复不自动重试/续写；生成超时 1500 秒。

真实运行失败才触发修复。业务反馈不进入修复包，A/B 都固定后才独立评分。源文件完全相同
则共用评分并显式记录。失败、生成失败、超时、未知和退步都保留，不事后挑选样本。

四项需求与评测文件均重新从平台读取并保存哈希。最初一次需求读取返回 Internal Server Error，后续读取
成功；Keep 等输入直接使用平台 requirements_yaml，未由离线测试补写或改动。

本段原配对协议已被用户的 Lite 批量观察要求取代，原始证据保留。若所有运行检查通过而业务仍失败、没有触发修复，这也是
反馈覆盖的有效结果，不增加轮数或临时引入业务断言。

## 证据与不变边界

本轮证据：`runs/minimal-runtime-v1/20260916/`。

- `before/`、`before-hashes.json`：接手前原型备份。
- `base-regressions.log`、`runtime-tests.log`、`final-regressions.log`：68/12/82 项阶段验证。
- `retained-application-replay.json`、`evaluator-smoke/result.json`：保留应用的运行与评分探针。
- `live-repair-smoke.json`、`live-repair-smoke-cost.json`：真实修复输入、每轮消息、源码哈希、
  新错误、使用量、费用；合成输入与输出单独保留。
- `paired/campaign.json`：冻结的代码/需求/模板/评测哈希与运行边界。
- `paired/samples/*/`：A0、B、每阶段日志/报告/余额、独立评分与每份最终记录。

旧语法阶段与旧完整 suite 的失败记录未覆盖；未通过扩大权限重跑冻结旧 harness 的测试。
默认生成器、提示词、打包白名单和默认 ZIP 未改变。没有上传、正式提测、push 或合并。

# V3 运行能力预检与低推理入口接续（2026-09-17）

通过 wanctl 在 zyldeMacBook-Pro 的既有工作树继续；分支仍为
`feat/minimal-feedback-v1-20260916`。main 为 b07f6f4，本轮没有切换主工作区、
提交、push、合并、上传或启动平台运行。既有未提交实验和历史证据保留。

## 实际发现

此前 V3 先执行普通 V2 生成与付费规划，再发现 NativeObserver 不可用；
也未套用上一轮平台低推理包的 `effort_entry.low_effort_generation`。
该组合可能既退回旧生成控制，又在无法观察时消费无用的规划请求。

本机已有不可变镜像
`sha256:57acabb2b05fc9abd27e596264dab52647b3fafe1bf966bd25c817e9646afca2`
的只读检查确认：有 `/usr/bin/node`、`/opt/arc/node_modules/@playwright/test/cli.js`
和 `/ms-playwright`，没有 bwrap。相同受限容器内仅运行可信 `/bin/true` 的
user/mount/network/PID namespace 能力检查返回 `Operation not permitted`，exit 1。
设置为 network=none、read-only、cap-drop ALL、no-new-privileges、2 GiB、1 CPU、96 PIDs。
没有提权或放宽隔离后重试。这里是本地复现条件，不是官方宿主权限的完整证明。

## 已修改的实验入口

- `oneshot/v3/observer.py` 新增最多 35 秒的可信运行预检：只交付空应用目录和
  固定驱动，检查隔离及浏览器；不传需求、生成代码、API key 或官方测试。
  仅接受严格结构且包含 JSON boolean 的 ready 回执；超时、缺失、伪造回执、
  清理失败一律不算可用。
- `oneshot/v3/launch.py` / `runner.cjs` 新增固定 preflight 模式；该模式在复制
  应用、执行 build、启动服务器或业务测试之前返回。没有安装工具或权限回退。
- `oneshot/v3/entry.py` 在任何模型调用之前执行预检。预检失败时明确非零退出，
  生成/规划/观察/修复全部标 skipped；不再静默当作正常的生成版 V3。
  预检成功后复用已存在的低推理控制；V2 提示、基础模块、32768 token预算和重试上限未改。
  新增逐阶段状态和规划/修复调用数。生成后出现环境错误时仍保留 A0，不接受未复验修复。
- `scripts/package_minimal_v3.py` 的显式白名单加入既有 effort_entry.py。
  共享生成器、业务协调器、三技能、默认包和旧包没有被本轮写入修改。

这只是候选硬化，不是运行能力缺口已经解决。在已知没有安全运行能力的环境中，
当前 V3 会在生成前失败，**不得作为已可上线的优化包提交**。

## 已执行验证

修改前指定 33 项通过。第一次修改后，同一33项有1项合成解包测试失败：
sitecustomize 只替换导入模块，没有替换 `-m` 工作进程重新导入的预检函数。
修正的是测试专用注入边界，生产代码没有添加跳过安全预检的参数。
随后33项通过；加入9项负面/边界验证后42项通过。

最终增加实际 runner.cjs 在 Node VM 中的可信驱动验证，并连同技能与业务反馈运行：
**91项，0失败、0错误、0跳过**。模型/观察正面回执为明确标注的合成fixture，
不能据此推断真实模型质量或真实浏览器隔离已经工作。

覆盖包括：缺运行能力零模型调用、环境变量不传入运行子进程、空快照和固定驱动、
超时与伪造回执拒绝、残留证据不误清理、失败阶段标记、低推理请求真实接线、
两轮/六次修复预算、实际解包入口在无 key 的 Mac 环境拒绝运行且保留 .arc 元数据。
所有修改的 Python 源码完成 compile 检查；runner.cjs 完成 node --check。

## 未执行的后续及安全阻塞

后续“冻结新包 + 重建一致性/来源核对 + 扩大 one-shot 回归”的合并工具请求
被 OpenAI 工具安全检查阻止，提示无法确定请求安全状态；该请求没有执行。
之后只读目录确认，证据目录没有新候选ZIP、extracted目录或宽范围回归日志。
没有通过重试、更换通道或放宽权限来完成被阻止的操作。
原始 LocalHTTPTests 中此前被拒绝的 socket 集成也没有重跑。

因此没有保留下来供提交的新包/新包哈希，没有完整 one-shot 或 legacy 全仓绿色结论，
没有修改后入口在 Linux 镜像的真实解包验收；预检 ready 的真实原生正面路径仍未验证。
本轮无真实模型调用，无新业务得分或平台成绩。历史31.6%/5名只是上轮记录，本轮未刷新榜单。
最终保护文件摘要核对也在被阻止请求中，未完成；只能陈述本轮没有对这些文件发起写入。

## 证据与继续边界

证据目录：`runs/minimal-v3-preflight/wanctl-20260917T071346Z`。
`before/` 保存本轮修改前9份文件；`before-manifest.json` 保存修改前摘要；
`baseline-results.json` 记录本轮工具返回的初始检查结果，非独立重跑；
`selected-after-integration.log`、`targeted-preflight-tests.log`、
`targeted-expanded-tests.log` 保存已完成回归。

下一步仍是证明受支持官方执行条件下的实际观察能力，或在现有权限边界内完成适配；
不是再抽样生成或直接上传目前会提前失败的 V3。取得真实能力证明后，才谈需求驱动
登录/创建/编辑/导航观察和同包平台成对测试。不要把本次91项单测当作业务通过率。

# 报主办方：运行器 1 核 CPU 配额造成套件启动瞬间首测试超时（2026-09-14，实测版）

> 发送渠道：主办方微信群，由e0_7发链接。公开副本（secret gist，仅凭链接可见）：
> <secret gist，已发主办方> ，含本报告、英文分析、证据 JSON 和探针原始数据。证据：`early-stall-2026-09-14.md`、
> `evidence/2026-09-14-early-stall.json`、`evidence/2026-09-14-probe-07cd84033853.jsonl`。

---

主办方好，反馈一个运行器侧的问题，附我们在容器内实测的数据。

**现象**：ticket-booking 赛道近 11 次官方 run 里有 6 次，Playwright 测试阶段开头两个初始 worker 各自的第一个测试超时或渲染进程崩溃（`locator.evaluate: Test timeout`、`Target crashed`），Playwright 换替补 worker 后剩余测试全部通过，而且比干净 run 的首测试还快。同一生成物本地重放 25 次全 10/10。09-12 的三个固定应用 run（c4a7908ca693、fef7c9c91778、bef9631c8245，agent 阶段 1 秒、没起过任何浏览器）签名完全一样，所以不是选手侧的问题。

**容器内实测**（我们让应用进程在测试阶段每 0.5 s 采样 cgroup，run 07cd84033853，这次是干净的 10/10）：
- cgroup v2，`cpu.max = 100000 100000`，即应用 + 测试主进程 + 2 个 worker + 2 个 Chromium 一共只有 **1 个核**；`memory.max` 2 GiB，`/dev/shm` 64 MB；宿主 16 核 / 65 GB。
- 13 秒测试阶段里，171 个 CPU 调度周期有 147 个被节流（86%），节流累计 38.6 s、实际用量 15.4 s，相当于约 2.9 核的需求挤在 1 核上；`cpu.pressure` full avg10 从 3.6% 升到 20.1%。
- 内存峰值 714 MB，`oom_kill` 0，memory pressure 0：不是内存问题。
- 峰值时 325 个 pid、32 个 Chromium 进程，两个浏览器主进程各 185 MB RSS，worker 各 121 MB。

**判断**：即使是通过的 run，套件开头两个浏览器同时启动加首测试执行时 CPU 也已被节流 86%；宿主上有其他负载时，1 核配额下首测试就会超过 10 s 超时，渲染进程拿不到调度就表现为 hang 或 `Target crashed`。这在 10 题任务上一次就是 10～30 个百分点，正好跨 80% 门槛，正式赛一次定胜负会盖过选手差异。

**受影响 run id**（VOLO AI 账号）：a129e387e562、c4a7908ca693、fef7c9c91778、bef9631c8245、92220c94fd25、c399145c5eb1；干净对照：01b06fb30564、d855ead6df43、b6b89caa3f8c、e34e78400983、07cd84033853。

**建议**（任一即可）：把测试阶段容器的 `cpu.max` 提到至少 2 核（`--workers=4` 对应 4 核更稳）；或给运行器加 `retries: 1`；或在计分测试前跑一个不计分的预热测试。采样原始数据和分析脚本我们可以提供。

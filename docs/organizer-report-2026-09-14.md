# 报主办方：托管运行器套件启动瞬间的首测试超时/崩溃（2026-09-14）

> 发送渠道：主办方微信群，由e0_7手工粘贴。下面是可直接发送的文本；证据细节在
> `early-stall-2026-09-14.md` 与 `evidence/2026-09-14-early-stall.json`。

---

主办方好，反馈一个运行器侧的现象，我们在 ticket-booking 赛道近 10 次官方 run 里遇到 6 次，怀疑会影响所有队和正式赛的可信度。

**现象**：Playwright 测试阶段开始的头 10～17 秒内，两个初始 worker 各自的第一个测试超时或崩溃；Playwright 换替补 worker 后，剩余测试全部通过，而且比正常 run 的首个测试还快（241～980 ms 对 1.7～3.1 s）。应用本身没问题：同一个生成物本地重放 25 次全 10/10。

**签名**（从 run 的 playwright-report.json 读出）：
- `locator.evaluate: Test timeout of 10000ms exceeded`，紧接在同一 locator 刚 `toBeVisible` 通过之后，call log 停在 `waiting for getByLabel(...)`；
- 登录测试在 1.2 s 内 `expect(locator).toBeVisible() failed / element(s) not found`（页面在 expect 轮询中死掉，Playwright 把异常吞成了最后一次轮询结果），下一个替补 worker 随即 `locator.click: Target crashed`；
- 失败结果无 trace/video 附件，容器日志采集为 0 字节，所以我们看不到 cgroup 内存/CPU 情况。

**它不是选手侧的问题**：09-12 的三个 run（c4a7908ca693、fef7c9c91778、bef9631c8245）agent 阶段只有一次 25 token 调用写了个固定应用，没有启动过任何浏览器，也没有额外进程，签名完全一样。

**受影响的 run id**（VOLO AI 账号）：a129e387e562（9/10，09-12）、c4a7908ca693（7/10）、fef7c9c91778（9/10）、bef9631c8245（9/10）、92220c94fd25（7/10，09-14）、c399145c5eb1（8/10，09-14）。干净对照：01b06fb30564、d855ead6df43、b6b89caa3f8c、e34e78400983（均 10/10，09-14 上午）。

**影响**：10 题任务上一次抖动就是 10～30 个百分点，正好跨在 80% 的 senior 门槛上；正式赛一次定胜负的话，这个随机性会盖过选手差异。

**建议**（任选其一即可消除）：给运行器加 `retries: 1`；或在正式测试前跑一个不计分的预热测试让两个浏览器先起来；或把每个 worker 首个测试的超时放宽。如需我们提供报告原文或本地重放数据，随时说。

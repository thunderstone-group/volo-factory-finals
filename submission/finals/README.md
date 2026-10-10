# 决赛提交 · Finals submission

ARC-Bench 智能体软件工厂黑客松决赛（平台竞赛 `hackathon-evolution`：在初赛产物上按新需求继续进化，2 题共 60 条隐藏测试）。组委会 2026-10-10 公布排名：**第 2 / 20**。

| 项 | 值 |
|---|---|
| 正式提交 | `218428c590f0`（`volo-finals-conv6-74247ff9-r1`，凭证模式 `official_evaluation`） |
| 包 | [`package/conv6-c2b48ef.zip`](package/conv6-c2b48ef.zip)，SHA-256 `74247ff9ed35b045ce220de776e3b799ee432966d414a2e9bb02d329f9447084` |
| 包源码 | 解压在 [`package/source/`](package/source/)；对应 git 提交见标签 `finals-submission` |
| 模型 | `deepseek-v4-flash-vision-exp`（平台网关） |
| GitHub 题最好运行 | `587401a01ed4`：28/30，1.407125 元 |
| Sheet 题最好运行 | `f3b82d5d29ba`：30/30，1.155562 元 |
| 截止后榜单（2026-10-08 20:02 快照） | 58/60，费用 2.562687 元，S 120.49，第 2（第 1 名 60/60、2.676585 元、S 124.53） |

平台规则是同一提交每题取最好运行，所以截止前同一个包在两题上反复重跑。按完成先后，GitHub 题 6 次完成的运行为 25、28、28、26、25、27，Sheet 题 7 次为 25、27、29、30、30、30、27；另有 GitHub 运行 `8a4b4a08b475` 在截止时仍在跑，被平台停掉。逐次读数见 `campaign/evidence/2026-10-06-finals/codex-resume-20261008/deadline-check-2002.json`。

## 目录

- `package/`：平台上传的竞赛包原件和解压源码。包由 `scripts/package_oneshot.py` 从 `oneshot/` 构建，构建是确定性的：在标签 `finals-submission` 上运行 `python3 scripts/package_oneshot.py`，得到的 `oneshot/dist/oneshot.zip` 与原件 SHA-256 相同（公开前已验证）。
- `apps/github/`、`apps/sheet/`：上面两次最好运行生成的应用（平台下载的运行 bundle 里的 `frontend/` 和 `backend/`）。起点是初赛最好产物（GitHub 运行 `afc04ffe5b63` 79/100、Sheet 运行 `defb678bf0a1` 87/100），决赛在其上增量修改。主办方的需求文件和运行器元数据（bundle 里的 `requirements/`、`.arc/`）未收录。

## 运行应用

两份应用结构相同：后端是没有第三方依赖的单文件 Node 服务，同时托管 `frontend/dist` 下的静态前端。

```bash
cd apps/github/backend    # 或 apps/sheet/backend
node server.js            # 端口取 PORT，默认 3000；健康检查 GET /api/health
```

## 证据

- 决赛全过程：[`docs/reference/finals-roadmap.md`](../../docs/reference/finals-roadmap.md)、[`docs/progress.md`](../../docs/progress.md) 决赛各节
- 截止前后的运行、榜单和监督日志：[`campaign/evidence/2026-10-06-finals/`](../../campaign/evidence/2026-10-06-finals/)

# Platform CLI

Last reviewed: 2026-10-03. The hackathon's latest-submission/best-run announcement supersedes the earlier board rule.

This harness no longer carries a copy of the ArcBench website client. The client
lives in its own repository, [thunderstone-group/arcbench-cli](https://github.com/thunderstone-group/arcbench-cli),
and is installed as the `arcbench` command. Nothing in `main.py` or `volo/` depends
on it: it is an operations tool for uploading this harness and reading back results.

Its README is the reference for commands, flags, exit codes and the API route table.
Do not copy that material back into this repository; it goes stale and then misleads.

## Install

```sh
pipx install git+https://github.com/thunderstone-group/arcbench-cli.git
```

`uv tool install git+https://github.com/thunderstone-group/arcbench-cli.git` works
the same way if pipx is not present. Then log in once, from a Chrome that is already
signed in to the site:

```sh
arcbench session
arcbench whoami
```

## Env file

The team's credentials live outside this repository, in `~/.config/arcbench/volo.env`.
Point the CLI at it and leave everyone else's `./.env` alone:

```sh
export ARCBENCH_ENV_FILE=~/.config/arcbench/volo.env
arcbench runs --limit 10
```

## Rules that bind this harness

These are properties of the platform, not of the CLI. They hold no matter how a run
is started, including from the website.

1. **Self-funded runs sharing an access key must not overlap with other traffic on
   that key.** The earlier runner measured a shared-key usage delta, so unrelated
   traffic could contaminate its score. The current `official_evaluation` mode
   uses the platform's evaluation key and sends no local practice key. Confirm
   the saved submission's credential mode before applying this distinction;
   keep formal task runs serial so stage inheritance is unambiguous.
2. **Never upload while a run from the same submission is pending.** The server keeps
   only the latest saved submission for a competition, so a new upload can strand the
   run you are waiting on. Finish or cancel first.
3. **Hackathon scoring uses the latest saved submission and its best run per task.**
   A new submission inherits no old run scores. The original GitHub route and the
   staged route compete by score; later stages start from the previous stage's
   best available application under that submission. Recheck the current rules
   before applying these hackathon rules to another competition.

## Typical sequence

```sh
.venv/bin/python scripts/package_oneshot.py     # oneshot/dist/oneshot.zip
arcbench upload oneshot/dist/oneshot.zip --competition arc-bench-lite --name volo-oneshot-vN
arcbench run SUBMISSION_ID --task arc-bench-lite--keep
arcbench wait RUN_ID --interval 20 --timeout 3600
arcbench logs RUN_ID --tail 40
```

Run evidence retained in this repository goes under `runs/` and `docs/evidence/`;
see `docs/archive/legacy-harness/experiments.md` for what each dated record means.

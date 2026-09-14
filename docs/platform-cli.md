# Platform CLI

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

1. **The official token count is a usage-meter delta** taken across a run on the
   shared access key. It cannot tell two sources apart. So two runs on one account
   must never overlap, and local gateway traffic from this harness must be paused
   while an official run is in flight. A gateway call made during a run is charged
   to that run's score.
2. **Never upload while a run from the same submission is pending.** The server keeps
   only the latest saved submission for a competition, so a new upload can strand the
   run you are waiting on. Finish or cancel first.
3. **The board shows the latest passing run**, not the best one. A later, weaker
   passing run replaces a stronger earlier one.

## Typical sequence

```sh
.venv/bin/python scripts/package.py             # dist/volo-factory.zip
arcbench upload dist/volo-factory.zip --competition ticket-booking --name volo-vN
arcbench run SUBMISSION_ID --task ticket-booking--ticket-booking
arcbench wait RUN_ID --interval 20 --timeout 3600
arcbench logs RUN_ID --tail 40
```

Run evidence retained in this repository goes under `runs/` and `docs/evidence/`;
see `docs/experiments.md` for what each dated record means.

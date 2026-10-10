#!/usr/bin/env python3
"""Record the actual platform standings before and after the finals deadline."""
import time
from datetime import datetime
from resume_github import TZ, SUB, cli, record, snapshot

for hour, minute in [(19, 50), (20, 2)]:
    due = datetime(2026, 10, 8, hour, minute, tzinfo=TZ)
    while datetime.now(TZ) < due:
        time.sleep(max(0, min(30, (due - datetime.now(TZ)).total_seconds())))
    for attempt in range(3):
        try:
            value = {"observed_at": datetime.now(TZ).isoformat(),
                     "leaderboard": cli("leaderboard", "--competition", "hackathon-evolution", "--limit", "25"),
                     "runs": cli("runs", "--submission", SUB, "--limit", "100"),
                     "registration": cli("registration", "hackathon-evolution")}
            snapshot(f"deadline-check-{hour:02}{minute:02}", value)
            record("deadline_standings_saved", scheduled_at=due.isoformat())
            break
        except Exception as exc:
            record("deadline_read_failed", attempt=attempt + 1, error_type=type(exc).__name__)
            time.sleep(30)

#!/bin/sh
# Stop starting new finals runs before the 10-08 18:00 deadline: GitHub after 18:40, Sheet after 19:10 (deadline moved to 20:00) (Beijing time).
D=$(cd "$(dirname "$0")" && pwd)
until [ "$(date '+%m%d%H%M')" -ge 10081840 ]; do sleep 60; done; touch $D/STOP-github; echo "$(date '+%m-%d %H:%M') STOP-github" >> $D/deadline_guard.log
until [ "$(date '+%m%d%H%M')" -ge 10081910 ]; do sleep 60; done; touch $D/STOP-sheet; echo "$(date '+%m-%d %H:%M') STOP-sheet" >> $D/deadline_guard.log

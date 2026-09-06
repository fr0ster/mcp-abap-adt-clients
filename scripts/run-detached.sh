#!/usr/bin/env bash
# Run a long test command detached from whoever started it.
#
# **Why this exists.** An LLM CLI supervises the processes its tool calls start
# and will stop them when it decides the machine is short of memory — which it
# judges from the whole machine, not from this run. Three full runs were killed
# that way in one session while jest was holding 338 MB and 11 GB were free, and
# the kernel log had no OOM entry at all.
#
# `nohup` plus `&` reparents the run to init, so it finishes on its own and the
# supervisor has nothing to stop. The output goes to a file rather than a pipe,
# because there is no terminal left to write to.
#
#   npm run test:detached                 # the whole suite
#   npm run test:detached -- integration/core/class
#
# Then read the log; it is the only place the output goes:
#
#   tail -f test-run.log
set -u
LOG="${DETACHED_LOG:-test-run.log}"
CMD=(npx jest --runInBand "$@")

nohup "${CMD[@]}" > "$LOG" 2>&1 &
PID=$!
disown 2>/dev/null || true

sleep 2
if kill -0 "$PID" 2>/dev/null; then
  echo "started, pid $PID — output in $LOG"
  echo "  tail -f $LOG"
  echo "  kill $PID   # to stop it"
else
  echo "it exited already; the reason is in $LOG:"
  tail -5 "$LOG"
  exit 1
fi

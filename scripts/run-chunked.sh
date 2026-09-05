#!/usr/bin/env bash
# The suite in pieces, because the whole of it will not fit.
#
# `npm test` runs 173 suites in one jest process and the machine has been
# killing it for memory twice over — nothing to do with the tests. Each chunk
# here is its own jest, so the memory goes back between them, and the verdicts
# add up to the same gate.
set -u
LOG=chunked-run.log
: > "$LOG"

CORE=(src/__tests__/integration/core/*/)
CHUNKS=()
n=${#CORE[@]}
q=$(( (n + 3) / 4 ))
for ((i = 0; i < n; i += q)); do
  CHUNKS+=("$(printf '%s ' "${CORE[@]:i:q}")")
done
CHUNKS+=("src/__tests__/integration/shared src/__tests__/integration/readonly")
CHUNKS+=("src/__tests__/integration/clients src/__tests__/integration/connection src/__tests__/integration/executors src/__tests__/integration/runtime")
CHUNKS+=("src/__tests__/unit")

pass=0; fail=0
for chunk in "${CHUNKS[@]}"; do
  echo "=================== chunk: $(echo "$chunk" | tr ' ' '\n' | sed 's#src/__tests__/##' | tr '\n' ' ')" | tee -a "$LOG"
  # shellcheck disable=SC2086
  npx jest --runInBand $chunk >> "$LOG" 2>&1
  code=$?
  line=$(grep -E "^Tests: " "$LOG" | tail -1)
  echo "  -> exit $code   $line" | tee -a "$LOG"
  if [ "$code" -eq 0 ]; then pass=$((pass + 1)); else fail=$((fail + 1)); fi
done

echo "=================== chunks: $pass ok, $fail failed" | tee -a "$LOG"
exit "$fail"

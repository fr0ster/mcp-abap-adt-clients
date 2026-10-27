#!/usr/bin/env bash
# The suite, with the jest process's own footprint sampled beside it.
#
# Three runs were killed by the OOM killer while the machine was carrying 21 GB
# of unrelated work, which says nothing about whether this suite grows. This
# answers that: RSS every ten seconds against the count of finished files, so a
# leak shows as a line that climbs and never comes back down.
set -u
cd /home/okyslytsia/prj/mcp-abap-adt-clients
: > mem-samples.txt
npm test > test-run.log 2>&1 &
RUNNER=$!
start=$(date +%s)
while kill -0 $RUNNER 2>/dev/null; do
  # the biggest jest-ish process is the one doing the work; npm's wrapper is not
  line=$(ps -eo pid,rss,args --no-headers | grep "node .*jest" | grep -v grep |
    sort -k2 -rn | head -1)
  rss=$(echo "$line" | awk '{print $2}')
  if [ -n "$rss" ]; then
    files=$(grep -cE "^(PASS|FAIL)" test-run.log 2>/dev/null)
    echo "$(( $(date +%s) - start )) $rss $files" >> mem-samples.txt
  fi
  sleep 10
done
wait $RUNNER
echo "exit=$?" >> mem-samples.txt

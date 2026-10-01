#!/usr/bin/env bash
# Create a batch of arena.ai accounts, one at a time, with a pause between
# them. Spacing requests out keeps you well clear of arena.ai's rate limits.
#
# Usage:
#   ./examples/run_batch.sh [count] [delay_seconds] [model]
#
# Example:
#   ./examples/run_batch.sh 3 45 deepseek-v4.1-flash-max

set -euo pipefail

COUNT="${1:-3}"
DELAY="${2:-45}"
MODEL="${3:-deepseek-v4.1-flash-max}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="outputs/batch-${STAMP}.json"

cd "$(dirname "$0")/.."

echo "creating ${COUNT} account(s), ${DELAY}s apart, model=${MODEL}"
echo "output -> ${OUT}"

for i in $(seq 1 "$COUNT"); do
  echo
  echo "=== account ${i}/${COUNT} ==="
  node src/index.mjs create -n 1 -o "${OUT}" -m "${MODEL}" || echo "account ${i} failed, continuing"

  if [ "$i" -lt "$COUNT" ]; then
    echo "waiting ${DELAY}s before the next account"
    sleep "$DELAY"
  fi
done

echo
echo "done. results in ${OUT}"

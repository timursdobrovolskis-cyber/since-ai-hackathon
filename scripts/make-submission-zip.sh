#!/usr/bin/env bash
# Builds submission.zip from committed files only, so .env, node_modules and data stay out.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
  echo "Warning: uncommitted changes are NOT in the zip:"
  git status --short
fi

git archive --format=zip --output=submission.zip HEAD

limit=$((100 * 1024 * 1024))
size=$(wc -c < submission.zip | tr -d ' ')
echo "submission.zip: $((size / 1024 / 1024)) MB ($size bytes)"
if [ "$size" -gt "$limit" ]; then
  echo "Too big: the limit is 100 MB." >&2
  exit 1
fi

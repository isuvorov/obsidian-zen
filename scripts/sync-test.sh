#!/usr/bin/env bash
# Roll out the local obsidian-zen profile into every vault listed below.
# Paths resolve relative to this script, so it works from any working directory.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$REPO_ROOT/sync/cli.js"

VAULTS=(
  "$REPO_ROOT/test-obsidian-vault"
)

for vault in "${VAULTS[@]}"; do
  echo "==> sync $vault"
  node "$CLI" sync "$vault" --from "$REPO_ROOT" "$@"
done

#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_REPO="${WORKSPACE_REPO:-/Users/gotoushunki/keiba4/workspace_jrdb}"
WORKSPACE_PAYLOAD_DIR="${WORKSPACE_PAYLOAD_DIR:-}"
DEPLOY_REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$WORKSPACE_REPO"
if [[ -n "$WORKSPACE_PAYLOAD_DIR" ]]; then
  ./build_static_site_bundle.sh "$WORKSPACE_PAYLOAD_DIR"
else
  ./build_static_site_bundle.sh
fi

mkdir -p "$DEPLOY_REPO_ROOT/public"
rsync -a --delete "$WORKSPACE_REPO/site_dist/" "$DEPLOY_REPO_ROOT/public/"

echo "Synced static site into $DEPLOY_REPO_ROOT/public"

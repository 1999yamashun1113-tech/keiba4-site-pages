#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_REPO="${WORKSPACE_REPO:-/Users/gotoushunki/keiba4/workspace_jrdb}"
DEPLOY_REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$WORKSPACE_REPO"
./build_static_site_bundle.sh

mkdir -p "$DEPLOY_REPO_ROOT/public"
rsync -a --delete "$WORKSPACE_REPO/site_dist/" "$DEPLOY_REPO_ROOT/public/"

echo "Synced static site into $DEPLOY_REPO_ROOT/public"

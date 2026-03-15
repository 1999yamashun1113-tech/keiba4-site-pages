# KEIBA4 Site Pages

Lightweight Cloudflare Pages deployment repository for the KEIBA4 public site.

## Layout

- `public/`: static files served by Cloudflare Pages
- `scripts/sync_from_workspace.sh`: rebuild and sync the public bundle from the research workspace

## Cloudflare Pages settings

- Framework preset: `None`
- Build command: `exit 0`
- Build output directory: `public`

This repository is intentionally small. It does not include the full research workspace.

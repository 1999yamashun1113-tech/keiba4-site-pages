# Cloudflare Pages Quickstart

## Repository purpose

This repo is the one to connect to Cloudflare Pages.
It contains only static public site files.

## Pages settings

- Framework preset: `None`
- Production branch: `main`
- Build command: `exit 0`
- Build output directory: `public`

## Update flow

When the public payload changes locally:

```bash
cd /Users/gotoushunki/keiba4/keiba4-site-pages
./scripts/sync_from_workspace.sh
git status
```

Then commit and push the updated `public/` directory.

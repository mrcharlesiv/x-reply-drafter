#!/bin/bash
set -e
cd /Users/bots/.openclaw/workspace/x-reply-drafter

echo "=== Git toplevel ==="
git rev-parse --show-toplevel

echo "=== Adding extension source ==="
git add extension/src/ extension/public/ extension/package.json extension/tsconfig.json extension/vite.config.ts

echo "=== Adding extension dist (force) ==="
git add -f extension/dist/

echo "=== Adding backend source ==="
git add backend/src/ backend/package.json backend/tsconfig.json backend/vercel.json backend/api/

echo "=== Adding popup.html ==="
git add extension/popup.html 2>/dev/null || true

echo "=== Staged files ==="
git diff --cached --stat

echo "=== Committing ==="
git commit -m "fix: sync drafted replies + engagement to backend

handleSavePost and handleTrackEngagement were only writing to
chrome.storage.local. Added syncToBackend() to POST data to the
Vercel backend (/api/posts and /api/posts/track-engagement).

Also added extension source + dist + backend source to git tracking."

echo "=== Pushing ==="
git push origin main

echo "=== DONE ==="

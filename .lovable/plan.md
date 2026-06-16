## Cleanup Plan: Remove Lovable Metadata and Branding

### Problem
The `.meta` folder (formerly `.lovable`) contains platform metadata files that were pushed to GitHub. One file still references `__lovableEvents` in the error reporter, and the `public/favicon.ico` is likely a default platform icon.

### Changes
1. **Delete `.meta` folder** — Removes `plan.md` and `project.json` metadata entirely.
2. **Add `.meta` to `.gitignore`** — Prevents it from being re-committed if the platform recreates it.
3. **Rename `window.__lovableEvents`** → `window.__hostEvents` in `src/lib/error-reporting.ts` — Removes the last code reference to the platform name.
4. **Remove `public/favicon.ico`** — The file is a default platform icon (≈7KB) and is not referenced in any HTML `<head>`. Removing it eliminates a Lovable-branded asset.

### Verification
- Run `bun run build` after edits to confirm the app still compiles cleanly.
- Run a final `rg -i "lovable"` to confirm zero matches in the source tree.


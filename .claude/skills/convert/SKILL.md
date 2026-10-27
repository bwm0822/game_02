---
name: convert
description: Use when the user says to "convert", "run_all", regenerate generated game data (navgraph.json, textures.json), or run the full data health check (story/lang checks) for this project.
---

# Convert

## Overview

Runs `scripts/run_all.bat`, which executes every `.js` file in `scripts/` **except `minimap.js`** via `node`, then runs `lang.js` **last**. All game data (item/role/ability/story/dialog/local/fx/anim/lang json) is hand-edited — there are no xlsx tables or conversion scripts any more. What run_all does now:

| Script | Role |
|---|---|
| `navgraph.js` | Tiled maps → `navgraph.json` (NPC schedule routes); needed after editing maps |
| `textures.js` | scans `textures/` → `textures.json` (also auto-runs on `predev*`/`prebuild*`) |
| `story.js` | static check of `story.json`, writes nothing |
| `lang.js` | checks `public/assets/lang/<lang>.json`, prints `ok / new / orphan / error` counts, writes nothing |

Map thumbnails are excluded on purpose — they're a separate, slower step; use the [minimap](../minimap/SKILL.md) skill for those.

## When to Use

- User says "convert" or "run_all"
- Tiled maps or `textures/` changed and generated files need to catch up
- A full check of story/lang data is wanted

## Usage

```powershell
cmd /c "scripts\run_all.bat"
```

No stdin redirection needed — unlike `minimap.bat`, `run_all.bat` has no trailing `pause`. Report back each script's own console output; a script erroring doesn't stop the loop, so scan the full output for failures rather than trusting a clean exit code alone.

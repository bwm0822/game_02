---
name: minimap
description: Use when the user asks to regenerate, refresh, or produce map thumbnails / minimap images / overview-map tiles for this project (e.g. "重新產生縮圖", "產生 m_04x05 的縮圖", "regenerate the minimap"), or after editing a map .json in Tiled and its thumbnail looks stale.
---

# Minimap

## Overview

Regenerates the composited overview-map thumbnails from `public/assets/maps/main.world` via `scripts/minimap.js` (tmxrasterizer renders each map, sharp resizes it). Output lands in `public/assets/textures/minimap/<mapName>.png`. Full architecture and pitfalls: [docs/minimap-overview.md](../../../docs/minimap-overview.md) — read it before changing anything about how the thumbnails are produced or composed, not just to run this skill.

## When to Use

- User asks to regenerate/refresh/produce map thumbnails or "the minimap"
- A map `.json` was just edited in Tiled and its thumbnail needs to catch up
- A new map entry was added to `main.world` and needs a thumbnail

## Usage

Run through `scripts/minimap.bat` (wraps `node scripts/minimap.js`; locates `tmxrasterizer.exe`, falls back to PATH).

**Always redirect stdin from `NUL`** — the batch file ends with `pause`, which hangs a non-interactive tool call otherwise:

```powershell
cmd /c "scripts\minimap.bat < NUL"                # all maps in main.world
cmd /c "scripts\minimap.bat m/m_04x05 < NUL"      # only one map (name must match main.world's fileName minus .json, e.g. "m/m_04x05" for grid maps)
```

Report back the script's own `OK`/`FAIL` lines per map. If a requested map name isn't in `main.world`, the script prints the available names instead of failing silently.

## Notes

- `OUTPUT_SIZE` in `scripts/minimap.js` must stay equal to `MiniMap.OUTPUT_SIZE` in `src/manager/minimap.js`, or the runtime composite and the generated thumbnails fall out of scale sync — see doc §3/§4.
- Only tile layers whose name starts with `map` (case-insensitive) render into the thumbnail (`SHOW_LAYER_PREFIX`) — a map with no such layer produces a blank thumbnail, not an error.

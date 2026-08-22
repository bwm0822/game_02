---
name: convert
description: Use when the user says to "convert", "run_all", regenerate all generated game data, or rebuild everything derived from source xlsx data tables for this project.
---

# Convert

## Overview

Runs `scripts/run_all.bat`, which executes every `.js` file in `scripts/` **except `minimap.js`** in sequence via `node`: `local.js`, `ability.js`, `ab_tree.js`, `role.js`, `item.js`, `dialog.js`, `quest.js` (each script's own inputs/outputs are documented at its own top comment). Map thumbnails are excluded on purpose — they're a separate, slower step; use the [minimap](../minimap/SKILL.md) skill for those.

## When to Use

- User says "convert", "run_all", or asks to regenerate/rebuild all generated data at once
- Multiple source files (xlsx tables, maps) changed and everything derived from them needs to catch up

## Usage

```powershell
cmd /c "scripts\run_all.bat"
```

No stdin redirection needed — unlike `minimap.bat`, `run_all.bat` has no trailing `pause`. Report back each script's own console output (each script logs what it read/wrote); a script erroring doesn't stop the loop, so scan the full output for failures rather than trusting a clean exit code alone.

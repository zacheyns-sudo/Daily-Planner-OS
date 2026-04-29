# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Daily OS** — a single-page PWA academic/personal organiser. No build step, no dependencies, no package.json. Everything lives in `index.html` (CSS + HTML + JS inline), with `sw.js` for offline caching and `manifest.json` for PWA install.

To run: open `index.html` in a browser, or serve it with any static file server (e.g. `python -m http.server`). An Anthropic API key is required for the AI focus feature; enter it in the settings panel (gear icon).

## Architecture

### Single-file, no framework

All logic is in one `<script>` block at the bottom of `index.html`. There is no module system — everything is global. Functions are defined and called in source order; the boot sequence at line ~3010 calls the initial render functions directly.

### State object `S`

All app state lives in the `S` object (line ~1021). Every field has a corresponding `localStorage` key with the `org_` prefix. `persist()` writes all of `S` back to `localStorage` atomically. Mutations always go through `S` then `persist()` then a re-render call.

Key `S` fields:
- `tasks` — standalone academic deadlines (`org_tasks`)
- `projects` — array of project objects, each with `tasks[]`, `log[]`, `currentCount` (`org_projects`)
- `events` — calendar events imported from ICS or added manually (`org_events`)
- `scheduleEdits` — overrides to the hardcoded `WEEKLY` timetable, keyed by `dow` or `YYYY-MM-DD` (`org_schedule_edits`)
- `focus` / `focusDate` / `focusWindow` — cached Claude focus recommendation for the current date/window
- `completedLog` / `completedTasks` — completion history and IDs of completed task items
- `sticky` — sticky note entries
- `recaps` — evening recap history

### Hardcoded presets (constants, not config files)

- `WEEKLY` (line ~887) — the user's fixed weekly timetable (Portuguese Mon, Hyrox Wed, water polo Tue/Thu/Sat). Edits made via the schedule-edit modal are stored in `S.scheduleEdits` as overrides rather than changing `WEEKLY`.
- `EXAMS` (line ~946) — upcoming exam dates. Update here when exam dates change.
- `PROJECTS_PRESET` (line ~907) — default projects (Filthy Labs, Kaya, Proof) used only on first load if `org_projects` is absent in `localStorage`.

### Claude API calls

Two direct browser-to-API calls (no proxy):
1. **`generateFocus()`** (line ~1439) — sends `buildPrompt()` output to `claude-sonnet-4-6`, gets a JSON focus recommendation, caches it in `S.focus` until end of day or next time window.
2. **`runExtraction()`** (line ~2581) — sends pasted text, returns structured tasks as JSON.

Both use `anthropic-dangerous-direct-browser-access: true`. The focus recommendation is cached per date+window (`currentWindow()` returns `'am'`/`'pm'`/`'evening'`); passing `force=true` bypasses the cache.

### Tabs

Five tabs: `today`, `calendar`, `deadlines`, `projects`, `tasks`. `switchTab(tab)` shows/hides the matching `<div id="tab-{name}">` sections and re-renders the newly active tab.

### ICS import

`parseICS()` (line ~2112) handles `VEVENT` blocks including `RRULE` (daily/weekly/monthly recurrence) and expands them via `expandRecurrence()`. `classifyICSEvent()` (line ~2091) assigns a category (`class`, `race`, `travel`, `social`, `appointment`, `other`) from the event title. `confirmImportICS()` merges imported events into `S.events`, replacing any previously imported batch (identified by `source:'ics'`).

### Exam-day override

`examForClassEvent()` (line ~954) intercepts recurring class events that fall on an exam date and re-labels them as the exam. The `EXAMS` array is the single source of truth — update it when exam dates change.

### Data migrations

One-shot migrations run on boot before `S` is initialised:
- `migrateProjects()` — moves old `org_fl_tasks`/`org_fl_log`/`org_fl_products` keys into the unified `org_projects` format.
- `cleanSlateV1()` — one-time reset of stale task/event data at the ICS-first transition.
- `reclassifyICSv3()` — re-runs category classification on existing imported events.

### PWA / service worker

`sw.js` uses a stale-while-revalidate strategy for same-origin assets (cache name `daily-os-vN`). Bump the `CACHE` version string in `sw.js` whenever a deployment must invalidate old caches. External origins (Anthropic API, CDNs) bypass the service worker entirely.

### Settings panel

The gear icon (⚙) in the header opens a slide-down settings panel with API key entry, export-to-JSON, and import-from-JSON. `exportData()` / `importData()` / `handleImportFile()` handle the full `S` snapshot.

## Patterns to follow

- All DOM writes go through `innerHTML` assignment on section containers — no virtual DOM, no diffing. Re-render the whole section when state changes.
- Use `esc(s)` (line ~2846) for any user-supplied string inserted into `innerHTML`.
- IDs on interactive elements are stable and used directly (`document.getElementById`). Do not rename them without updating all call sites.
- `EXAMS` is hardcoded — add/change exam dates there directly rather than through the UI.

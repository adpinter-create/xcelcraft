# XcelCraft

The page for XcelCraft, Andrei Pinter's open-source Excel add-in, at https://xcelcraft.andreipinter.com/.

- **Hero**: a live spreadsheet. A demo table types itself in and a selection cursor runs four of the add-in's real tools as scenes (select cells that pass a test, color by cell type, unhide rows, blank out repeats).
- **Two families**: Utilities and Modeling, with every category and its tool count.
- **Every tool**: all menu entries with their `XC_` procedure and default shortcut. Press `/` to search; filter by family.
- **Using it**, **Inside** (the modules and their procedure counts) and **Install it**.

Plain HTML, CSS and JavaScript (`index.html`, `styles.css`, `app.js`), no framework or build step on the server. Fonts are Big Shoulders Display and Newsreader (SIL Open Font License, in `fonts/`), the same type as the homepage. The shared site header sits between `<!-- sitebar:start -->` and `<!-- sitebar:end -->` and is written by `homepage/tools/sitebar/build_sitebar.py`. Published to GitHub Pages by a GitHub Action, same setup as Hands Off the Mouse: the page redeploys whenever `main` changes.

## Setup

1. Settings → Pages → Source: **GitHub Actions**.
2. Settings → Pages → Custom domain: `xcelcraft.andreipinter.com`.
3. DNS at GoDaddy (andreipinter.com → DNS): CNAME, name `xcelcraft`, value `adpinter-create.github.io`.
4. Actions → Deploy XcelCraft page → Run workflow (or push any change).
5. When the domain verifies, tick **Enforce HTTPS**.

## Updating the catalog

Everything below the hero is drawn from the JSON inside `<script id="catalog-data">` in `index.html`. It comes from the add-in's own repository, not from this one:

```
python3 tools/build_catalog.py /path/to/XcelCraft_add-in_repo
python3 tools/build_catalog.py /path/to/XcelCraft_add-in_repo --repo https://github.com/... --download https://github.com/.../XcelCraft.xlam
```

It reads `TOOL_TRACKER.csv` (Family, Category, Tool, Procedure, Default shortcut), `src/*.bas` and `src/*.cls` (which module defines each procedure) and the version from `CHANGELOG.md`, turns Excel `OnKey` strings into readable keys (`^%+q` → Ctrl+Alt+Shift+Q), writes `tools/catalog.json`, and injects the catalog into `index.html`, including the tool count in the page description. With `--repo` and `--download` the hero shows **Read the source** and **Download the add-in**; without them it shows a greyed "coming soon".

`tools/catalog.overrides.json` picks the tools the hero acts out (`demos`: procedure → `scene` of `select`, `fill`, `hide` or `clear`, plus a caption) and can `hide` procedures from the page.

The deploy refuses to publish a page whose catalog is empty.

Preview locally with `python3 -m http.server`, then open localhost:8000.

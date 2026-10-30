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
python3 tools/build_catalog.py /path/to/XcelCraft_add-in_repo --xlam ~/Downloads/XcelCraft.xlam
```

It reads `TOOL_TRACKER.csv` (Family, Category, Tool, Procedure, Default shortcut), `src/*.bas` and `src/*.cls` (which module defines each procedure) and the version from `CHANGELOG.md`, turns Excel `OnKey` strings into readable keys (`^%+q` → Ctrl+Alt+Shift+Q), writes `tools/catalog.json`, and injects the catalog into `index.html`, including the tool count in the page description.

It also writes the downloads into `download/`, which the site serves:

- **`XcelCraft-<version>-source.zip`**, always: the add-in repo without `.git` and `.github`. The `.bas` and `.cls` files get Windows line endings (CRLF) on the way in, because the VBA editor misreads modules with Unix ones: a class can import as a standard module, and Mac Excel can refuse the file. The zip is reproducible, so an unchanged source gives an identical file.
- **`XcelCraft-<version>.xlam`**, when there is one: pass `--xlam PATH`, or leave the built add-in in the add-in repo's root, `dist/`, `release/` or `build/`. An `.xlam` has to be saved from Excel; this script can't make one.

With an `.xlam` the hero's main button is **Download the add-in** and the source is a second button; without one, **Download the source** is the main button and the install steps explain how to build the add-in from it in Excel. Older `XcelCraft-*` files in `download/` are removed. `--download URL` points the main button at a file hosted elsewhere instead, and `--repo URL` adds **Read the source** (only useful once that repo is public).

`tools/catalog.overrides.json` picks the tools the hero acts out (`demos`: procedure → `scene` of `select`, `fill`, `hide` or `clear`, plus a caption) and can `hide` procedures from the page.

The deploy refuses to publish a page whose catalog is empty.

Preview locally with `python3 -m http.server`, then open localhost:8000.

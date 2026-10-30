#!/usr/bin/env python3
"""Build the XcelCraft catalog from the add-in repository and write it into the page.

  python3 tools/build_catalog.py /path/to/XcelCraft_add-in_repo [--xlam path/to/XcelCraft.xlam] [--repo URL]

Reads TOOL_TRACKER.csv (Family, Category, Tool, Procedure, Default shortcut: the menu registry, one row
per menu entry) and src/*.bas (to know which module defines each procedure), plus the version from
CHANGELOG.md. Shortcuts are in Excel's OnKey syntax (^ Ctrl, + Shift, % Alt, {F2}) and are turned into
readable keys. A catalog.overrides.json beside this script can attach hero demos or hide entries:

  {"demos": {"XC_TypeColorSelection": {"scene": "fill", "caption": "..."}}, "hide": ["BuildMenu"]}

Downloads, written into download/ at the root of this repo and served from the site:
  * XcelCraft-<version>-source.zip, always: the add-in repo minus .git/.github, in a folder of the same
    name. .bas/.cls/.frm files get Windows line endings (CRLF), because the VBA editor misreads modules
    with Unix ones (a class can import as a standard module, or fail on a Mac). Built reproducibly, so an
    unchanged source gives a byte-identical zip.
  * XcelCraft-<version>.xlam, when one exists: --xlam PATH, or the newest *.xlam in the add-in repo's
    root, dist/, release/ or build/. It has to be saved from Excel; nothing here can build one.
Older XcelCraft-* files in download/ are removed. --download URL points the button at a file hosted
elsewhere (a GitHub release, say) instead.

Writes catalog.json beside this script and replaces the JSON inside <script id="catalog-data"> in
index.html at the root of this repo.
"""
import argparse, csv, hashlib, json, re, shutil, sys, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PAGE = HERE.parent / "index.html"
DOWNLOADS = HERE.parent / "download"
VBA_TEXT = {".bas", ".cls", ".frm"}
SKIP_DIRS = {".git", ".github", "__pycache__", "dist", "release", "build"}
SKIP_FILES = {".DS_Store", ".gitignore", ".gitattributes"}

SHIFTED = dict(zip("!@#$%^&*()", "1234567890"))
NAMED = {"LEFT": "←", "RIGHT": "→", "UP": "↑", "DOWN": "↓", "ENTER": "Enter", "RETURN": "Enter", "TAB": "Tab",
         "ESC": "Esc", "ESCAPE": "Esc", "DEL": "Del", "DELETE": "Del", "BS": "Backspace", "BACKSPACE": "Backspace",
         "HOME": "Home", "END": "End", "PGUP": "PgUp", "PGDN": "PgDn", "INSERT": "Ins", "INS": "Ins"}


def keys(onkey):
    """'^%+{F12}' -> 'Ctrl+Alt+Shift+F12'; '^#' -> 'Ctrl+Shift+3' (shifted digit on a US layout)."""
    if not onkey:
        return ""
    mods, i, out = [], 0, ""
    while i < len(onkey) and onkey[i] in "^+%":
        mods.append({"^": "Ctrl", "+": "Shift", "%": "Alt"}[onkey[i]]); i += 1
    rest = onkey[i:]
    m = re.fullmatch(r"\{(\w+)\}", rest)
    if m:
        k = m.group(1).upper()
        out = NAMED.get(k, k if re.fullmatch(r"F\d+", k) else k.title())
    elif rest in SHIFTED:
        if "Shift" not in mods:
            mods.append("Shift")
        out = SHIFTED[rest]
    else:
        out = rest.upper() if len(rest) == 1 and rest.isalpha() else rest
    order = {"Ctrl": 0, "Alt": 1, "Shift": 2}
    return "+".join(sorted(set(mods), key=order.get) + [out])


def modules_of(src):
    where = {}
    counts = []
    for f in sorted(src.glob("*.bas")) + sorted(src.glob("*.cls")):
        n = 0
        for line in f.read_text(encoding="utf-8", errors="replace").splitlines():
            m = re.match(r"\s*(Public\s+)?Sub\s+(XC_\w+|BuildMenu)\s*\(", line)
            if m:
                where[m.group(2)] = f.name; n += 1
        counts.append({"file": f.name, "tools": n})
    return where, counts


def build(root, repo=None, download=None):
    rows = list(csv.DictReader(open(root / "TOOL_TRACKER.csv", encoding="utf-8-sig")))
    where, modules = modules_of(root / "src")
    ov = {}
    p = HERE / "catalog.overrides.json"
    if p.exists():
        ov = json.loads(p.read_text(encoding="utf-8"))
    hide = set(ov.get("hide", []))
    demos = ov.get("demos", {})
    fams = {}
    for r in rows:
        proc = r["Procedure"].strip()
        if proc in hide:
            continue
        fam = fams.setdefault(r["Family"].strip(), {})
        cname = r["Category"].strip()
        if cname.startswith("Modeling: "):
            cname = cname[len("Modeling: "):]
        cat = fam.setdefault(cname, [])
        name = r["Tool"].strip()
        asks = name.endswith("...")
        name = name.rstrip(".").strip()
        t = {"name": name, "proc": proc, "module": where.get(proc, "")}
        if asks:
            t["asks"] = True
        if r.get("Default shortcut", "").strip():
            t["onkey"] = r["Default shortcut"].strip(); t["keys"] = keys(t["onkey"])
        if proc in demos:
            t["demo"] = demos[proc]
        cat.append(t)
    families = []
    for fname in ("Utilities", "Modeling"):
        if fname in fams:
            families.append({"name": fname, "categories": [{"name": c, "tools": ts} for c, ts in fams[fname].items()]})
    for fname, cats in fams.items():
        if fname not in ("Utilities", "Modeling"):
            families.append({"name": fname, "categories": [{"name": c, "tools": ts} for c, ts in cats.items()]})
    version = None
    ch = root / "CHANGELOG.md"
    if ch.exists():
        m = re.search(r"^##\s*([\w.\-]+)", ch.read_text(encoding="utf-8"), re.M)
        version = m.group(1) if m else None
    procs = {t["proc"] for f in families for c in f["categories"] for t in c["tools"]}
    shortcuts = {t["proc"] for f in families for c in f["categories"] for t in c["tools"] if t.get("keys")}
    return {"name": "XcelCraft", "version": version, "repo": repo, "download": download,
            "families": families, "modules": modules,
            "counts": {"tools": len(procs), "entries": sum(len(c["tools"]) for f in families for c in f["categories"]),
                       "categories": sum(len(f["categories"]) for f in families), "shortcuts": len(shortcuts),
                       "modules": len(modules)}}


def crlf(data):
    return data.replace(b"\r\n", b"\n").replace(b"\r", b"\n").replace(b"\n", b"\r\n")


def package_source(root, version, out=DOWNLOADS):
    """Zip the add-in source reproducibly (sorted entries, fixed timestamps, CRLF VBA modules)."""
    name = f"XcelCraft-{version}-source"
    dest = out / f"{name}.zip"
    files = []
    for f in sorted(root.rglob("*")):
        rel = f.relative_to(root)
        if f.is_dir() or f.name in SKIP_FILES or f.suffix.lower() in (".xlam", ".xlsm", ".pyc") \
                or any(part in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        files.append((rel.as_posix(), f))
    if not any(r.startswith("src/") for r, _ in files):
        sys.exit(f"no src/ folder in {root}; is this the add-in repo?")
    out.mkdir(exist_ok=True)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel, f in files:
            data = f.read_bytes()
            if f.suffix.lower() in VBA_TEXT:
                data = crlf(data)
            info = zipfile.ZipInfo(f"{name}/{rel}", date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, data)
    return dest


def find_xlam(root, given=None):
    if given:
        p = Path(given).expanduser().resolve()
        if not p.exists():
            sys.exit(f"--xlam {p} not found")
        return p
    found = [f for d in ("", "dist", "release", "build") for f in (root / d).glob("*.xlam") if f.is_file()]
    return max(found, key=lambda f: f.stat().st_mtime) if found else None


def make_downloads(root, version, xlam=None, out=DOWNLOADS):
    keep = []
    src = package_source(root, version, out)
    keep.append(src)
    x = find_xlam(root, xlam)
    if x:
        dest = out / f"XcelCraft-{version}.xlam"
        shutil.copyfile(x, dest)
        keep.append(dest)
    for old in out.glob("XcelCraft-*"):
        if old not in keep:
            old.unlink()
    items = []
    for f in sorted(keep, key=lambda f: f.suffix != ".xlam"):
        items.append({"kind": "xlam" if f.suffix == ".xlam" else "source", "href": f"download/{f.name}", "file": f.name,
                      "bytes": f.stat().st_size, "sha256": hashlib.sha256(f.read_bytes()).hexdigest()})
    return items


def inject(cat, page=PAGE):
    html = page.read_text(encoding="utf-8")
    data = json.dumps(cat, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    new, n = re.subn(r'(<script id="catalog-data" type="application/json">).*?(</script>)', lambda m: m.group(1) + data + m.group(2), html, flags=re.S)
    if n != 1:
        sys.exit(f"catalog-data script not found in {page}")
    # keep the tool count in the description and sharing text in step with the catalog
    tools = cat["counts"]["tools"]
    new = re.sub(r'(<meta (?:name|property)="(?:og:)?description" content="[^"]*?)\b\d+( tools| utilities and modeling tools)',
                 lambda m: f"{m.group(1)}{tools}{m.group(2)}", new)
    page.write_text(new, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root", help="the XcelCraft repository folder (holds TOOL_TRACKER.csv and src/)")
    ap.add_argument("--repo", help="link for the Read the source button (only if that repo is public)")
    ap.add_argument("--download", help="URL of an .xlam hosted elsewhere; overrides the local download")
    ap.add_argument("--xlam", help="a built XcelCraft .xlam to publish beside the source zip")
    ap.add_argument("--no-package", action="store_true", help="leave download/ as it is")
    ap.add_argument("--page", default=str(PAGE))
    ap.add_argument("--dry-run", action="store_true", help="print the counts, write nothing")
    a = ap.parse_args()
    root = Path(a.root).expanduser().resolve()
    cat = build(root, a.repo, a.download)
    c = cat["counts"]
    if a.dry_run:
        print(json.dumps(c, indent=1)); return
    if not a.no_package:
        cat["downloads"] = make_downloads(root, cat["version"] or "dev", a.xlam)
    elif (HERE / "catalog.json").exists():
        cat["downloads"] = json.loads((HERE / "catalog.json").read_text(encoding="utf-8")).get("downloads", [])
    (HERE / "catalog.json").write_text(json.dumps(cat, indent=1, ensure_ascii=False), encoding="utf-8")
    inject(cat, Path(a.page))
    print(f"{c['tools']} tools ({c['entries']} menu entries) in {c['categories']} categories, {c['shortcuts']} shortcuts, "
          f"{c['modules']} modules, version {cat['version']} -> {a.page}")
    for d in cat.get("downloads", []):
        print(f"  download/{d['file']}  {d['bytes']:,} bytes  sha256 {d['sha256'][:12]}…")


if __name__ == "__main__":
    main()

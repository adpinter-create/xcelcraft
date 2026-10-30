/* XcelCraft page: draws the sheet in the hero, runs the cursor through a few scenes,
   and builds the families, catalog and module list from the catalog JSON embedded in the page. */
(function () {
  "use strict";
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let CAT = {};
  try { CAT = JSON.parse($("#catalog-data").textContent) || {}; } catch (e) { CAT = {}; }
  const families = CAT.families || [];
  const allTools = [];
  families.forEach(f => (f.categories || []).forEach(c => (c.tools || []).forEach(t => allTools.push(Object.assign({ family: f.name, category: c.name, module: c.module }, t)))));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- hero sheet ---------- */
  const sheet = $("#sheet"), cells = $("#cells"), cursor = $("#cursor"), namebox = $("#namebox"), caption = $("#caption");
  const colsEl = $("#cols"), rowsEl = $("#rows");
  const css = getComputedStyle(document.documentElement);
  let CW = 0, CH = 0, NC = 0, NR = 0;
  const colName = i => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; };
  function layout() {
    const probe = document.createElement("span"); colsEl.appendChild(probe);
    CW = probe.getBoundingClientRect().width || 80; colsEl.removeChild(probe);
    CH = parseFloat(css.getPropertyValue("--cell-h")) || 30;
    const r = sheet.getBoundingClientRect();
    const g = parseFloat(getComputedStyle(colsEl).left) || 40;
    NC = Math.ceil((r.width - g) / CW) + 1; NR = Math.ceil((r.height - CH) / CH) + 1;
    CH = colsEl.getBoundingClientRect().height || CH;
    colsEl.innerHTML = Array.from({ length: NC }, (_, i) => `<span data-c="${i}">${colName(i)}</span>`).join("");
    rowsEl.innerHTML = Array.from({ length: NR }, (_, i) => `<span data-r="${i}">${i + 1}</span>`).join("");
  }
  layout();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 150); });

  const cellMap = new Map();
  function cell(c, r) {
    const k = c + ":" + r; let el = cellMap.get(k);
    if (!el) { el = document.createElement("div"); el.className = "cell"; el.style.left = (c * CW) + "px"; el.style.top = (r * CH) + "px"; cells.appendChild(el); cellMap.set(k, el); }
    return el;
  }
  function moveCursor(c1, r1, c2, r2) {
    c2 = c2 == null ? c1 : c2; r2 = r2 == null ? r1 : r2;
    cursor.style.transform = `translate(${c1 * CW}px, ${r1 * CH}px)`;
    cursor.style.width = ((c2 - c1 + 1) * CW) + "px"; cursor.style.height = ((r2 - r1 + 1) * CH) + "px";
    cursor.classList.add("show");
    const a = colName(c1) + (r1 + 1), b = colName(c2) + (r2 + 1);
    namebox.textContent = a === b ? a : a + ":" + b; namebox.classList.add("show");
    colsEl.querySelectorAll("span").forEach(s => s.classList.toggle("lit", +s.dataset.c >= c1 && +s.dataset.c <= c2));
    rowsEl.querySelectorAll("span").forEach(s => s.classList.toggle("lit", +s.dataset.r >= r1 && +s.dataset.r <= r2));
  }
  function say(title, text) {
    if (!title && !text) { caption.classList.remove("show"); return; }
    caption.innerHTML = (title ? `<b>${esc(title)}</b>` : "") + esc(text || ""); caption.classList.add("show");
  }
  const wait = ms => new Promise(r => setTimeout(r, reduced ? 0 : ms));
  const rnd = (a, b) => Math.round(a + Math.random() * (b - a));

  // A small demo table lives in the top-right of the sheet, away from the wordmark.
  const full = Math.floor((sheet.getBoundingClientRect().width - (parseFloat(getComputedStyle(colsEl).left) || 40)) / CW);
  const T = { c: Math.max(1, full - 5), r: 0, heads: ["Item", "Units", "Price", "Total"], rows: 7 };
  const money = n => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  async function typeTable() {
    const { c, r } = T;
    T.heads.forEach((h, i) => { const e = cell(c + i, r); e.textContent = h; e.className = "cell head on" + (i ? " num" : ""); });
    await wait(260);
    for (let i = 1; i <= T.rows; i++) {
      const u = rnd(3, 48), p = rnd(4, 120) + 0.99;
      const vals = ["SKU-" + (1000 + i * 7), u, money(p), money(u * p)];
      vals.forEach((v, j) => { const e = cell(c + j, r + i); e.textContent = v; e.className = "cell on" + (j ? " num" : ""); });
      moveCursor(c, r + i, c + 3, r + i);
      await wait(120);
    }
  }
  function tableCells(fn) { for (let i = 0; i <= T.rows; i++) for (let j = 0; j < 4; j++) fn(cell(T.c + j, T.r + i), i, j); }

  // Scenes: generic motions the cursor can make. A catalog tool can name one with `demo: {scene, caption}`.
  const scenes = {
    async select(t) { moveCursor(T.c, T.r, T.c + 3, T.r + T.rows); say(t && t.name, t && t.demo.caption); await wait(1700); },
    async fill(t) { moveCursor(T.c + 3, T.r + 1, T.c + 3, T.r + T.rows); say(t && t.name, t && t.demo.caption); await wait(500);
      for (let i = 1; i <= T.rows; i++) { cell(T.c + 3, T.r + i).classList.add("fill"); await wait(90); } await wait(1200);
      tableCells(e => e.classList.remove("fill")); },
    async hide(t) { moveCursor(T.c, T.r + 2, T.c + 3, T.r + 4); say(t && t.name, t && t.demo.caption); await wait(600);
      for (let i = 2; i <= 4; i++) { for (let j = 0; j < 4; j++) cell(T.c + j, T.r + i).classList.add("hid"); rowsEl.children[T.r + i].style.opacity = ".25"; }
      await wait(1100); say(t && t.name, (t && t.demo.caption2) || ""); for (let i = 2; i <= 4; i++) { for (let j = 0; j < 4; j++) cell(T.c + j, T.r + i).classList.remove("hid"); rowsEl.children[T.r + i].style.opacity = ""; }
      await wait(1100); },
    async clear(t) { // two rows become repeats of the row above them, then the tool blanks the repeats
      for (const i of [2, 5]) for (let j = 0; j < 4; j++) cell(T.c + j, T.r + i).textContent = cell(T.c + j, T.r + i - 1).textContent;
      await wait(500); moveCursor(T.c, T.r + 1, T.c + 3, T.r + T.rows); say(t && t.name, t && t.demo.caption); await wait(900);
      for (const i of [2, 5]) for (let j = 0; j < 4; j++) cell(T.c + j, T.r + i).classList.remove("on");
      await wait(1300); await typeTable(); },
    async walk(t) { const c = rnd(1, Math.max(1, T.c - 2)), r = rnd(T.r, Math.min(NR - 2, T.r + 8)); moveCursor(c, r); say(); await wait(900); }
  };
  const sceneOrder = ["select", "fill", "hide", "clear"];
  const demos = allTools.filter(t => t.demo && scenes[t.demo.scene]).filter((t, i, a) => a.findIndex(x => x.proc === t.proc) === i)
    .sort((a, b) => sceneOrder.indexOf(a.demo.scene) - sceneOrder.indexOf(b.demo.scene));
  async function run() {
    cells.innerHTML = ""; cellMap.clear();
    await wait(900); await typeTable(); await wait(600);
    const order = demos.length ? demos : [{ demo: { scene: "select" } }, { demo: { scene: "fill" } }, { demo: { scene: "hide" } }, { demo: { scene: "walk" } }];
    for (;;) {
      for (const t of order) { if (document.hidden) { await wait(1500); continue; } await scenes[t.demo.scene](t.name ? t : null); await wait(350); }
      if (reduced) break;
    }
  }
  if (!reduced) run(); else { typeTable(); moveCursor(T.c, T.r, T.c + 3, T.r + T.rows); }

  /* ---------- facts + buttons ---------- */
  const nCat = families.reduce((n, f) => n + (f.categories || []).length, 0);
  const nTools = new Set(allTools.map(t => t.proc)).size;
  const nKeys = new Set(allTools.filter(t => t.keys).map(t => t.proc)).size;
  const facts = [];
  if (nTools) facts.push(`<span><b>${nTools}</b> tools</span>`);
  if (nCat) facts.push(`<span><b>${nCat}</b> categories</span>`);
  if (nKeys) facts.push(`<span><b>${nKeys}</b> shortcuts</span>`);
  facts.push(`<span><b>MIT</b> licensed</span>`);
  $("#facts").innerHTML = facts.join("");
  const dl = CAT.downloads || [];
  const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  const local = dl.find(d => d.kind === "xlam"), src = dl.find(d => d.kind === "source");
  const xlam = CAT.download ? { href: CAT.download, file: CAT.download.split("/").pop(), ext: true } : local;
  const link = (d, label, cls) => `<a class="${cls}" href="${esc(d.href)}"${d.ext ? "" : ` download="${esc(d.file)}"`}${d.sha256 ? ` title="SHA-256 ${esc(d.sha256)}"` : ""}>${label}</a>`;
  const ctas = [];
  if (xlam) ctas.push(link(xlam, "Download the add-in", "btn"));
  if (src) ctas.push(link(src, "Download the source", xlam ? "btn quiet" : "btn"));
  if (CAT.repo) ctas.push(`<a class="btn quiet" href="${esc(CAT.repo)}">Read the source</a>`);
  if (!ctas.length) ctas.push(`<span class="btn soon">Download coming soon</span>`);
  ctas.push(`<a class="btn quiet" href="#catalog">See every tool</a>`);
  $("#ctas").innerHTML = ctas.join("");
  const ver = CAT.version ? `Version ${esc(CAT.version)}, ` : "";
  if (xlam && !xlam.ext) $("#dl-note").innerHTML = `${ver}${kb(xlam.bytes)} add-in for Excel. <a href="#install">How to install it</a>.`;
  else if (src && !xlam) $("#dl-note").innerHTML = `${ver}a ${kb(src.bytes)} zip of the VBA modules. <a href="#install">How to build the add-in</a>.`;
  if (xlam) $("#get").innerHTML = `<b>Download</b> <span>${link(xlam, esc(xlam.file), "")}${xlam.bytes ? ` (${kb(xlam.bytes)})` : ""} and keep it somewhere it won't move: Excel loads the add-in from that spot every time it starts.${src ? ` The VBA modules are in ${link(src, "the source zip", "")}.` : ""}</span>`;
  else if (src) $("#get").innerHTML = `<b>Build the add-in</b> <span>Download ${link(src, "the source", "")} (zip, ${kb(src.bytes)}) and unzip it. In a blank workbook open the VBA editor (Alt+F11, or Option+F11 on a Mac), use File, Import File for each file in <code>src/</code>, then save the workbook as an Excel Add-in (<code>.xlam</code>).</span>`;

  /* ---------- families ---------- */
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  $("#fam-grid").innerHTML = families.map(f => {
    const n = new Set((f.categories || []).flatMap(c => (c.tools || []).map(t => t.proc))).size;
    return `<div class="fam"><h3>${esc(f.name)}</h3><span class="count">${n ? n + " tools in " : ""}${(f.categories || []).length} categories</span>
      <ul>${(f.categories || []).map(c => `<li><a href="#cat-${slug(c.name)}"><span class="n">${esc(c.name)}</span><span class="c">${(c.tools || []).length || ""}</span></a></li>`).join("")}</ul></div>`;
  }).join("") || `<p class="empty">The catalog is generated from the add-in's modules; it hasn't been built yet.</p>`;

  /* ---------- catalog ---------- */
  const q = $("#q"), chips = $("#chips"), list = $("#cat-list"), empty = $("#empty");
  let filter = "", query = "";
  const cats = []; families.forEach(f => (f.categories || []).forEach(c => cats.push({ family: f.name, name: c.name, module: c.module, blurb: c.blurb, tools: c.tools || [] })));
  $("#cat-sub").textContent = nTools ? `${nTools} tools, listed the way the menu lists them (a few appear under more than one category). Each is one procedure you can run from the menu, a shortcut, or your own code.` : "";
  chips.innerHTML = [`<button class="chip" type="button" data-f="" aria-pressed="true">All</button>`]
    .concat(families.map(f => `<button class="chip" type="button" data-f="${esc(f.name)}" aria-pressed="false">${esc(f.name)}</button>`)).join("");
  chips.addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; filter = b.dataset.f;
    chips.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); render(); });
  const hl = (s, w) => { s = esc(s); if (!w) return s; const re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"); return s.replace(re, "<mark>$1</mark>"); };
  function render() {
    const w = query.trim().toLowerCase(); let n = 0;
    list.innerHTML = cats.map(c => {
      if (filter && c.family !== filter) return "";
      const tools = c.tools.filter(t => !w || (t.name + " " + (t.keys || "") + " " + (t.proc || "") + " " + c.name).toLowerCase().includes(w));
      if (!tools.length) return ""; n += tools.length;
      return `<section class="cat-group" id="cat-${slug(c.name)}"><h3>${esc(c.name)}<small>${esc(c.family)}${c.blurb ? " · " + esc(c.blurb) : ""}</small></h3><div>
        ${tools.map(t => `<div class="tool"><div class="name">${hl(t.name, w)}${t.asks ? `<span class="asks" title="Asks a question first">…</span>` : ""}</div><div class="proc">${t.keys ? `<kbd>${esc(t.keys)}</kbd> ` : ""}${hl(t.proc || "", w)}</div></div>`).join("")}</div></section>`;
    }).join("");
    empty.hidden = n > 0 || !allTools.length;
  }
  q.addEventListener("input", () => { query = q.value; render(); });
  addEventListener("keydown", e => { if (e.key === "/" && document.activeElement !== q && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); } if (e.key === "Escape" && document.activeElement === q) { q.value = ""; query = ""; render(); } });
  render();

  /* ---------- modules ---------- */
  const mods = (CAT.modules || []).map(m => { const cs = [...new Set(allTools.filter(t => t.module === m.file).map(t => t.category))]; return { f: m.file, d: cs.slice(0, 3).join(", ") + (cs.length > 3 ? ", …" : ""), k: m.tools || "" }; });
  $("#modules").innerHTML = `<div class="mhead"><i></i><i></i><i></i><span>${esc(CAT.name || "XcelCraft")}${CAT.version ? " " + esc(CAT.version) : ""} — modules</span></div>
    <ul>${mods.map(m => `<li><span class="f">${esc(m.f)}</span><span class="d">${esc(m.d)}</span><span class="k">${m.k === "" ? "" : m.k + " procs"}</span></li>`).join("") || `<li><span class="d">Module list arrives with the catalog.</span></li>`}</ul>
    <div class="mfoot">Import the modules into any workbook, or load the .xlam and get the menu.</div>`;
  const c = CAT.counts || {};
  $("#inside-facts").innerHTML = [["VBA", "only, no dependencies"], [c.modules || "", "modules: 22 .bas and one class"], ["XC_", "prefix on every tool"], ["MIT", "license"]]
    .map(([b, t]) => `<li><b>${esc(b)}</b>${esc(t)}</li>`).join("");
  if (CAT.version) $("#status").innerHTML = `Version ${esc(CAT.version)}: linted and cross-checked, not yet exercised end to end. Expect rough edges.`;

  /* ---------- keys panel ---------- */
  const pick = ["XC_SearchTool", "XC_RepeatLast", "XC_UndoLast", "XC_MarkSource"];
  const byName = n => allTools.find(t => t.name.toLowerCase().startsWith(n));
  const shown = [byName("search for a tool"), byName("run the last tool"), byName("undo the last tool"), byName("mark source range")].filter(t => t && t.keys);
  const more = allTools.filter(t => t.keys && !shown.includes(t)).filter((t, i, a) => a.findIndex(x => x.proc === t.proc) === i);
  $("#keys").innerHTML = `<ul>${shown.map(t => `<li><kbd>${esc(t.keys)}</kbd><span>${esc(t.name)}</span></li>`).join("")}</ul>
    <p class="keys-more">${more.length ? `${more.length} more shortcuts, every one of them editable. <a href="#catalog">Find them in the catalog</a>.` : ""}</p>`;
})();

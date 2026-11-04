#!/usr/bin/env node
/* Password-protect a built static site in place, before it is published.

     SITE_PASSWORD=... SITE_NAME="PulseNews" node tools/protect_site.js <site folder>

   Every .html page is replaced by a small unlock page that carries the original, encrypted. Every .json
   and .csv file is replaced by its encrypted form. After unlocking, a small helper in the page decrypts
   data files as the page loads them (fetch) or as the visitor downloads them, so the site works as before.

   AES-256-GCM, with the key from the password through PBKDF2-SHA256 (600,000 rounds). The salt is fixed per
   site, so one unlock covers every page and survives the site's own scheduled rebuilds; each file gets its
   own random IV. The key is kept for the browser session, or on the device if the visitor ticks "Stay
   unlocked"; adding ?lock to any address forgets it. Refuses to run without a password, so a missing
   secret can never publish an unprotected site. Same scheme as the pricing tool (tools/protect.js).

   If a page carries the visit log's ping (<script data-apvl=...> in the shared header), the unlock page gets
   a copy, so a visitor who stops at the password box is logged; the page reports whether they got in, and
   once unlocked the page carries on in the same row (homepage/tools/sitebar/visit_log.py).
   Shared by the pulse-terminal, supply-chain and hiring-dashboard repos (tools/protect_site.js in each). */
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const dir = process.argv[2];
const password = (process.env.SITE_PASSWORD || "").trim();
const site = (process.env.SITE_NAME || "This site").trim();
if (!dir || !fs.existsSync(dir)) { console.error("usage: node protect_site.js <site folder>"); process.exit(2); }
if (password.length < 12) { console.error("SITE_PASSWORD is missing or too short; refusing to publish unprotected."); process.exit(1); }

const ITER = 600000;
const salt = crypto.createHash("sha256").update("andreipinter.com|" + site).digest().subarray(0, 16);
const key = crypto.pbkdf2Sync(password, salt, ITER, 32, "sha256");
const KEYNAME = "site-key:" + crypto.createHash("sha256").update(site).digest("hex").slice(0, 12);
const b64 = b => Buffer.from(b).toString("base64");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function seal(buf) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key, iv);
  return { iv, ct: Buffer.concat([c.update(buf), c.final(), c.getAuthTag()]) };
}

// Runs inside every unlocked page, first: decrypts .json/.csv responses and downloads.
const HELPER = `<script>(function(){
var K=${JSON.stringify(KEYNAME)};
function raw(){try{return sessionStorage.getItem(K)||localStorage.getItem(K)}catch(e){return null}}
var kp=null;function key(){if(!kp){var r=raw();if(!r)return Promise.reject(new Error("locked"));
kp=crypto.subtle.importKey("raw",Uint8Array.from(atob(r),function(c){return c.charCodeAt(0)}),"AES-GCM",false,["decrypt"])}return kp}
var d=function(s){return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0)})};
function open(t){var e=JSON.parse(t);return key().then(function(k){return crypto.subtle.decrypt({name:"AES-GCM",iv:d(e.iv)},k,d(e.ct))})}
var isData=function(u){try{u=new URL(u,location.href)}catch(e){return false}return u.origin===location.origin&&/\\.(json|csv)$/i.test(u.pathname)};
var F=window.fetch.bind(window);
window.fetch=function(i,o){var u=typeof i==="string"?i:(i&&i.url)||"";
return F(i,o).then(function(r){if(!r.ok||!isData(u))return r;return r.clone().text().then(function(t){
if(t.slice(0,10)!=='{"pwenc":1')return r;
return open(t).then(function(b){var h=new Headers(r.headers);h.delete("content-length");
h.set("content-type",/\\.csv(\\?|#|$)/i.test(u)?"text/csv; charset=utf-8":"application/json; charset=utf-8");
return new Response(b,{status:r.status,statusText:r.statusText,headers:h})})})})};
document.addEventListener("click",function(ev){var a=ev.target&&ev.target.closest&&ev.target.closest("a[href]");
if(!a||!isData(a.href)||ev.defaultPrevented)return;ev.preventDefault();
fetch(a.href).then(function(r){return r.blob()}).then(function(b){var x=document.createElement("a");x.href=URL.createObjectURL(b);
x.download=a.getAttribute("download")||new URL(a.href).pathname.split("/").pop();document.body.appendChild(x);x.click();
setTimeout(function(){URL.revokeObjectURL(x.href);x.remove()},800)})},true);
})();</script>`;

const PING = /<script data-apvl="[^"]*">[\s\S]*?<\/script>/;
// The shared light/dark switch (homepage/tools/sitebar/build_sitebar.py) keeps its script in <head>; the unlock
// page carries the same block, so it shows in the visitor's chosen theme too.
const THEME = /<!-- sitetheme:start[\s\S]*?<!-- sitetheme:end -->/;

function gate(title, iv, ct, ping, theme) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${theme ? theme + "\n" : ""}<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title.replace(/[<>]/g, "")}</title>
${ping ? "<script>window.__apvlLocked=1</script>" + ping + "\n" : ""}<style>
:root{--bg:#EEF1F4;--surface:#fff;--ink:#18202C;--ink-2:#4A5568;--line:#D6DCE4;--neg:#B4462F;--focus:#2C6BED;color-scheme:light}
:root[data-theme="dark"]{--bg:#10151C;--surface:#18202A;--ink:#E8EDF3;--ink-2:#A9B3C1;--line:#2A3441;--neg:#E07A5F;--focus:#7DA7FF;color-scheme:dark}
@media (prefers-color-scheme:dark){:root:not([data-theme]){--bg:#10151C;--surface:#18202A;--ink:#E8EDF3;--ink-2:#A9B3C1;--line:#2A3441;--neg:#E07A5F;--focus:#7DA7FF;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:400 15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:20px}
form{width:min(380px,100%);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:26px 24px}
h1{margin:0 0 6px;font-size:20px}
p{margin:0 0 18px;color:var(--ink-2);font-size:14px}
a{color:inherit}
label{display:grid;gap:5px;font-size:13px;color:var(--ink-2)}
input[type=password]{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--ink);font:inherit;font-size:16px}
.row{display:flex;align-items:center;gap:8px;margin:12px 0 16px;font-size:14px;color:var(--ink)}
button{width:100%;padding:10px;border:0;border-radius:4px;background:var(--ink);color:var(--surface);font:inherit;font-weight:600;cursor:pointer}
button:disabled{opacity:.6;cursor:default}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.err{color:var(--neg);font-size:14px;margin:10px 0 0;min-height:1.5em}
.back{margin:16px 0 0;font-size:13.5px}
</style>
</head>
<body>
<form id="f" autocomplete="on">
  <h1>${esc(site)}</h1>
  <p>This project is private. Enter the password to open it.</p>
  <input type="text" name="username" value="${esc(site)}" autocomplete="username" hidden>
  <label>Password <input type="password" id="pw" autocomplete="current-password" required autofocus></label>
  <label class="row"><input type="checkbox" id="keep"> Stay unlocked on this device</label>
  <button id="go">Open</button>
  <p class="err" id="err" role="alert"></p>
  <p class="back">Looking for Andrei Pinter's public work? It's on <a href="https://andreipinter.com/">andreipinter.com</a>.</p>
</form>
<script>
(function(){
  var S="${b64(salt)}",I="${b64(iv)}",C="${b64(ct)}",N=${ITER},K=${JSON.stringify(KEYNAME)};
  var d=function(s){return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0)})};
  var enc=function(b){return btoa(String.fromCharCode.apply(null,new Uint8Array(b)))};
  function show(bits){
    return crypto.subtle.importKey("raw",bits,"AES-GCM",false,["decrypt"]).then(function(k){
      return crypto.subtle.decrypt({name:"AES-GCM",iv:d(I)},k,d(C));
    }).then(function(buf){var h=new TextDecoder().decode(buf);ping("unlocked",1);document.open();document.write(h);document.close();ping("attach");});
  }
  function ping(f,a){try{window.__apvl[f](a)}catch(e){}}
  function forget(){try{sessionStorage.removeItem(K);localStorage.removeItem(K)}catch(e){}}
  if(/[?&]lock\\b/.test(location.search))forget();
  var saved=null;try{saved=sessionStorage.getItem(K)||localStorage.getItem(K)}catch(e){}
  if(saved){
    document.documentElement.style.visibility="hidden";
    var go=function(){show(d(saved)).catch(function(){forget();document.documentElement.style.visibility="";});};
    if(document.readyState==="complete")go();else window.addEventListener("load",go);
  }
  document.getElementById("f").addEventListener("submit",function(e){
    e.preventDefault();
    var b=document.getElementById("go"),er=document.getElementById("err"),keep=document.getElementById("keep").checked;
    b.disabled=true;b.textContent="Unlocking…";er.textContent="";
    crypto.subtle.importKey("raw",new TextEncoder().encode(document.getElementById("pw").value),"PBKDF2",false,["deriveBits"]).then(function(m){
      return crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:d(S),iterations:N},m,256);
    }).then(function(bits){
      return crypto.subtle.importKey("raw",bits,"AES-GCM",false,["decrypt"]).then(function(k){
        return crypto.subtle.decrypt({name:"AES-GCM",iv:d(I)},k,d(C));
      }).then(function(buf){
        try{sessionStorage.setItem(K,enc(bits));if(keep)localStorage.setItem(K,enc(bits))}catch(e){}
        var h=new TextDecoder().decode(buf);ping("unlocked",0);document.open();document.write(h);document.close();ping("attach");
      });
    }).catch(function(){ping("failed");b.disabled=false;b.textContent="Open";er.textContent="That password didn't work. Check it and try again.";});
  });
})();
</script>
</body>
</html>
`;
}

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

let pages = 0, data = 0;
for (const f of walk(dir)) {
  const ext = path.extname(f).toLowerCase();
  if (ext === ".html") {
    let html = fs.readFileSync(f, "utf8");
    if (html.includes('id="f" autocomplete="on"') && html.includes("PBKDF2")) continue;   // already protected
    const title = site;                     // the locked page shows nothing of the page's own content, not even its title
    const ping = (html.match(PING) || [""])[0];
    const theme = (html.match(THEME) || [""])[0];
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + "\n" + HELPER) : HELPER + html;
    const { iv, ct } = seal(Buffer.from(html, "utf8"));
    fs.writeFileSync(f, gate(title, iv, ct, ping, theme));
    pages++;
  } else if (ext === ".json" || ext === ".csv") {
    const { iv, ct } = seal(fs.readFileSync(f));
    fs.writeFileSync(f, JSON.stringify({ pwenc: 1, iv: b64(iv), ct: b64(ct) }));
    data++;
  }
}
// No page or data file may be left readable.
for (const f of walk(dir)) {
  const ext = path.extname(f).toLowerCase(), t = fs.readFileSync(f, "utf8");
  if (ext === ".html" && !t.includes("PBKDF2")) throw new Error("unprotected page left: " + f);
  if ((ext === ".json" || ext === ".csv") && !t.startsWith('{"pwenc":1')) throw new Error("unprotected data left: " + f);
}
console.log(`${site}: protected ${pages} page${pages === 1 ? "" : "s"} and ${data} data file${data === 1 ? "" : "s"} in ${dir}`);

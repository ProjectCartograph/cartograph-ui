// What each core screen puts in front of a person on arrival, counted the
// same way every time, so the walk-first work (#136) is measured against
// a baseline rather than a feeling. Against a stack serving the example
// (`just stack`):
//
//   node scripts/screen-audit.mjs [baseUrl] [chromiumPath] [cdpPort] [out.json]
//
// For each screen, at 1440 by 900 once it has settled:
// - controls: every visible thing a person can press, type in or pick
//   (buttons, links, fields, tabs, menu items), in the first screenful and
//   on the whole page;
// - primary: the visible buttons drawn as the main action (data-variant
//   default);
// - navigation: the separate ways to move around (each nav, navigation
//   landmark and tab list not inside another);
// - words: the words of text in the first screenful.
//
// It creates one change set through the API so the review screen has
// something in it; the stack keeps nothing, so nothing is left behind.

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const [base = "http://127.0.0.1:8080", chromium = process.env.CHROMIUM ?? "chromium", portArg = "9495", out = ""] = process.argv.slice(2);
const port = Number(portArg);
const api = `${base}/api/v1`;

async function call(method, path, body) {
  const r = await fetch(api + path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

// A change set holding a new project, as an agent's or a person's would.
const cs = process.env.SCREENS ? { id: "" } : await call("POST", "/changesets", { title: "Customer analytics" });
if (!process.env.SCREENS) await call("PUT", `/changesets/${cs.id}/items/Project/p-audit`, {
  yaml: "apiVersion: cartograph/v1\nkind: Project\nmetadata:\n  id: p-audit\n  name: Customer analytics service\nspec:\n  summary:\n    about: Members plan planting from a forecast of buyer demand\n",
});

const project = "quality-check-rollout";
// SCREENS="Name=/path,Name=/path" audits those instead, for a screen
// only another workspace shows (the welcome walk, on an empty one).
const chosen = (process.env.SCREENS ?? "").split(",").filter(Boolean).map((s) => s.split("="));
const screens = chosen.length > 0 ? chosen : [
  ["Home", "/"],
  ["Strategy", "/strategy"],
  ["Projects", "/projects"],
  ["Project: Context", `/projects/${project}/initiation/goals`],
  ["Project: Problem", `/projects/${project}/initiation/aim`],
  ["Project: Governance", `/projects/${project}/initiation/resources`],
  ["Project: Plan", `/projects/${project}/initiation/timeline`],
  ["Project: Charter", `/projects/${project}/charter`],
  ["Programme", "/programmes/quality-improvement-programme"],
  ["Operation", "/operations/collection-service"],
  ["Gap", "/gaps/no-single-quality-standard"],
  ["Indicator: readings", "/kpis/depot-availability/readings"],
  ["Change sets", "/changesets"],
  ["Change set review", `/changesets/${cs.id}`],
  ["Sheets", "/sheets"],
  ["Graph", "/graph"],
];

const ch = spawn(chromium, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", `--remote-debugging-port=${port}`, "--remote-allow-origins=*", "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
let tabs;
for (let i = 0; i < 100 && !tabs; i++) {
  try {
    tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  } catch {
    await sleep(200);
  }
}
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d.result);
    pending.delete(d.id);
  }
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))?.result?.value;
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// Counted in the page, by what a person can see.
const COUNT = `(() => {
  const H = innerHeight;
  const seen = (el) => {
    if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const inFold = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < H; };
  const CONTROL = 'button, a[href], input:not([type=hidden]), textarea, select, [contenteditable=""], [contenteditable=true], [contenteditable=plaintext-only], [role=button], [role=link], [role=tab], [role=combobox], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [role=option]';
  const controls = [...document.querySelectorAll(CONTROL)].filter((el) => seen(el) && !el.parentElement?.closest(CONTROL));
  const primary = controls.filter((el) => el.matches('[data-variant="default"]') && inFold(el));
  const NAV = 'nav, [role=navigation], [role=tablist]';
  const navs = [...document.querySelectorAll(NAV)].filter((el) => seen(el) && !el.parentElement?.closest(NAV));
  let words = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.textContent.trim() || !seen(el) || !inFold(el) || el.closest("script, style, svg")) continue;
    words += n.textContent.trim().split(/\\s+/).length;
  }
  return {
    fold: controls.filter(inFold).length,
    page: controls.length,
    primary: primary.length,
    navigation: navs.length,
    words,
    title: document.querySelector("h1")?.textContent?.trim() ?? "",
  };
})()`;

const rows = [];
for (const [name, path] of screens) {
  await send("Page.navigate", { url: base + path });
  // Settled: the page's own requests answered and drawn.
  await sleep(6000);
  const r = await evaluate(COUNT);
  rows.push({ screen: name, path, ...r });
  console.error(`${name}: ${r.fold} controls in view, ${r.page} on the page, ${r.primary} primary, ${r.navigation} navigation, ${r.words} words in view`);
}
ch.kill();

const total = (k) => rows.reduce((n, r) => n + r[k], 0);
console.log("| Screen | Controls in the first screenful | Controls on the page | Primary actions in view | Navigation systems | Words in view |");
console.log("|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.screen} | ${r.fold} | ${r.page} | ${r.primary} | ${r.navigation} | ${r.words} |`);
console.log(`| **Median** | ${median(rows.map((r) => r.fold))} | ${median(rows.map((r) => r.page))} | ${median(rows.map((r) => r.primary))} | ${median(rows.map((r) => r.navigation))} | ${median(rows.map((r) => r.words))} |`);
console.error(`total controls in view across ${rows.length} screens: ${total("fold")}`);
if (out) writeFileSync(out, JSON.stringify({ base, at: new Date().toISOString(), rows }, null, 2) + "\n");

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
process.exit(0);

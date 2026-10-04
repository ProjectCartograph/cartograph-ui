#!/usr/bin/env node
// Headless-Chromium smoke test over raw Chrome DevTools Protocol (CDP), no
// extra runtime dependency: Node's built-in WebSocket client talks straight
// to Chromium's debugger, and plain fetch talks to its HTTP endpoint.
// Requires a Cartograph server already serving this build (see README.md)
// and a Chromium binary.
//
// Usage:
//   just smoke [baseUrl] [shots] [bootstrap]
//   node scripts/smoke.mjs [baseUrl] [chromiumPath] [cdpPort] [shots] [bootstrap]
//
// Defaults: baseUrl=http://127.0.0.1:8080 (what `just serve` in
// cartograph-engine listens on), chromiumPath=$CHROMIUM or chromium,
// cdpPort=9333. Pass "shots" anywhere to also save screenshots under
// scripts/shots/ (Arrange, the goal editor, the project steps, and the
// 1024-wide and collapsed-rail layouts).
//
// Pass "bootstrap" anywhere to run only bootstrapFlow against a
// vault with nothing in it: no seeding, no route sweep, no project
// journey; just the first Team, then a pillar, an objective and an
// outcome, entirely through the interface, which is the case where a
// required picker could be shown with nothing to pick.
//
// Beyond the per-route console-error check, this script also runs a
// collapsed-sidebar pass over every route (nothing inside the rail visibly
// overflows its own box once collapsed), a 1024-wide pass over every route
// (document.documentElement.scrollWidth <= 1024), and a keyboard-only pass
// (Tab from Arrange to the first "New objective" button, Enter reveals its
// inline input, Escape closes it).
//
// Controls are found the way the interface's own tests find them: by
// data-cartograph-field (the manifest's JSON pointer), by a step's key, or
// by accessible name; never by visible text or placeholder where a field
// path exists.
//
// Exits 0 and prints "smoke ok" when every checked route loads with zero
// console errors and zero uncaught exceptions and every flow holds;
// otherwise prints what it found and exits 1.

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const MODES = ["shots", "bootstrap"];
const positional = process.argv.slice(2).filter((a) => !MODES.includes(a));
const baseUrl = (positional[0] ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
const chromiumPath = positional[1] ?? process.env.CHROMIUM ?? "chromium";
const cdpPort = Number(positional[2] ?? 9333);
const takeShots = process.argv.includes("shots");
// The full suite assumes the example's teams, data sources, groups and
// goals; a vault with nothing in it has none, so it gets its own flow.
const bootstrapOnly = process.argv.includes("bootstrap");
const shotsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
const SHEET_KINDS = [
  "Team",
  "BeneficiaryGroup",
  "Resource",
  "Segment",
  "Unit",
  "FundingSource",
  "Gap",
  "Assumption",
  "DataSource",
  "ReportingCycle",
];
const routes = [
  "/",
  "/strategy",
  "/portfolios",
  "/new",
  "/goals",
  "/projects",
  "/projects/new",
  "/programmes",
  "/programmes/new",
  "/operations",
  "/operations/new",
  "/gaps",
  "/gaps/new",
  "/kpis",
  "/manifests/Project",
  "/manifests/BeneficiaryGroup",
  "/sheets",
  ...SHEET_KINDS.map((k) => `/sheets/${k}`),
  "/snapshots",
];

// Mirrors src/surfaces/sheet/schema.ts's slugify: kept in sync by hand
// since it is a three-line, unlikely-to-drift rule, and duplicating it here
// avoids importing frontend source into this plain Node script.
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function waitForHTTP(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (err) {
      lastErr = err;
    }
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${url}: ${lastErr}`);
}

function launchChromium() {
  const proc = spawn(
    chromiumPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${cdpPort}`,
      "--remote-allow-origins=*",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );
  proc.on("error", (err) => {
    console.error("failed to launch chromium:", err);
    process.exit(1);
  });
  return proc;
}

let nextId = 1;

function connectCDP(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const listeners = new Set();

    ws.addEventListener("open", () => resolve({ ws, pending, listeners }));
    ws.addEventListener("error", reject);
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of listeners) fn(msg);
      }
    });
  });
}

function send(conn, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    conn.pending.set(id, { resolve, reject });
    conn.ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJS(conn, expression) {
  const { result, exceptionDetails } = await send(conn, "Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: false,
  });
  if (exceptionDetails) {
    const ex = exceptionDetails;
    throw new Error(`eval failed: ${ex.text} ${ex.exception?.description ?? ""}`);
  }
  return result.value;
}

const J = JSON.stringify;

// The in-page half of every lookup below, prepended to each evaluation by
// run(). Kept as plain functions so a failure names the field or the
// accessible name it was looking for.
//
// setNativeValue writes into a React-controlled <input> the way a real
// keystroke would: through the native value setter, so React's own change
// tracking (which intercepts the plain .value setter) still sees the write
// and fires the component's onChange.
//
// A list keyed by id writes the key into its pointer in braces
// (/spec/deliverables/{d-1a2b}/name), so a pattern segment "*" matches any
// one segment of a pointer.
const PAGE_JS = `
  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function accName(el) {
    const label = el.getAttribute("aria-label");
    if (label) return label.trim();
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"], svg').forEach((n) => n.remove());
    return copy.textContent.replace(/\\s+/g, " ").trim();
  }
  function topLayer() {
    const open = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'));
    return open[open.length - 1] || null;
  }
  function scopeOf(within) {
    if (within === "dialog") {
      const d = topLayer();
      if (!d) throw new Error("no dialog is open");
      return d;
    }
    if (within) {
      const r = document.querySelector(within);
      if (!r) throw new Error("container not found: " + within);
      return r;
    }
    return document;
  }
  function pointerMatches(pattern, actual) {
    const p = pattern.split("/");
    const a = actual.split("/");
    return p.length === a.length && p.every((s, i) => s === "*" || s === a[i]);
  }
  function fieldEls(pattern, root) {
    return Array.from((root || document).querySelectorAll("[data-cartograph-field]")).filter((el) =>
      pointerMatches(pattern, el.getAttribute("data-cartograph-field")),
    );
  }
  function field(pattern, root, nth) {
    const el = fieldEls(pattern, root).filter((e) => !e.disabled)[nth || 0];
    if (!el) throw new Error("no control carries data-cartograph-field " + pattern);
    return el;
  }
  function textControl(el) {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return el;
    return el.querySelector("input:not([type=hidden]), textarea");
  }
  function trigger(el) {
    if (el.matches('button, [role="combobox"], [data-slot$="trigger"]')) return el;
    return el.querySelector("button");
  }
  function named(name, root) {
    return Array.from((root || document).querySelectorAll('button, a, [role="menuitem"], [role="option"], [role="radio"]'))
      .filter((el) => accName(el) === name);
  }
`;

async function run(conn, body) {
  return evalJS(conn, `(() => {\n${PAGE_JS}\n${body}\n})()`);
}

/** run(), retried while what it looks for has not rendered yet: a step
 * that has just loaded is still fetching the data its controls show. */
async function find(conn, body, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await run(conn, body);
    } catch (err) {
      if (Date.now() > deadline) throw err;
      await sleep(200);
    }
  }
}

// The reason field has no placeholder (text is the last resort), so it is
// found by what identifies it in the source: the sheet dialog's form field
// name, the goal editor's id, or, in a dialog whose only field is the
// reason (saving a project's version), that dialog's one text input.
// Searched inside the top dialog when one is open, else the whole
// document.
async function setReason(conn, value) {
  await find(
    conn,
    `const scope = topLayer() || document;
    let el = Array.from(scope.querySelectorAll('input[name="_reason"], textarea[name="_reason"], #reason, #goal-save-reason'))
      .find((e) => !e.disabled);
    if (!el && scope !== document) {
      const inputs = Array.from(scope.querySelectorAll('input:not([type=hidden]), textarea')).filter((e) => !e.disabled);
      if (inputs.length === 1) el = inputs[0];
    }
    if (!el) throw new Error("reason field not found");
    setNativeValue(el, ${J(value)});`,
  );
}

/** Types into the text control a field pointer names. */
async function setField(conn, pointer, value, { within, nth = 0 } = {}) {
  await find(
    conn,
    `const el = textControl(field(${J(pointer)}, scopeOf(${J(within ?? null)}), ${nth}));
    if (!el) throw new Error("no text control inside " + ${J(pointer)});
    el.scrollIntoView({ block: "center" });
    setNativeValue(el, ${J(value)});`,
  );
}

/** Types into a control that carries no field pointer of its own (a
 * search box, a reason), by its accessible name. */
async function setNamedInput(conn, name, value, { within } = {}) {
  await find(
    conn,
    `const el = Array.from(scopeOf(${J(within ?? null)}).querySelectorAll("input, textarea"))
      .find((i) => accName(i) === ${J(name)} && !i.disabled);
    if (!el) throw new Error("no input named " + ${J(name)});
    setNativeValue(el, ${J(value)});`,
  );
}

/** Clicks a button, link, menu item or radio by its accessible name. */
async function clickNamed(conn, name, { within, nth = 0 } = {}) {
  await find(
    conn,
    `const all = named(${J(name)}, scopeOf(${J(within ?? null)})).filter((b) => !b.disabled);
    const el = all[${nth}];
    if (!el) throw new Error("nothing named " + ${J(name)} + " at index ${nth}");
    el.scrollIntoView({ block: "center" });
    el.click();`,
  );
}

/** Opens the select or combobox a field pointer names and picks one of its
 * options: the one whose stored value is `value` when the list carries it
 * (a combobox item's data-value, or the native select Radix keeps beside a
 * form's select), else the one whose accessible name is `name`, else the
 * first. */
async function pickOption(conn, pointer, { value, name, within, nth = 0 } = {}) {
  const label = await find(
    conn,
    `const el = field(${J(pointer)}, scopeOf(${J(within ?? null)}), ${nth});
    const t = trigger(el);
    if (!t) throw new Error("no trigger inside " + ${J(pointer)});
    t.scrollIntoView({ block: "center" });
    t.click();
    const value = ${J(value ?? null)};
    if (value === null) return null;
    const native = t.parentElement && t.parentElement.querySelector("select");
    const opt = native && Array.from(native.options).find((o) => o.value === value);
    return opt ? opt.text : null;`,
  );
  const deadline = Date.now() + 4000;
  let count = 0;
  while (Date.now() < deadline) {
    count = await run(conn, `return document.querySelectorAll('[role="option"], [data-slot="combobox-item"]').length;`);
    if (count > 0) break;
    await sleep(150);
  }
  if (count === 0) throw new Error(`no option opened for ${pointer}`);
  await run(
    conn,
    `const options = Array.from(document.querySelectorAll('[role="option"], [data-slot="combobox-item"]'));
    const value = ${J(value ?? null)};
    const name = ${J(label ?? name ?? null)};
    let pick = null;
    if (value !== null) pick = options.find((o) => o.getAttribute("data-value") === value) || null;
    if (!pick && name !== null) pick = options.find((o) => accName(o) === name) || null;
    if (!pick && value === null && name === null) pick = options[0];
    if (!pick) throw new Error("option not found for " + ${J(pointer)} + ": " + (value ?? name) + "; options are " + JSON.stringify(options.map((o) => accName(o))));
    pick.click();
    return accName(pick);`,
  );
  await sleep(250);
}

/** Clicks the radio with this accessible name inside the radio group a
 * field pointer names. */
async function pickRadio(conn, pointer, name, { within, nth = 0 } = {}) {
  await find(
    conn,
    `const group = field(${J(pointer)}, scopeOf(${J(within ?? null)}), ${nth});
    const radio = Array.from(group.querySelectorAll('[role="radio"]')).find((r) => accName(r) === ${J(name)});
    if (!radio) throw new Error("no radio " + ${J(name)} + " in " + ${J(pointer)});
    radio.click();`,
  );
  await sleep(150);
}

/** Picks a month out of a MonthPicker (components/ui/date-picker.tsx):
 * opens the picker a field pointer names, steps the year to the one asked
 * for, then clicks the month. Date fields are calendar dropdowns, not text
 * inputs, so there is nothing to type into. */
async function pickMonth(conn, pointer, year, monthName, { within } = {}) {
  await find(
    conn,
    `const t = trigger(field(${J(pointer)}, scopeOf(${J(within ?? null)})));
    t.scrollIntoView({ block: "center" });
    t.click();`,
  );
  await sleep(300);
  for (let i = 0; i < 12; i++) {
    const shown = await run(
      conn,
      `const content = document.querySelector('[data-slot="popover-content"]');
      if (!content) return null;
      const label = Array.from(content.querySelectorAll("button[aria-label]"))
        .map((b) => b.getAttribute("aria-label"))
        .find((l) => /^[A-Z][a-z]+ \\d{4}$/.test(l));
      return label ? Number(label.split(" ")[1]) : null;`,
    );
    if (shown === null) throw new Error(`month picker did not open for ${pointer}`);
    if (shown === year) break;
    await clickNamed(conn, shown < year ? "Next year" : "Previous year", { within: '[data-slot="popover-content"]' });
    await sleep(150);
  }
  await clickNamed(conn, `${monthName} ${year}`, { within: '[data-slot="popover-content"]' });
  await sleep(250);
}

// A real CDP key event (not a JS-synthesized one): this is what a
// goal-tree inline add/rename row's own onKeyDown handler (Enter to save,
// Escape to cancel) actually listens for.
async function pressKey(conn, key, windowsVirtualKeyCode) {
  await send(conn, "Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code: key,
    windowsVirtualKeyCode,
    text: key === "Enter" ? "\r" : undefined,
  });
  await send(conn, "Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode });
}
async function pressEnter(conn) {
  await pressKey(conn, "Enter", 13);
}
async function pressEscape(conn) {
  await pressKey(conn, "Escape", 27);
}

// A real CDP mouse click at a page coordinate, not a JS-synthesized
// el.click(): Radix's DropdownMenuTrigger opens on a genuine
// pointerdown/pointerup pair, which el.click() alone never dispatches.
// Every other Radix trigger this script drives (Select, Dialog,
// AlertDialog, Popover) responds to el.click(), so this is used only for a
// goal card's own actions menu.
async function realClick(conn, x, y) {
  await send(conn, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await send(conn, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send(conn, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

/** realClick on the element a JS expression (evaluated in-page) resolves
 * to, by its current bounding rect's centre. */
async function realClickElement(conn, jsExprReturningElement, errMsg) {
  // scrollIntoView first: a real CDP mouse click dispatches at viewport
  // coordinates, so an element below the fold (a real risk once enough
  // pillars and goals wrap the grid past one screen) would otherwise
  // compute a rect the click lands nowhere near.
  await run(
    conn,
    `const el = ${jsExprReturningElement};
    if (!el) throw new Error(${J(errMsg)});
    el.scrollIntoView({ block: "center" });`,
  );
  await sleep(200);
  const rect = await run(
    conn,
    `const el = ${jsExprReturningElement};
    if (!el) throw new Error(${J(errMsg)});
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };`,
  );
  await realClick(conn, rect.x, rect.y);
}

/** A goal card's region on Arrange: the card the tree draws for one goal,
 * by its id. */
function goalRegion(id) {
  return `document.querySelector('[data-cartograph-region="goal-' + ${J(id)} + '"]')`;
}

/** Opens a goal card's actions menu and picks an item by its accessible
 * name. */
async function goalMenu(conn, goalId, item) {
  await realClickElement(
    conn,
    `(${goalRegion(goalId)})?.querySelector('button[aria-haspopup="menu"], [data-slot="dropdown-menu-trigger"]')`,
    `actions menu not found on goal ${goalId}`,
  );
  await sleep(300);
  await clickNamed(conn, item, { within: '[role="menu"]' });
  await sleep(300);
}

function watchConsole(conn, { expected = () => false } = {}) {
  const problems = [];
  const onEvent = (msg) => {
    if (msg.method === "Runtime.exceptionThrown") {
      const ex = msg.params.exceptionDetails;
      problems.push(`uncaught exception: ${ex.text} ${ex.exception?.description ?? ""}`);
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      problems.push(`console.error: ${text}`);
    }
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      const entry = msg.params.entry;
      if (!expected(entry)) problems.push(`log error: ${entry.text} (${entry.url ?? "no url"})`);
    }
  };
  conn.listeners.add(onEvent);
  return { problems, detach: () => conn.listeners.delete(onEvent) };
}

// Handled by design, not errors: a project the vault has never held (it
// lives only as a staged draft until its first version) answers 404 for
// itself, its checks, its state and its versions, which the page reads as
// "no version yet"; and a project's stakeholder map is a manifest of its
// own, made the first time somebody scores a stakeholder, so until then
// every project page asks for it and is told 404.
const EXPECTED_404_URL_PATTERNS = [
  /\/manifests\/Project\/[^/?]+(\/(checks|state|versions))?(\?|$)/,
  /\/manifests\/StakeholderMap\/[^/?]+(\/document)?(\?|$)/,
];

function isExpected404(entry) {
  return entry.text.includes("404") && !!entry.url && EXPECTED_404_URL_PATTERNS.some((re) => re.test(entry.url));
}

/** The goals mutability pass's own console watch: a 422 from a Goal write
 * is the refusal this pass deliberately provokes (deleting a goal a project
 * still references), handled by design rather than a real error. */
function watchConsoleForGoalsMutability(conn) {
  return watchConsole(conn, {
    expected: (entry) =>
      isExpected404(entry) ||
      (entry.text.includes("422") && !!entry.url && /\/manifests\/Goal\/[^/?]+(\?|$)/.test(entry.url)),
  });
}

/** The project journey's console watch: the stakeholder map's 404 before
 * one exists, and a handoff refused for blocking checks (422), which the
 * handoff pass provokes on purpose. */
function watchConsoleForProjectJourney(conn) {
  return watchConsole(conn, {
    expected: (entry) =>
      isExpected404(entry) ||
      (entry.text.includes("422") && !!entry.url && /\/manifests\/Project\/[^/?]+\/(snapshots|state)(\?|$)/.test(entry.url)),
  });
}

async function waitForLoad(conn) {
  await new Promise((resolve) => {
    const waiter = (msg) => {
      if (msg.method === "Page.loadEventFired") {
        conn.listeners.delete(waiter);
        resolve();
      }
    };
    conn.listeners.add(waiter);
  });
}

async function navigateAndWait(conn, route) {
  // A hard navigation away from a project with edits still inside the
  // autosave debounce makes the browser block a beforeunload prompt and
  // log it. Waiting for the store to say it has saved is both what a
  // person would see and what keeps the console clean.
  await waitForSaved(conn);
  await send(conn, "Page.navigate", { url: baseUrl + route });
  await waitForLoad(conn);
  await sleep(800);
}

/** Polls until the header reports the working copy is saved, so a hard
 * navigation never races the autosave debounce. */
async function waitForSaved(conn, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await evalJS(
      conn,
      `document.querySelector('[data-slot="save-status"]')?.getAttribute("data-state") ?? null`,
    );
    if (state === null || state === "saved" || state === "idle") return;
    await sleep(200);
  }
}

async function captureScreenshot(conn, filename, width = 1440, height = 900) {
  await send(conn, "Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(200);
  const { data } = await send(conn, "Page.captureScreenshot", { format: "png" });
  await mkdir(shotsDir, { recursive: true });
  await writeFile(path.join(shotsDir, filename), Buffer.from(data, "base64"));
  console.log(`smoke: screenshot saved to scripts/shots/${filename}`);
}

async function checkRoute(conn, route) {
  const { problems, detach } = watchConsole(conn, { expected: isExpected404 });
  await send(conn, "Page.navigate", { url: baseUrl + route });
  await waitForLoad(conn);
  // Give React and its data fetch a moment to settle after load.
  await sleep(800);
  const bodyText = String((await evalJS(conn, "document.body.innerText")) ?? "");
  detach();
  return { problems, bodyText };
}

async function getJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${opts?.method ?? "GET"} ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function listIds(kind) {
  const raw = await getJSON(`${baseUrl}/api/v1/manifests/${kind}`);
  return (Array.isArray(raw) ? raw : (raw.items ?? [])).map((m) => m.id);
}

function get(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/**
 * Drives one create and one edit of a Resource through the real Sheet
 * dialog: opens /sheets/Resource, clicks Add, fills the name, the category
 * and the reason (through native input events so React's controlled
 * inputs pick them up), submits, then clicks the new row to edit it,
 * changes the name and the category, submits again. Returns the console
 * problems observed throughout and the two names used, so the caller can
 * assert the row appeared and check the API's version count.
 */
async function resourceCreateEditFlow(conn) {
  const { problems, detach } = watchConsole(conn);
  await navigateAndWait(conn, "/sheets/Resource");

  const createdName = `Smoke Test Resource ${Date.now()}`;
  const editedName = `${createdName} Edited`;

  async function fill(name, category, reason) {
    await setField(conn, "/metadata/name", name, { within: "dialog" });
    await pickOption(conn, "/spec/category", { value: category, within: "dialog" });
    await setReason(conn, reason);
  }

  async function submit() {
    await run(
      conn,
      `const btn = topLayer()?.querySelector('button[type="submit"]');
      if (!btn) throw new Error("submit button not found");
      btn.click();`,
    );
    await sleep(1000);
  }

  // Create.
  await clickNamed(conn, "Add", { within: "main" });
  await sleep(300);
  // The person never says who they are: there is no actor picker, and the
  // only picker in the dialog is the category.
  const pickers = await run(conn, `return Array.from(topLayer().querySelectorAll('[role="combobox"]')).map((c) => c.getAttribute("data-cartograph-field"));`);
  if (pickers.some((f) => f !== "/spec/category")) {
    problems.push(`Resource dialog showed a picker for something other than the category: ${J(pickers)}`);
  }
  await fill(createdName, "system", "smoke test create");
  await submit();

  const afterCreateText = await evalJS(conn, "document.body.innerText");
  if (!String(afterCreateText).includes(createdName)) {
    problems.push(`created row "${createdName}" did not appear after submit`);
  }
  await sleep(1000);

  // Edit: click the new row, change the name, submit again.
  await run(
    conn,
    `const rows = Array.from(document.querySelectorAll("table tbody tr"));
    const row = rows.find((r) => r.textContent.includes(${J(createdName)}));
    if (!row) throw new Error("created row not found to edit");
    row.click();`,
  );
  await sleep(300);
  await fill(editedName, "facility", "smoke test edit");
  await submit();

  const afterEditText = await evalJS(conn, "document.body.innerText");
  if (!String(afterEditText).includes(editedName)) {
    problems.push(`edited row "${editedName}" did not appear after submit`);
  }

  detach();
  return { problems, createdName, editedName };
}

/** Clicks the "New <level>" row at the foot of a goal's column on
 * Arrange, types the name into the inline input it reveals (no dialog) and
 * presses Enter. Does not navigate: the new card's editor only opens if
 * the person clicks it. The row belongs to the column that holds the
 * parent's own card. */
async function inlineAddGoal(conn, parentId, levelWord, goalName) {
  await run(
    conn,
    `const card = ${goalRegion(parentId)};
    if (!card) throw new Error("goal card not found for " + ${J(parentId)});
    const column = card.parentElement;
    const btn = named(${J(`New ${levelWord}`)}, column)[0];
    if (!btn) throw new Error("no New ${levelWord} row beside " + ${J(parentId)});
    btn.click();`,
  );
  await sleep(200);
  await run(
    conn,
    `const input = Array.from(document.querySelectorAll('main input[data-cartograph-field="/metadata/name"]')).find((i) => !i.disabled);
    if (!input) throw new Error("inline add input not found");
    input.focus();
    setNativeValue(input, ${J(goalName)});`,
  );
  await pressEnter(conn);
  await sleep(700);
}

/** Adds a pillar through the "New goal" row at the end of the tree. */
async function inlineAddPillar(conn, name) {
  await clickNamed(conn, "New goal", { within: "main" });
  await sleep(200);
  await run(
    conn,
    `const input = document.querySelector('main input[data-cartograph-field="/metadata/name"]');
    if (!input) throw new Error("inline pillar input not found");
    input.focus();
    setNativeValue(input, ${J(name)});`,
  );
  await pressEnter(conn);
  await sleep(700);
}

async function goalShown(conn, id) {
  return Boolean(await run(conn, `return !!${goalRegion(id)};`));
}

async function goalTitle(conn, id) {
  return run(
    conn,
    `const card = ${goalRegion(id)};
    const title = card && card.querySelector('[data-cartograph-field="/metadata/name"]');
    if (!title) return { found: false };
    return { found: true, text: title.textContent.trim(), fontSize: getComputedStyle(title).fontSize };`,
  );
}

/** The key-result count a goal's card shows, by its accessible name ("1
 * key result"), or null. */
async function goalKeyResultMark(conn, id) {
  return run(
    conn,
    `const card = ${goalRegion(id)};
    const mark = card && Array.from(card.querySelectorAll("[aria-label]"))
      .map((e) => e.getAttribute("aria-label"))
      .find((l) => /^\\d+ key results?$/.test(l));
    return mark ?? null;`,
  );
}

/** Opens a step of the goal editor by its name in the step list. */
async function openGoalStep(conn, name) {
  await run(
    conn,
    `const nav = document.querySelector('[data-cartograph-region="goal-steps"]');
    if (!nav) throw new Error("goal steps not found");
    const btn = Array.from(nav.querySelectorAll("button")).find((b) => accName(b).replace(/ done$/, "") === ${J(name)});
    if (!btn) throw new Error("goal step not found: " + ${J(name)});
    btn.click();`,
  );
  await sleep(300);
}

/** The pillar, an objective under it and an outcome under that, from the
 * example (discovered through the API, never hardcoded, so this runs
 * unchanged against any vault that has a tree). */
async function goalTree() {
  const tree = await getJSON(`${baseUrl}/api/v1/goals/tree`);
  return tree.nodes ?? [];
}

/**
 * Drives Arrange and the goal editor through the real interface: under the
 * first pillar adds an objective, and under that an outcome, through the
 * inline "New" rows (title only, no dialog), clicks the new objective's
 * card to open its editor, adds a key result with a dated target on the
 * Measures step (no data source on a goal's key result: the goal is the root of the
 * tree), saves through the reason-only dialog, then confirms: the goal's
 * Measurable and Time-bound checks move from warn to ok, and Arrange shows
 * the goal with "1 key result".
 */
async function addStrategicGoalAndKeyResultFlow(conn) {
  const { problems, detach } = watchConsole(conn, { expected: isExpected404 });

  await navigateAndWait(conn, "/goals");
  if (takeShots) await captureScreenshot(conn, "goals-home.png");

  const pillar = (await goalTree())[0];
  if (!pillar) {
    problems.push("no pillar found to add an objective beneath");
    detach();
    return { problems };
  }

  const strategicGoalName = `Smoke Strategic Goal ${Date.now()}`;
  const newGoalId = slugify(strategicGoalName);
  await inlineAddGoal(conn, pillar.id, "objective", strategicGoalName);
  if (!(await goalShown(conn, newGoalId))) {
    problems.push(`created goal "${strategicGoalName}" did not appear after Enter`);
    detach();
    return { problems };
  }

  const functionalGoalName = `Smoke Functional Goal ${Date.now()}`;
  await inlineAddGoal(conn, newGoalId, "outcome", functionalGoalName);
  if (!(await goalShown(conn, slugify(functionalGoalName)))) {
    problems.push(`created outcome "${functionalGoalName}" did not appear after Enter`);
    detach();
    return { problems };
  }

  await run(
    conn,
    `const link = ${goalRegion(newGoalId)}?.querySelector('a[href="/goals/' + ${J(newGoalId)} + '"]');
    if (!link) throw new Error("goal card link not found");
    link.click();`,
  );
  await sleep(800);
  const pathname = await evalJS(conn, "location.pathname");
  if (pathname !== `/goals/${newGoalId}`) {
    problems.push(`expected navigation to /goals/${newGoalId} after clicking the new card, got ${pathname}`);
    detach();
    return { problems };
  }

  const checkState = async (id) =>
    (await getJSON(`${baseUrl}/api/v1/manifests/Goal/${newGoalId}/checks`)).find((c) => c.id === id)?.state;
  const smartChecks = ["smart-measurable", "smart-time-bound"];
  for (const check of smartChecks) {
    const state = await checkState(check);
    if (state !== "warn") problems.push(`expected ${check} warn before adding a key result, got ${state}`);
  }

  // Add a key result: a target number and its date, a unit and what
  // happens to it; direction and kind keep their defaults, the baseline
  // stays unset. The date falls inside the horizon the goal inherits.
  await openGoalStep(conn, "Measures");
  await clickNamed(conn, "Add a key result", { within: "main" });
  await sleep(300);
  const sourceFields = await run(conn, `return fieldEls("/spec/keyResults/-/source", topLayer()).length;`);
  if (sourceFields > 0) {
    problems.push("goal key result dialog showed a data source (a goal's key result never references one)");
  }
  // The editor builds one sentence out of numbered parts. The unit leads
  // the metric and the next part asks only what happens to them, so the
  // stored metric is the two halves joined.
  await setField(conn, "/spec/keyResults/-/target/value", "10", { within: "dialog" });
  await setField(conn, "/spec/keyResults/-/unit", "checks", { within: "dialog" });
  await setField(conn, "/spec/keyResults/-/metric", "completed", { within: "dialog" });
  await pickMonth(conn, "/spec/keyResults/-/target/date", 2027, "June", { within: "dialog" });
  await clickNamed(conn, "Save key result", { within: "dialog" });
  await sleep(400);

  const statement = String(await evalJS(conn, `document.querySelector('[data-slot="kr-statement"]')?.innerText ?? ""`));
  if (!statement.includes("checks completed")) {
    problems.push(`expected the new key result's statement on the page, got ${J(statement)}`);
  }
  if (!String(await evalJS(conn, "document.querySelector('main').innerText")).includes("1 of 3")) {
    problems.push('expected "1 of 3" key results shown after adding one');
  }

  // Save through the reason-only dialog: no actor picker anywhere.
  await clickNamed(conn, "Propose change", { within: "main" });
  await sleep(300);
  if (await evalJS(conn, `!!document.querySelector('[role="dialog"] [role="combobox"]')`)) {
    problems.push("goal save dialog showed a picker (there is no actor in the interface)");
  }
  await setReason(conn, "smoke test: add key result");
  await clickNamed(conn, "Save", { within: "dialog" });
  await sleep(1000);

  const saved = await getJSON(`${baseUrl}/api/v1/manifests/Goal/${newGoalId}`);
  const krs = saved.manifest?.spec?.keyResults ?? [];
  if (krs.length !== 1 || krs[0].metric !== "checks completed" || krs[0].target?.value !== 10 || krs[0].target?.date !== "2027-06") {
    problems.push(`expected one saved key result "checks completed" with target 10 by 2027-06, got ${J(krs)}`);
  }
  for (const check of smartChecks) {
    const state = await checkState(check);
    if (state !== "ok") problems.push(`expected ${check} ok after saving the key result, got ${state}`);
  }

  // Revisit the new goal's own route and Arrange.
  const routeCheck = await checkRoute(conn, `/goals/${newGoalId}`);
  problems.push(...routeCheck.problems);
  if (takeShots) await captureScreenshot(conn, "goal-editor.png");

  await navigateAndWait(conn, "/goals");
  if (!(await goalShown(conn, newGoalId))) {
    problems.push(`expected Arrange to show the new goal "${strategicGoalName}"`);
  }
  const mark = await goalKeyResultMark(conn, newGoalId);
  if (mark !== "1 key result") {
    problems.push(`expected Arrange to mark the new goal "1 key result", got ${J(mark)}`);
  }

  detach();
  return { problems, newGoalId, strategicGoalName, pillarId: pillar.id, functionalGoalName };
}

// ---------------------------------------------------------------------
// The project journey.
// ---------------------------------------------------------------------

/** A manifest's numbered versions, oldest first; none for one the vault
 * has never held. Read from the versions list rather than the manifest
 * itself, which answers with the staged working copy whenever there is
 * one. */
async function versions(kind, id) {
  const res = await fetch(`${baseUrl}/api/v1/manifests/${kind}/${id}/versions`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GET versions of ${kind}/${id} failed: ${res.status}`);
  const v = await res.json();
  return Array.isArray(v) ? v : (v.items ?? []);
}

/** Project spec as the interface last saved it: the staged working copy
 * when there is one, else the latest version. This mirrors the project
 * store's own load order. */
async function getWholeDraft(id) {
  const working = await fetch(`${baseUrl}/api/v1/manifests/Project/${id}/working`);
  if (working.ok) {
    const body = await working.json();
    return { spec: body.manifest.spec };
  }
  const current = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}`);
  return { spec: current.manifest.spec };
}

/** A full JSON deep-equal of the whole draft against the expected object
 * the caller has been maintaining, reported as a JSON diff on any mismatch
 * so a failure is legible without re-running anything. */
function diffWholeDraft(label, expected, actual) {
  const e = JSON.stringify({ spec: expected.spec }, null, 2);
  const a = JSON.stringify({ spec: actual.spec }, null, 2);
  if (e === a) return null;
  return `${label}: whole-draft mismatch after navigating\n--- expected ---\n${e}\n--- actual ---\n${a}`;
}

/** A small, dependency-free seeded PRNG (mulberry32): deterministic given
 * the same seed, so the randomised pass's own failures reproduce exactly
 * from the seed it prints. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Starts a project from /projects/new (a name and a team, nothing else)
 * and returns its id, or null with the reason pushed onto problems. */
async function startProject(conn, name, problems, label) {
  await navigateAndWait(conn, "/projects/new");
  await setField(conn, "/metadata/name", name, { within: "main" });
  await pickOption(conn, "/spec/team");
  await clickNamed(conn, "Start", { within: "main" });
  const deadline = Date.now() + 5000;
  let pathname = "";
  while (Date.now() < deadline) {
    pathname = String(await evalJS(conn, "location.pathname"));
    if (/^\/projects\/[^/]+\//.test(pathname)) break;
    await sleep(150);
  }
  const match = /^\/projects\/([^/]+)\//.exec(pathname);
  if (!match) {
    problems.push(`${label}: expected navigation to /projects/{id}/..., got ${pathname}`);
    return null;
  }
  await sleep(600);
  return match[1];
}

/** An outcome bound to an objective: the only level a project aligns to.
 * Discovered through the goal tree; one is made through the API when the
 * vault has none. */
async function findOrMakeOutcome(problems) {
  const pillars = await goalTree();
  for (const pillar of pillars) {
    for (const objective of pillar.children ?? []) {
      const outcome = (objective.children ?? []).find((c) => c.level === "outcome");
      if (outcome) return { outcome, objective, pillar };
    }
  }
  const pillar = pillars[0];
  const objective = pillar?.children?.[0];
  if (!objective) {
    problems.push("project journey: no objective to make an outcome under");
    return null;
  }
  const id = `smoke-outcome-${Date.now()}`;
  const res = await fetch(`${baseUrl}/api/v1/manifests/Goal/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: J({
      reason: "smoke: an outcome to align the journey project to",
      manifest: {
        apiVersion: "cartograph/v1",
        kind: "Goal",
        metadata: { id, name: `Smoke Outcome ${Date.now()}` },
        spec: { level: "outcome", parent: objective.id },
      },
    }),
  });
  if (!res.ok) {
    problems.push(`project journey: could not make an outcome to align to (${res.status})`);
    return null;
  }
  return { outcome: { id, name: id }, objective, pillar };
}

/**
 * The full project journey: start a project, walk every step entering the
 * minimum and reloading after each to prove nothing was lost, jump out of
 * order, leave and return, add success criteria for each moment, drive
 * the checks to zero blocking, and save a version. Never hardcodes the
 * example's own words: every reference is discovered through the API or
 * picked as the first option offered.
 */
async function projectJourneyFlow(conn, { takeShots: shots } = {}) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);

  if ((await listIds("DataSource")).length === 0) {
    problems.push("project journey: no DataSource exists to pick as a key result source");
  }
  const aligned = await findOrMakeOutcome(problems);
  if (!aligned) {
    detach();
    return { problems };
  }
  const { outcome, objective: area, pillar } = aligned;

  // Step 1: a name and a team only; the goals live on Alignment, the one
  // place a project is aligned, and that is where a new project opens.
  const projectName = `Smoke Project ${Date.now()}`;
  const id = await startProject(conn, projectName, problems, "project journey");
  if (!id) {
    detach();
    return { problems };
  }
  console.log(`smoke: project journey created ${id}`);
  const pathname = String(await evalJS(conn, "location.pathname"));
  if (!pathname.endsWith("/initiation/goals")) {
    problems.push(`project journey: a new project should open on Alignment, got ${pathname}`);
  }
  const step = (key) => `/projects/${id}/initiation/${key}`;

  /** Lets the autosave land, reloads `route`, and asserts the whole draft
   * is byte-for-byte the same before and after the reload. */
  async function afterEditReloadAndCheck(route, label) {
    await sleep(1000);
    await waitForSaved(conn);
    const before = await getWholeDraft(id);
    await navigateAndWait(conn, route);
    const after = await getWholeDraft(id);
    const diff = diffWholeDraft(label, before, after);
    if (diff) problems.push(diff);
    return after;
  }

  // Alignment: one row per outcome a project may align to, under its
  // pillar and its objective as headings. The two levels a project cannot
  // pick are not on the step at all.
  const goalsField = '[data-cartograph-field="/spec/alignment/goals"]';
  const chip = `document.querySelector('${goalsField} button[data-chip-id="' + ${J(outcome.id)} + '"]')`;
  await run(
    conn,
    `const c = ${chip};
    if (!c) throw new Error("outcome chip not found by data-chip-id");
    c.scrollIntoView({ block: "center" });
    c.click();`,
  );
  await sleep(400);
  {
    const placed = await run(
      conn,
      `const c = ${chip};
      if (!c) return null;
      return {
        text: c.innerText,
        pressed: c.getAttribute("aria-pressed"),
        area: c.closest('[data-slot="chip-area"]')?.querySelector("p")?.textContent ?? "",
        group: c.closest('[data-slot="chip-group"]')?.querySelector("h3")?.textContent ?? "",
        pickable: Array.from(document.querySelectorAll('${goalsField} button[data-chip-id]')).map((b) => b.getAttribute("data-chip-id")),
      };`,
    );
    if (!placed) {
      problems.push("alignment: the picked outcome's chip was not found");
    } else {
      if (!placed.text.includes(outcome.name)) problems.push("alignment: the chip does not carry the outcome's name");
      // The ancestry is read once per branch, as headings, never repeated
      // on the chip itself.
      if (placed.text.includes(area.name)) problems.push(`alignment: the chip repeats its objective "${area.name}"`);
      if (placed.area !== area.name) problems.push(`alignment: the chip sits under "${placed.area}", expected "${area.name}"`);
      if (placed.group.toLowerCase() !== pillar.name.toLowerCase()) {
        problems.push(`alignment: the chip sits under pillar "${placed.group}", expected "${pillar.name}"`);
      }
      if (placed.pressed !== "true") problems.push("alignment: the picked chip is not marked pressed");
      if (placed.pickable.includes(pillar.id) || placed.pickable.includes(area.id)) {
        problems.push("alignment: a pillar or an objective is offered as something to align to");
      }
    }
  }
  // Search reaches an outcome through its objective's name, which is
  // what the headings are for.
  await setNamedInput(conn, "Goal or area", area.name, { within: goalsField });
  await sleep(250);
  if (!(await run(conn, `return !!${chip};`))) problems.push("alignment: searching the objective did not keep its outcome on screen");
  let manifest = await afterEditReloadAndCheck(step("goals"), "alignment");
  if (get(manifest, "spec.alignment.goals.0") !== outcome.id) {
    problems.push(`alignment: expected alignment.goals to hold ${outcome.id}, got ${J(get(manifest, "spec.alignment.goals"))}`);
  }

  // Beneficiaries are qualitative: the step is the register as chips, one
  // click per group, and nothing counts them.
  await navigateAndWait(conn, step("beneficiaries"));
  const pickedGroup = await run(
    conn,
    `const c = field("/spec/summary/beneficiaries").querySelector("button[data-chip-id]");
    if (!c) throw new Error("no beneficiary group chip found");
    c.click();
    return c.getAttribute("data-chip-id");`,
  );
  await sleep(300);
  if (await run(conn, `return fieldEls("/spec/summary/beneficiaries/*/count").length + fieldEls("/spec/summary/beneficiaries/*/basis").length;`)) {
    problems.push("beneficiaries: the step still counts people");
  }
  manifest = await afterEditReloadAndCheck(step("beneficiaries"), "beneficiaries");
  const benLines = get(manifest, "spec.summary.beneficiaries") ?? [];
  if (benLines.length !== 1) {
    problems.push("beneficiaries: expected one beneficiary group after reload");
  } else if (benLines[0].group !== pickedGroup) {
    problems.push(`beneficiaries: expected the picked group ${pickedGroup}, got ${benLines[0].group}`);
  } else if (Object.keys(benLines[0]).length !== 1) {
    problems.push(`beneficiaries: a line should hold a group and nothing else, got ${J(benLines[0])}`);
  }

  // Problem: each problem names the groups it affects, out of the ones the
  // step before picked, and is written in parts: the situation, its
  // cause, the change and what they gain.
  await navigateAndWait(conn, step("aim"));
  if (!String(await evalJS(conn, `document.querySelector('[data-slot="context-recap"] [data-slot="context-beneficiaries"]')?.innerText ?? ""`)).trim()) {
    problems.push("problem: the step does not show the beneficiaries the problem is about");
  }
  await pickOption(conn, "/spec/summary/problems/0/groups", { value: pickedGroup });
  await pressEscape(conn);
  await sleep(200);
  await setField(conn, "/spec/summary/problems/0/problem/situation", "wait a season to learn a delivery failed");
  await setField(conn, "/spec/summary/problems/0/problem/cause", "checks happen after dispatch");
  await setField(conn, "/spec/summary/problems/0/change/what", "every delivery is checked at intake");
  await setField(conn, "/spec/summary/problems/0/change/gain", "learn of a failure the same day");
  await clickNamed(conn, "Add a mandate", { within: "main" });
  await sleep(250);
  await setField(conn, "/spec/mandate/0/title", "Smoke test mandate");
  manifest = await afterEditReloadAndCheck(step("aim"), "problem");
  {
    const line = get(manifest, "spec.summary.problems.0") ?? {};
    if (line.problem?.situation !== "wait a season to learn a delivery failed" || line.problem?.cause !== "checks happen after dispatch") {
      problems.push(`problem: the situation and its cause were not kept as parts, got ${J(line.problem)}`);
    }
    if (line.change?.what !== "every delivery is checked at intake" || line.change?.gain !== "learn of a failure the same day") {
      problems.push(`problem: the change and the gain were not kept as parts, got ${J(line.change)}`);
    }
    if (!(line.groups ?? []).includes(pickedGroup)) problems.push(`problem: the problem does not name the group ${pickedGroup}`);
  }
  if ((get(manifest, "spec.mandate") ?? []).length !== 1 || get(manifest, "spec.mandate.0.title") !== "Smoke test mandate") {
    problems.push(`problem: expected one mandate after reload, got ${J(get(manifest, "spec.mandate"))}`);
  }

  // Scope: where the project stops, with the earlier answers in view.
  await navigateAndWait(conn, step("scope"));
  if (!(await evalJS(conn, `!!document.querySelector('[data-slot="context-recap"]')`))) {
    problems.push("scope: the step does not show what the earlier steps said");
  }
  await clickNamed(conn, "Add a sentence", { within: "main", nth: 0 });
  await sleep(250);
  await setField(conn, "/spec/summary/scopeIn/0", "Everything inside the smoke test");
  manifest = await afterEditReloadAndCheck(step("scope"), "scope");
  if ((get(manifest, "spec.summary.scopeIn") ?? []).length !== 1) problems.push("scope: expected one in-scope line after reload");
  // Money belongs with the resources the project needs, not the boundary.
  if ((await run(conn, `return named("Add a funding line", document.querySelector("main")).length;`)) > 0) {
    problems.push("scope: funding should not be on the scope step");
  }

  // Objectives: the objective in two parts, one key result, then the
  // indicator the project names with the reason it names it.
  await navigateAndWait(conn, step("measures"));
  await run(
    conn,
    `const t = Array.from(field("/spec/objectives/0/objective").querySelectorAll('[role="combobox"]')).find((c) => accName(c) === "Verb");
    if (!t) throw new Error("objective verb picker not found");
    t.click();`,
  );
  await sleep(250);
  await clickNamed(conn, "Improve", { within: '[role="listbox"]' });
  await sleep(200);
  await setNamedInput(conn, "Objective", "delivery quality", { within: '[data-cartograph-field="/spec/objectives/0/objective"]' });
  await setNamedInput(conn, "Approach", "checking every delivery against one standard", {
    within: '[data-cartograph-field="/spec/objectives/0/objective"]',
  });
  await clickNamed(conn, "Add a key result", { within: "main" });
  await sleep(400);
  // The editor builds one sentence out of typed parts, in the order a
  // strong key result is spoken: how far, of what, by when, from where,
  // measured by what.
  const kr = "/spec/objectives/0/keyResults/-";
  await setField(conn, `${kr}/target/value`, "12", { within: "dialog" });
  await setField(conn, `${kr}/unit`, "checks", { within: "dialog" });
  await setField(conn, `${kr}/metric`, "completed", { within: "dialog" });
  await pickMonth(conn, `${kr}/target/date`, 2026, "December", { within: "dialog" });
  await pickRadio(conn, `${kr}/baseline`, "Not known yet", { within: "dialog" });
  await setField(conn, `${kr}/baseline/unknownReason`, "Not measured before this project", { within: "dialog" });
  await pickOption(conn, `${kr}/source`, { within: "dialog" });
  await clickNamed(conn, "Save key result", { within: "dialog" });
  await sleep(400);
  manifest = await afterEditReloadAndCheck(step("measures"), "objectives");
  if (get(manifest, "spec.objectives.0.objective") !== "Improve delivery quality by checking every delivery against one standard") {
    problems.push(`objectives: the objective's parts did not compose into one stored sentence, got ${J(get(manifest, "spec.objectives.0.objective"))}`);
  }
  if ((get(manifest, "spec.objectives.0.keyResults") ?? []).length !== 1) {
    problems.push("objectives: expected exactly one key result after reload");
  }
  if (!get(manifest, "spec.objectives.0.keyResults.0.source")) {
    problems.push("objectives: the key result did not keep the data source that measures it");
  }
  if (get(manifest, "spec.objectives.0.keyResults.0.metric") !== "checks completed") {
    problems.push(`objectives: the unit and the outcome did not compose into one metric, got ${J(get(manifest, "spec.objectives.0.keyResults.0.metric"))}`);
  }
  {
    // The saved card carries every part: what is measured, how far and by
    // when, each as itself rather than assembled into a sentence.
    const krId = get(manifest, "spec.objectives.0.keyResults.0.id");
    const card = String(await evalJS(conn, `document.querySelector('[data-cartograph-region="key-result-' + ${J(krId)} + '"]')?.innerText ?? ""`));
    if (!["checks completed", "12", "2026-12"].every((part) => card.includes(part))) {
      problems.push(`objectives: the key result card does not show every part, got ${J(card)}`);
    }
  }
  await clickNamed(conn, "Add an indicator", { within: "main" });
  await sleep(300);
  await pickOption(conn, "/spec/kpis/-/kpi", { within: "dialog" });
  await setField(conn, "/spec/kpis/-/reason", "The standard is what the rate counts", { within: "dialog" });
  await clickNamed(conn, "Add", { within: "dialog" });
  await sleep(300);
  manifest = await afterEditReloadAndCheck(step("measures"), "objectives");
  const namedKpis = get(manifest, "spec.kpis") ?? [];
  if (namedKpis.length !== 1 || !namedKpis[0].kpi || !namedKpis[0].reason) {
    problems.push(`objectives: expected one project indicator with a reason, got ${J(namedKpis)}`);
  }
  if (get(manifest, "spec.objectives.0.keyResults.0.relatesTo")) {
    problems.push("objectives: an indicator is still attached to a key result");
  }

  // Resources: the roles first, so no later step opens on an empty
  // picker. The add row's role starts at Sponsor; the project manager
  // and the service owner who takes the work over follow it.
  await navigateAndWait(conn, step("resources"));
  await clickNamed(conn, "Add a role", { within: "main" });
  await sleep(300);
  for (const roleName of ["Project manager", "Service owner"]) {
    await run(
      conn,
      `const pickers = Array.from(document.querySelectorAll('main [role="combobox"]'))
        .filter((c) => accName(c) === "Role" && !c.hasAttribute("data-cartograph-field"));
      const t = pickers[pickers.length - 1];
      if (!t) throw new Error("the add row's role picker was not found");
      t.click();`,
    );
    await sleep(250);
    await clickNamed(conn, roleName, { within: '[role="listbox"]' });
    await sleep(200);
    await clickNamed(conn, "Add a role", { within: "main" });
    await sleep(300);
  }
  await clickNamed(conn, "Add a funding line", { within: "main" });
  await sleep(250);
  await setField(conn, "/spec/funding/0/amount", "1000");
  await pickOption(conn, "/spec/funding/0/currency", { value: "USD" });
  await pickOption(conn, "/spec/funding/0/source");
  manifest = await afterEditReloadAndCheck(step("resources"), "resources");
  {
    const roles = (get(manifest, "spec.resources") ?? []).map((r) => r.role);
    for (const role of ["sponsor", "manager", "serviceOwner"]) {
      if (!roles.includes(role)) problems.push(`resources: no ${role} role in spec.resources after reload, got ${J(roles)}`);
    }
    const funding = get(manifest, "spec.funding") ?? [];
    if (funding.length !== 1 || funding[0].amount !== 1000 || funding[0].currency !== "USD" || !funding[0].source) {
      problems.push(`resources: expected one funding line of 1000 USD with a source after reload, got ${J(funding)}`);
    }
    // Accountability is decided per deliverable, never section by section.
    if ((get(manifest, "spec.resources") ?? []).some((r) => r.accountableFor)) {
      problems.push("resources: a role still carries a per-section accountability list");
    }
  }

  // Deliverables: naming the role that verifies a criterion files that
  // role in Resources without leaving this step.
  await navigateAndWait(conn, step("deliverables"));
  await clickNamed(conn, "Add a deliverable", { within: "main" });
  await sleep(300);
  await setField(conn, "/spec/deliverables/*/name", "Smoke test deliverable");
  await clickNamed(conn, "Add an acceptance criterion", { within: "main" });
  await sleep(300);
  await pickOption(conn, "/spec/deliverables/*/acceptance/0/by", { name: "Name a role" });
  await sleep(300);
  const verifierResource = await run(
    conn,
    `return topLayer()?.getAttribute("data-cartograph-region") ?? null;`,
  );
  if (verifierResource !== "dialog-name-role") problems.push(`deliverables: "Name a role" did not open its dialog, got ${verifierResource}`);
  await pickOption(conn, "/spec/resources/-/resource", { within: "dialog" });
  await clickNamed(conn, "Add", { within: "dialog" });
  await sleep(400);
  await setField(conn, "/spec/deliverables/*/acceptance/0/outcome", "signs the deliverable off as ready");
  manifest = await afterEditReloadAndCheck(step("deliverables"), "deliverables");
  if ((get(manifest, "spec.deliverables") ?? []).length !== 1) problems.push("deliverables: expected one deliverable after reload");
  {
    const criteria = get(manifest, "spec.deliverables.0.acceptance") ?? [];
    const by = criteria[0]?.by;
    if (criteria.length !== 1 || by?.local !== "resources" || !by?.id || !criteria[0].outcome) {
      problems.push(`deliverables: expected one acceptance criterion naming its verifier, got ${J(criteria)}`);
    } else if (!(get(manifest, "spec.resources") ?? []).some((r) => r.id === by.id)) {
      problems.push("deliverables: naming a verifier did not file the role in Resources");
    }
  }

  // Success criteria: one line for each moment a project is judged.
  const criteriaAt = (m, when) => (get(m, "spec.successCriteria") ?? []).filter((c) => c.when === when).length;
  async function addCriterion(nth, statement) {
    await clickNamed(conn, "Add a criterion", { within: "main", nth });
    await sleep(300);
    await setField(conn, "/spec/successCriteria/-/statement", statement, { within: "dialog" });
    await run(conn, `field("/spec/successCriteria/-/metric", topLayer()).querySelector('[role="radio"]').click();`);
    await sleep(200);
    // A measured line says the standard it clears, where it is read from
    // and how often.
    await setNamedInput(conn, "Number", "90", { within: '[role="dialog"] [data-cartograph-field="/spec/successCriteria/-/standard"]' });
    await setNamedInput(conn, "Unit", "percent", { within: '[role="dialog"] [data-cartograph-field="/spec/successCriteria/-/standard"]' });
    await pickOption(conn, "/spec/successCriteria/-/source", { within: "dialog" });
    await pickOption(conn, "/spec/successCriteria/-/cycle", { within: "dialog" });
    await pickOption(conn, "/spec/successCriteria/-/owner", { within: "dialog" });
    await pickOption(conn, "/spec/successCriteria/-/confirmedBy", { within: "dialog" });
    await clickNamed(conn, "Save criterion", { within: "dialog" });
    await sleep(400);
  }
  await navigateAndWait(conn, step("success"));
  await addCriterion(0, "The deliverable is signed off");
  await addCriterion(1, "Every depot runs the check");
  manifest = await afterEditReloadAndCheck(step("success"), "success");
  const closingCountAfterStep2 = criteriaAt(manifest, "atClosing");
  const landingCountAfterStep2 = criteriaAt(manifest, "atLanding");
  if (closingCountAfterStep2 !== 1) problems.push(`success: expected one criterion at closure, got ${closingCountAfterStep2}`);
  if (landingCountAfterStep2 !== 1) problems.push(`success: expected one criterion at handover, got ${landingCountAfterStep2}`);
  for (const c of get(manifest, "spec.successCriteria") ?? []) {
    if (c.owner?.local !== "resources" || c.confirmedBy?.local !== "resources") {
      problems.push(`success: a criterion should name the roles that track and confirm it, got ${J(c)}`);
    }
    if (c.standard !== "at least 90 percent" || !c.source || !c.cycle) {
      problems.push(`success: a criterion should keep its standard, its source and its cycle, got ${J(c)}`);
    }
  }

  // Schedule: a start month and two phases, the second moved up with the
  // keyboard through the same handle a drag uses.
  await navigateAndWait(conn, step("timeline"));
  await pickMonth(conn, "/spec/timeline/start", 2026, "January");
  await clickNamed(conn, "Add a phase", { within: "main" });
  await sleep(250);
  await setField(conn, "/spec/timeline/phases/0/name", "Foundation");
  await clickNamed(conn, "Add a phase", { within: "main" });
  await sleep(250);
  await setField(conn, "/spec/timeline/phases/1/name", "Rollout");
  await sleep(1000);
  await run(
    conn,
    `const handle = named("Reorder phase: Rollout", document.querySelector("main"))[0];
    if (!handle) throw new Error("no reorder handle on the second phase");
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));`,
  );
  manifest = await afterEditReloadAndCheck(step("timeline"), "schedule");
  if (!get(manifest, "spec.timeline.start")) problems.push("schedule: start empty after reload");
  {
    const phases = get(manifest, "spec.timeline.phases") ?? [];
    if (phases.length !== 2) {
      problems.push(`schedule: expected two phases after reload, got ${phases.length}`);
    } else if (phases[0].name !== "Rollout") {
      problems.push(`schedule: reordering did not move the second phase up, got ${J(phases.map((p) => p.name))}`);
    }
  }

  await navigateAndWait(conn, step("data"));
  await clickNamed(conn, "Add a source it reads", { within: "main" });
  await sleep(300);
  await pickOption(conn, "/spec/data/consumes/0/source");
  await setField(conn, "/spec/data/consumes/0/purpose", "Smoke test data purpose");
  manifest = await afterEditReloadAndCheck(step("data"), "data");
  if ((get(manifest, "spec.data.consumes") ?? []).length !== 1) problems.push("data: expected one consume line after reload");

  await navigateAndWait(conn, step("risks"));
  await clickNamed(conn, "Add a risk, issue, dependency, assumption or constraint", { within: "main" });
  await sleep(250);
  await setField(conn, "/spec/risks/*/description", "Smoke test risk description");
  manifest = await afterEditReloadAndCheck(step("risks"), "risks");
  if ((get(manifest, "spec.risks") ?? []).length !== 1) problems.push("risks: expected one risk after reload");

  // Closure holds what is said at the end; its criteria are the ones the
  // Success step put at closure.
  await navigateAndWait(conn, `/projects/${id}/closing`);
  await afterEditReloadAndCheck(`/projects/${id}/closing`, "closure");

  // Handover: the combobox's own first choice is "Define a new operation
  // alongside", stored as "new".
  await navigateAndWait(conn, `/projects/${id}/landing`);
  await pickOption(conn, "/spec/operation", { value: "new" });
  manifest = await afterEditReloadAndCheck(`/projects/${id}/landing`, "handover");
  if (get(manifest, "spec.operation") !== "new") problems.push("handover: expected operation 'new' after reload");

  if (shots) {
    for (const [route, file] of [
      [step("goals"), "project-goals.png"],
      [step("aim"), "project-aim.png"],
      [step("timeline"), "project-timeline.png"],
      [step("resources"), "project-people.png"],
      [step("success"), "project-closing.png"],
      [`/projects/${id}/landing`, "project-landing.png"],
      ["/projects", "project-list-draft.png"],
    ]) {
      await navigateAndWait(conn, route);
      await captureScreenshot(conn, file);
    }
  }

  // Jump out of order (Risks, Problem, Handover, Scope), editing in Risks,
  // and after every jump compare the whole draft against a running
  // expected object: it starts as whatever the steps above left, and is
  // only replaced right after a jump whose own edit has been confirmed to
  // have landed. A pure jump must reproduce the very same draft, or the
  // run fails with a JSON diff naming exactly what changed.
  let expectedWhole = await getWholeDraft(id);

  await navigateAndWait(conn, step("risks"));
  await setField(conn, "/spec/risks/*/mitigation", "Smoke test mitigation added on the jump pass");
  await sleep(1000);
  await waitForSaved(conn);
  let whole = await getWholeDraft(id);
  if (get(whole, "spec.risks.0.mitigation") !== "Smoke test mitigation added on the jump pass") {
    problems.push("jump:risks: mitigation edit did not land in the whole draft");
  }
  expectedWhole = whole;

  for (const [route, label] of [
    [step("aim"), "jump:problem"],
    [`/projects/${id}/landing`, "jump:handover"],
    [step("scope"), "jump:scope"],
  ]) {
    await navigateAndWait(conn, route);
    await sleep(300);
    const diff = diffWholeDraft(label, expectedWhole, await getWholeDraft(id));
    if (diff) problems.push(diff);
  }

  // Leave to /sheets/Resource and come back through /projects for real, by
  // the project's own link, not a direct URL: an unsaved project is
  // listed like any other.
  const beforeLeave = await getWholeDraft(id);
  await navigateAndWait(conn, "/sheets/Resource");
  await navigateAndWait(conn, "/projects");
  const linkFound = await run(
    conn,
    `const link = named(${J(`Open ${projectName}`)}, document.querySelector("main"))[0];
    if (!link) return false;
    link.click();
    return true;`,
  );
  if (!linkFound) problems.push(`leave-and-return: no link to "${projectName}" on /projects`);
  {
    // A client-side navigation: poll for the route to land.
    const deadline = Date.now() + 5000;
    let now = "";
    while (Date.now() < deadline) {
      now = String(await evalJS(conn, "location.pathname"));
      if (now === `/projects/${id}`) break;
      await sleep(150);
    }
    if (now !== `/projects/${id}`) problems.push(`leave-and-return: expected the link to land on /projects/${id}, still at ${now}`);
  }
  await sleep(500);
  {
    const diff = diffWholeDraft("leave-and-return", beforeLeave, await getWholeDraft(id));
    if (diff) problems.push(diff);
  }

  // One more criterion, for after handover.
  await navigateAndWait(conn, step("success"));
  await addCriterion(2, "Every depot still runs the check a season on");
  await sleep(800);
  await waitForSaved(conn);
  whole = await getWholeDraft(id);
  if (criteriaAt(whole, "postClosingCycle") !== 1) {
    problems.push(`success: expected one criterion after handover, got ${J(get(whole, "spec.successCriteria"))}`);
  }
  if (criteriaAt(whole, "atClosing") !== closingCountAfterStep2 || criteriaAt(whole, "atLanding") !== landingCountAfterStep2) {
    problems.push("success: adding a criterion after handover changed the others");
  }

  // Save a version from the record page, the one header action; only a
  // saved version can reach zero blocking.
  await navigateAndWait(conn, `/projects/${id}`);
  await clickNamed(conn, "Save as version");
  await sleep(300);
  if (await evalJS(conn, `!!document.querySelector('[role="dialog"] [role="combobox"]')`)) {
    problems.push("Save as version dialog showed a picker (there is no actor in the interface)");
  }
  await setReason(conn, "Smoke test full save");
  await clickNamed(conn, "Save", { within: "dialog" });
  await sleep(1200);
  if (await evalJS(conn, `!!document.querySelector('[role="dialog"]')`)) {
    problems.push(`save: the dialog stayed open: ${await evalJS(conn, `document.querySelector('[role="dialog"]').innerText`)}`);
  }

  const saved = await versions("Project", id);
  if (saved.length !== 1 || saved[0].number !== 1 || saved[0].reason !== "Smoke test full save") {
    problems.push(`save: expected version 1 with its reason after the full save, got ${J(saved)}`);
  } else {
    const v1 = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}/versions/1`);
    if (!(v1.manifest?.spec?.resources ?? []).some((r) => r.role === "sponsor")) {
      problems.push("save: expected version 1 to carry a sponsor role in spec.resources");
    }
  }
  const checksAfterFull = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}/checks`);
  if (checksAfterFull.blocking !== 0) {
    problems.push(
      `save: expected blocking 0 once every step was answered, got ${checksAfterFull.blocking}: ` +
        J(checksAfterFull.items.filter((i) => i.state === "block")),
    );
  }
  if ((await run(conn, `return named("Propose for review").length;`)) > 0) {
    problems.push('save: expected no "Propose for review" button on the record page');
  }

  // Stakeholders: a map of its own, scored from the resource catalogue.
  // Scored only once the project has a version: the map references the
  // project, and saving a version of a project the vault has never held
  // versions the map first, which the engine refuses because the project
  // it names does not exist yet.
  await navigateAndWait(conn, step("stakeholders"));
  await pickOption(conn, "/spec/entries/-");
  await pickRadio(conn, "/spec/entries/0/tier", "Primary (directly affected)");
  await afterEditReloadAndCheck(step("stakeholders"), "stakeholders");
  {
    const res = await fetch(`${baseUrl}/api/v1/manifests/StakeholderMap/${id}-stakeholders/working`);
    const entries = res.ok ? ((await res.json()).manifest?.spec?.entries ?? []) : [];
    if (entries.length !== 1) {
      problems.push(`stakeholders: expected one scored stakeholder, got ${J(entries)}`);
    } else if (entries[0].tier !== "primary") {
      problems.push(`stakeholders: the stakeholder marked primary did not keep its tier, got ${J(entries[0])}`);
    }
  }

  // Nothing overflows at 1024 or 1280: the static-route 1024 pass never
  // reaches these dynamic routes, so the journey checks its own distinct
  // layouts here (a step with the recap, a step with rows of pickers, a
  // step of dialogs, and the record page).
  for (const width of [1024, 1280]) {
    await send(conn, "Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const route of [step("aim"), step("resources"), step("success"), `/projects/${id}`]) {
      await navigateAndWait(conn, route);
      const scrollWidth = await evalJS(conn, "document.documentElement.scrollWidth");
      if (scrollWidth > width) {
        problems.push(`${route} @${width} wide: document.documentElement.scrollWidth = ${scrollWidth} > ${width}`);
      }
    }
  }
  await send(conn, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  if (shots) {
    await navigateAndWait(conn, `/projects/${id}`);
    await captureScreenshot(conn, "project-record.png");
  }

  detach();
  return { problems, id, projectName };
}

/** The charter rendered from the working copy names the project, carries
 * its sections and what the journey wrote into them, and says which plans
 * live in other tools. */
async function charterHtmlPass(id, name) {
  const problems = [];
  try {
    const res = await fetch(`${baseUrl}/api/v1/manifests/Project/${id}/charter.html?working=true`);
    if (!res.ok) {
      problems.push(`charter.html fetch failed with status ${res.status}`);
      return { problems };
    }
    const html = await res.text();
    if (!html.includes(`<h1>${name}</h1>`)) problems.push("the project's name is not the charter's heading");
    for (const heading of ["Problem statement", "Scope", "Objectives and key results", "Success criteria", "Related plans"]) {
      if (!html.includes(`<h2>${heading}</h2>`)) problems.push(`'${heading}' section heading not found in charter.html`);
    }
    // Rendered from the working copy: the mitigation the journey typed on
    // its jump pass is there.
    if (!html.includes("Smoke test mitigation added on the jump pass")) {
      problems.push("charter.html?working=true does not carry the working copy's risk mitigation");
    }
  } catch (e) {
    problems.push(`charter.html: ${e.message}`);
  }
  return { problems };
}


/** Saves a version of the journey's project from its record page and
 * checks the versions list grew; then starts a project with nothing but a
 * name and a team and tries to save a version of that. Checks never block
 * a save, but the schema does: a project whose problem has no words yet
 * is not a valid manifest, so the server refuses it, the dialog stays
 * open with the server's own message, and no version is made. */
async function saveAsVersionPass(conn, id) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);

  await navigateAndWait(conn, `/projects/${id}`);
  const initialCount = (await versions("Project", id)).length;
  await clickNamed(conn, "Save as version");
  await sleep(500);
  if (!(await evalJS(conn, `!!document.querySelector('[role="dialog"]')`))) {
    problems.push("save as version: the dialog did not open");
    detach();
    return { problems };
  }
  await setReason(conn, "smoke test save version");
  await clickNamed(conn, "Save", { within: "dialog" });
  await sleep(1000);
  const after = await versions("Project", id);
  if (after.length <= initialCount) {
    problems.push(`save as version: expected versions to grow from ${initialCount}, got ${after.length}`);
  } else if (after[after.length - 1].reason !== "smoke test save version") {
    problems.push(`save as version: the latest version does not carry the reason, got ${J(after[after.length - 1])}`);
  }
  const state = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}/state`);
  if (state.state !== "defined") problems.push(`save as version: expected state "defined", got ${J(state.state)}`);
  // The stakeholder map scored after the first version is versioned with
  // the project from here on.
  const mapVersions = await versions("StakeholderMap", `${id}-stakeholders`);
  if (mapVersions.length === 0) {
    problems.push("save as version: the project's stakeholder map was not versioned with it");
  } else if (mapVersions[mapVersions.length - 1].reason !== "smoke test save version") {
    problems.push("save as version: the stakeholder map's version does not carry the reason");
  }

  const incompleteId = await startProject(conn, `Incomplete Smoke Project ${Date.now()}`, problems, "save as version");
  if (!incompleteId) {
    detach();
    return { problems };
  }
  await clickNamed(conn, "Save as version");
  await sleep(500);
  await setReason(conn, "save an incomplete project");
  await clickNamed(conn, "Save", { within: "dialog" });
  await sleep(1000);
  const refusal = await run(
    conn,
    `const d = document.querySelector('[data-cartograph-region="dialog-save-version"]');
    return d ? Array.from(d.querySelectorAll("p.text-destructive")).map((p) => p.textContent).join(" ") : null;`,
  );
  if (refusal === null) {
    problems.push("save as version: the dialog closed on an incomplete project the schema refuses");
  } else if (!refusal.trim()) {
    problems.push("save as version: the refused save does not show the server's message");
  }
  if ((await versions("Project", incompleteId)).length !== 0) {
    problems.push("save as version: the refused incomplete project should have no version");
  }
  await pressEscape(conn);
  await sleep(200);

  detach();
  return { problems, incompleteId };
}

/** Handoff on a project whose checks block is refused, with the reason on
 * the page; on the complete, versioned project it writes the bundle. */
async function handoffPass(conn, incompleteId, completeId) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);
  try {
    await navigateAndWait(conn, `/projects/${incompleteId}/handoff`);
    await clickNamed(conn, "Hand off", { within: "main" });
    let alertText = "";
    for (let i = 0; i < 10 && !alertText.includes("Handoff refused"); i++) {
      await sleep(300);
      alertText = String(await evalJS(conn, `document.querySelector('main [role="alert"]')?.textContent ?? ""`));
    }
    if (!alertText.includes("Handoff refused")) problems.push("handoff: expected a refusal on the incomplete project");

    await navigateAndWait(conn, `/projects/${completeId}/handoff`);
    await clickNamed(conn, "Hand off", { within: "main" });
    let bundle = "";
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      bundle = String(await evalJS(conn, `document.querySelector('[data-cartograph-region="handoff-bundle"]')?.textContent ?? ""`));
      if ([".html", ".json", ".pdf"].every((ext) => bundle.includes(ext))) break;
    }
    if (!bundle.includes("charter-")) problems.push("handoff: the bundle should list the charter files");
    for (const ext of [".html", ".json", ".pdf"]) {
      if (!bundle.includes(ext)) problems.push(`handoff: the bundle should list a ${ext} file`);
    }
    const state = await getJSON(`${baseUrl}/api/v1/manifests/Project/${completeId}/state`);
    if (state.state !== "handed off") problems.push(`handoff: expected state "handed off", got ${J(state.state)}`);
  } finally {
    detach();
  }
  return { problems };
}

/** Snapshots lists the version the save pass made, with its reason and a
 * link to its diff. */
async function snapshotsPass(conn) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);
  await navigateAndWait(conn, "/snapshots");
  const row = await run(
    conn,
    `const r = Array.from(document.querySelectorAll("main table tbody tr")).find((tr) => tr.textContent.includes("smoke test save version"));
    if (!r) return null;
    return { diff: named("Diff", r).length > 0 };`,
  );
  if (!row) {
    problems.push("snapshots: no row carries the saved version's reason");
  } else if (!row.diff) {
    problems.push("snapshots: the saved version's row has no Diff link");
  }
  detach();
  return { problems };
}

/** Collapses the sidebar and repeats the journey's out-of-order jumps once
 * more, on the saved project, with zero console errors throughout. */
async function projectJourneyCollapsedJumpsPass(conn, id) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);
  await navigateAndWait(conn, `/projects/${id}`);
  await evalJS(conn, `document.querySelector('[data-slot="sidebar-trigger"]')?.click()`);
  await sleep(300);
  for (const route of [
    `/projects/${id}/initiation/risks`,
    `/projects/${id}/initiation/aim`,
    `/projects/${id}/landing`,
    `/projects/${id}/initiation/scope`,
  ]) {
    await navigateAndWait(conn, route);
  }
  await evalJS(conn, `document.querySelector('[data-slot="sidebar-trigger"]')?.click()`);
  await sleep(200);
  detach();
  return { problems };
}

// One field per step the randomised pass below can land on, each one the
// journey above has already filled, so retyping it is always possible.
// Alignment, Beneficiaries and Stakeholders are pickers with no free text,
// Closure holds only notes, and the record page and the list hold no
// field of their own: the pass navigates to those and never edits them.
const RANDOM_EDIT_FIELDS = {
  aim: "/spec/summary/problems/0/problem/situation",
  scope: "/spec/summary/scopeIn/0",
  resources: "/spec/funding/0/amount",
  deliverables: "/spec/deliverables/*/name",
  timeline: "/spec/timeline/phases/0/name",
  data: "/spec/data/consumes/0/purpose",
  risks: "/spec/risks/*/description",
};

function routeSectionKey(route) {
  const initiation = /\/initiation\/([a-z]+)$/.exec(route);
  return initiation ? initiation[1] : null;
}

/**
 * Forty random moves among every route of one project (each step, the
 * record page and the projects list), the sidebar toggled at random,
 * editing one field on arrival in roughly half the moves that land on a
 * step with an entry above, and comparing the whole draft after every
 * single move against a running expected object, the same contract as the
 * journey's jumps. Navigates with hard reloads, so a reload's own
 * persistence (not merely in-memory React state) is what is proven after
 * every move.
 */
async function projectJourneyRandomPass(conn, id, seed) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);
  const rng = mulberry32(seed);
  const routesList = [
    ...["goals", "beneficiaries", "aim", "scope", "measures", "resources", "stakeholders", "deliverables", "success", "timeline", "data", "risks"].map(
      (k) => `/projects/${id}/initiation/${k}`,
    ),
    `/projects/${id}/closing`,
    `/projects/${id}/landing`,
    `/projects/${id}`,
    "/projects",
  ];

  let expectedWhole = await getWholeDraft(id);
  let editedMoves = 0;
  const MOVES = 40;
  for (let i = 0; i < MOVES; i++) {
    const route = routesList[Math.floor(rng() * routesList.length)];
    await navigateAndWait(conn, route);
    if (rng() < 0.5) {
      await evalJS(conn, `document.querySelector('[data-slot="sidebar-trigger"]')?.click()`);
      await sleep(150);
    }
    const pointer = RANDOM_EDIT_FIELDS[routeSectionKey(route) ?? ""];
    let didEdit = false;
    if (pointer && rng() < 0.5) {
      try {
        const value = pointer.endsWith("/amount") ? String(1000 + i) : `Random move ${i} edit, seed ${seed}`;
        await setField(conn, pointer, value);
        didEdit = true;
        editedMoves++;
      } catch (e) {
        problems.push(`random pass seed ${seed}, move ${i} (${route}): edit attempt failed: ${e.message}`);
      }
    }
    if (didEdit) {
      // Past the debounce, so this move's own edit is the new baseline.
      await sleep(1000);
      await waitForSaved(conn);
      expectedWhole = await getWholeDraft(id);
    } else {
      await sleep(300);
      const diff = diffWholeDraft(`random pass seed ${seed}, move ${i} (${route})`, expectedWhole, await getWholeDraft(id));
      if (diff) problems.push(diff);
    }
  }
  detach();
  return { problems, editedMoves, moves: MOVES, seed };
}

/** Renames a goal on its own card: click the title, type, Enter. */
async function renameOnCard(conn, goalId, next) {
  await run(
    conn,
    `const title = ${goalRegion(goalId)}?.querySelector('[data-cartograph-field="/metadata/name"]');
    if (!title) throw new Error("title not found to rename on " + ${J(goalId)});
    title.click();`,
  );
  await sleep(200);
  await run(
    conn,
    `const input = document.activeElement;
    if (!input || input.tagName !== "INPUT" || input.getAttribute("data-cartograph-field") !== "/metadata/name") {
      throw new Error("rename input not focused");
    }
    setNativeValue(input, ${J(next)});`,
  );
  await pressEnter(conn);
  await sleep(700);
}

/** Moves a goal through its card's "Move to", picking the new parent by
 * its name. */
async function moveOnCard(conn, goalId, parentName) {
  await goalMenu(conn, goalId, "Move to");
  await clickNamed(conn, parentName, { within: '[role="listbox"]' });
  await sleep(700);
}

/** Deletes a goal through its card's menu, giving the reason the confirm
 * dialog asks for. Returns the text of a refusal if one is shown. */
async function deleteOnCard(conn, goalId, reason) {
  await goalMenu(conn, goalId, "Delete");
  await run(
    conn,
    `const d = document.querySelector('[data-cartograph-region="delete-goal"]');
    if (!d) throw new Error("delete confirmation did not open for " + ${J(goalId)});
    const input = d.querySelector("input");
    if (!input) throw new Error("reason input not found in the delete confirmation");
    setNativeValue(input, ${J(reason)});`,
  );
  await sleep(200);
  await run(
    conn,
    `const d = document.querySelector('[data-cartograph-region="delete-goal"]');
    const btn = named("Delete", d).find((b) => !b.disabled);
    if (!btn) throw new Error("Delete is not enabled after giving a reason");
    btn.click();`,
  );
  await sleep(800);
  return String(await evalJS(conn, `document.querySelector('[data-cartograph-region="delete-refused"]')?.textContent ?? ""`));
}

async function dismissAlert(conn) {
  await evalJS(conn, `document.querySelector('[role="alertdialog"] [data-slot="alert-dialog-action"], [role="alertdialog"] button')?.click()`);
  await sleep(300);
}

/**
 * Goals mutability, all through Arrange: add two pillars, add two
 * objectives under the first, rename one inline, move the other to the
 * second pillar, delete it and recover it from Snapshots, attempt to
 * delete a goal a project aligns to and see the refusal, add, rename and
 * move an outcome, attempt to delete an objective that still has an
 * outcome, drag the objective with a key result to a third pillar (its
 * manifest keeps everything but its parent), and drop an outcome on a
 * pillar column (refused before any request, since a goal keeps its
 * level). Zero console errors throughout.
 */
async function goalsMutabilityPass(conn, goalWithKRId) {
  const { problems, detach } = watchConsoleForGoalsMutability(conn);

  await send(conn, "Network.enable", {});
  const pendingRequests = new Map();
  const goalWrites = [];
  const onNetworkEvent = (msg) => {
    if (msg.method === "Network.requestWillBeSent") {
      const req = msg.params.request;
      if (req.url.includes("/manifests/Goal/") && req.method !== "GET") {
        pendingRequests.set(msg.params.requestId, { method: req.method, url: req.url.split("?")[0] });
      }
    }
    if (msg.method === "Network.responseReceived") {
      const req = pendingRequests.get(msg.params.requestId);
      if (req) goalWrites.push({ ...req, status: msg.params.response.status });
      pendingRequests.delete(msg.params.requestId);
    }
  };
  conn.listeners.add(onNetworkEvent);
  const goalManifest = async (id) => getJSON(`${baseUrl}/api/v1/manifests/Goal/${id}`);

  try {
    await navigateAndWait(conn, "/goals");

    // 1: two pillars.
    const pillarAName = `Smoke Pillar A ${Date.now()}`;
    const pillarBName = `Smoke Pillar B ${Date.now()}`;
    const pillarAId = slugify(pillarAName);
    const pillarBId = slugify(pillarBName);
    for (const [name, pid] of [[pillarAName, pillarAId], [pillarBName, pillarBId]]) {
      await inlineAddPillar(conn, name);
      if (!(await goalShown(conn, pid))) problems.push(`pillar "${name}" did not appear after Enter`);
    }

    // 2: two objectives under pillar A.
    const stratOneName = `Smoke Strategic One ${Date.now()}`;
    const stratTwoName = `Smoke Strategic Two ${Date.now()}`;
    const stratOneId = slugify(stratOneName);
    const stratTwoId = slugify(stratTwoName);
    await inlineAddGoal(conn, pillarAId, "objective", stratOneName);
    await inlineAddGoal(conn, pillarAId, "objective", stratTwoName);
    for (const [name, gid] of [[stratOneName, stratOneId], [stratTwoName, stratTwoId]]) {
      if (!(await goalShown(conn, gid))) problems.push(`objective "${name}" did not appear`);
    }

    // 3: rename the first inline; one write, to that goal, and the id
    // stays what it was.
    goalWrites.length = 0;
    const renamedName = `${stratOneName} Renamed`;
    await renameOnCard(conn, stratOneId, renamedName);
    if (await evalJS(conn, `!!document.querySelector('[data-cartograph-region="rename-refused"]')`)) {
      problems.push(`rename refused: ${await evalJS(conn, `document.querySelector('[data-cartograph-region="rename-refused"]').textContent`)}`);
      await dismissAlert(conn);
    }
    const afterRename = await goalTitle(conn, stratOneId);
    if (afterRename.text !== renamedName) problems.push(`renamed objective shows ${J(afterRename.text)}, expected ${J(renamedName)}`);
    if ((await goalManifest(stratOneId)).manifest?.metadata?.name !== renamedName) {
      problems.push("the rename did not reach the goal's manifest");
    }
    const renameWrites = goalWrites.filter((w) => w.status < 300);
    if (renameWrites.length !== 1 || !renameWrites[0].url.endsWith(`/Goal/${stratOneId}`)) {
      problems.push(`the rename should write that goal once, wrote ${J(goalWrites)}`);
    }

    // 4: move the second objective to pillar B through "Move to"; the card
    // reads the same after it moves.
    const beforeStrategicMove = await goalTitle(conn, stratTwoId);
    await moveOnCard(conn, stratTwoId, pillarBName);
    const afterStrategicMove = await goalTitle(conn, stratTwoId);
    if ((await goalManifest(stratTwoId)).manifest?.spec?.parent !== pillarBId) {
      problems.push(`objective "${stratTwoName}" is not under pillar B after the move`);
    }
    if (!afterStrategicMove.found) {
      problems.push(`objective "${stratTwoName}" missing from the page after moving`);
    } else if (afterStrategicMove.text !== beforeStrategicMove.text || afterStrategicMove.fontSize !== beforeStrategicMove.fontSize) {
      problems.push(`the moved objective's card changed: ${J(beforeStrategicMove)} -> ${J(afterStrategicMove)}`);
    }

    // 5: delete it (now unreferenced). The confirm asks for a reason; the
    // goal is excluded rather than erased, and Snapshots recovers it.
    const deleteReason = "smoke test leaf goal cleanup";
    const refusedLeaf = await deleteOnCard(conn, stratTwoId, deleteReason);
    if (refusedLeaf) problems.push(`deleting an unreferenced objective was refused: ${refusedLeaf}`);
    const excluded = await getJSON(`${baseUrl}/api/v1/vault/excluded`);
    const entry = excluded.find((e) => e.id === stratTwoId && e.kind === "Goal");
    if (!entry) {
      problems.push("the deleted objective is not in the excluded list");
    } else if (entry.reason !== deleteReason) {
      problems.push(`the deleted objective was excluded with reason ${J(entry.reason)}, expected ${J(deleteReason)}`);
    }
    const gone = await fetch(`${baseUrl}/api/v1/manifests/Goal/${stratTwoId}`);
    if (gone.status !== 404) {
      problems.push(`expected GET Goal/${stratTwoId} to return 404 after delete, got ${gone.status}`);
    } else if (!J(await gone.json()).includes("recover to restore")) {
      problems.push("the 404 for a deleted goal should say it can be recovered");
    }
    await navigateAndWait(conn, "/snapshots");
    await run(
      conn,
      `const btn = named("Recover", document.querySelector("main")).find((b) => b.closest("tr, li, div")?.textContent.includes(${J(stratTwoName)}));
      if (!btn) throw new Error("Recover not found for the deleted objective");
      btn.click();`,
    );
    await sleep(800);
    await navigateAndWait(conn, "/goals");
    if (!(await goalShown(conn, stratTwoId))) problems.push("the deleted objective is not back on Arrange after recovering it");

    // 6: a goal a project aligns to cannot be deleted; the refusal names
    // what references it, and the goal survives.
    let referencedGoal = null;
    for (const gid of await listIds("Goal")) {
      const refs = await getJSON(`${baseUrl}/api/v1/manifests/Goal/${gid}/references`);
      if ((refs.incoming ?? []).some((r) => r.kind === "Project")) {
        referencedGoal = gid;
        break;
      }
    }
    if (!referencedGoal) {
      problems.push("no goal referenced by a Project found to attempt a blocked delete on");
    } else {
      const refusal = await deleteOnCard(conn, referencedGoal, "smoke: attempt a blocked delete");
      if (!refusal.includes("cannot be deleted")) {
        problems.push(`expected a refusal naming what references ${referencedGoal}, got ${J(refusal)}`);
      }
      await dismissAlert(conn);
      const still = await fetch(`${baseUrl}/api/v1/manifests/Goal/${referencedGoal}`);
      if (still.status !== 200) problems.push(`the referenced goal did not survive the refused delete: ${still.status}`);
    }

    // 7: an outcome under the renamed objective, renamed, then moved to a
    // new objective under pillar B; its card reads the same after.
    await navigateAndWait(conn, "/goals");
    const functionalGoalName = `Smoke Functional Goal ${Date.now()}`;
    const functionalId = slugify(functionalGoalName);
    const renamedFunctionalName = `${functionalGoalName} Renamed`;
    await inlineAddGoal(conn, stratOneId, "outcome", functionalGoalName);
    if (!(await goalShown(conn, functionalId))) problems.push(`outcome "${functionalGoalName}" did not appear after inline add`);
    await renameOnCard(conn, functionalId, renamedFunctionalName);
    const beforeMove = await goalTitle(conn, functionalId);
    if (beforeMove.text !== renamedFunctionalName) problems.push(`renamed outcome shows ${J(beforeMove.text)}`);

    const pillarBStrategicName = `Smoke Strategic B ${Date.now()}`;
    const pillarBStrategicId = slugify(pillarBStrategicName);
    await inlineAddGoal(conn, pillarBId, "objective", pillarBStrategicName);
    if (!(await goalShown(conn, pillarBStrategicId))) problems.push(`objective "${pillarBStrategicName}" under pillar B did not appear`);
    await moveOnCard(conn, functionalId, pillarBStrategicName);
    const afterMove = await goalTitle(conn, functionalId);
    if ((await goalManifest(functionalId)).manifest?.spec?.parent !== pillarBStrategicId) {
      problems.push("the outcome is not under its new objective after the move");
    }
    if (!afterMove.found) {
      problems.push("the outcome's card is missing after the move");
    } else if (afterMove.text !== beforeMove.text || afterMove.fontSize !== beforeMove.fontSize) {
      problems.push(`the moved outcome's card changed: ${J(beforeMove)} -> ${J(afterMove)}`);
    }

    // 8: the objective now holds that outcome, so deleting it is refused.
    const refusalForChild = await deleteOnCard(conn, pillarBStrategicId, "smoke: attempt to remove a goal with a child");
    if (!refusalForChild.includes("cannot be deleted")) {
      problems.push(`expected a refusal when deleting an objective with an outcome, got ${J(refusalForChild)}`);
    }
    await dismissAlert(conn);

    // 9: drag the objective with a key result onto a third pillar's
    // column. Its manifest keeps everything but its parent, and its card
    // keeps reading "1 key result".
    const pillarCName = `Smoke Pillar C ${Date.now()}`;
    const pillarCId = slugify(pillarCName);
    await inlineAddPillar(conn, pillarCName);
    await navigateAndWait(conn, "/goals");
    if (!goalWithKRId) {
      problems.push("no objective with a key result was passed to the mutability pass");
    } else {
      const manifestBeforeDrag = await goalManifest(goalWithKRId);
      const beforeDrag = await goalTitle(conn, goalWithKRId);
      if ((await goalKeyResultMark(conn, goalWithKRId)) !== "1 key result") {
        problems.push('the objective with a key result did not show "1 key result" before the drag');
      }
      const dropOn = (selectorJs, gid, level) =>
        run(
          conn,
          `const target = ${selectorJs};
          if (!target) throw new Error("drop target not found");
          const dataTransfer = new DataTransfer();
          dataTransfer.setData("text/cartograph-goal-id", ${J(gid)});
          dataTransfer.setData("text/cartograph-goal-level-" + ${J(level)}, ${J(level)});
          target.dispatchEvent(new DragEvent("dragenter", { dataTransfer, bubbles: true, cancelable: true }));
          target.dispatchEvent(new DragEvent("dragover", { dataTransfer, bubbles: true, cancelable: true }));
          target.dispatchEvent(new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }));`,
        );
      const columnOf = (pid) => `(${goalRegion(pid)})?.closest('[data-slot="pillar-column"]')`;
      await dropOn(columnOf(pillarCId), goalWithKRId, "objective");
      await sleep(1200);
      const manifestAfterDrag = await goalManifest(goalWithKRId);
      if (manifestAfterDrag.manifest?.spec?.parent !== pillarCId) {
        problems.push(`the dragged objective is not under pillar C, parent is ${manifestAfterDrag.manifest?.spec?.parent}`);
      }
      const stripParent = (spec) => {
        const { parent: _parent, ...rest } = spec ?? {};
        return rest;
      };
      if (J(stripParent(manifestBeforeDrag.manifest?.spec)) !== J(stripParent(manifestAfterDrag.manifest?.spec))) {
        problems.push(
          `the dragged objective's spec changed beyond its parent: ${J(manifestBeforeDrag.manifest?.spec)} -> ${J(manifestAfterDrag.manifest?.spec)}`,
        );
      }
      const afterDrag = await goalTitle(conn, goalWithKRId);
      if (!afterDrag.found) {
        problems.push("the dragged objective's card is missing after the drag");
      } else if (afterDrag.text !== beforeDrag.text || afterDrag.fontSize !== beforeDrag.fontSize) {
        problems.push(`the dragged objective's card changed: ${J(beforeDrag)} -> ${J(afterDrag)}`);
      }
      if ((await goalKeyResultMark(conn, goalWithKRId)) !== "1 key result") {
        problems.push("the dragged objective's card lost its key result count");
      }

      // 10: an outcome dropped on a pillar column is refused before any
      // request is sent: a goal keeps its level.
      const writesBefore = goalWrites.length;
      const outcomeBefore = await goalManifest(functionalId);
      await dropOn(columnOf(pillarCId), functionalId, "outcome");
      await sleep(800);
      const levelRefusal = String(await evalJS(conn, `document.querySelector('[data-cartograph-region="move-refused"]')?.textContent ?? ""`));
      if (!levelRefusal.includes('is level "goal", not "objective"')) {
        problems.push(`expected the level refusal after dropping an outcome on a pillar column, got ${J(levelRefusal)}`);
      }
      await dismissAlert(conn);
      if (goalWrites.length !== writesBefore) {
        problems.push(`dropping an outcome on a pillar column sent ${goalWrites.length - writesBefore} writes, expected none`);
      }
      if (J((await goalManifest(functionalId)).manifest?.spec) !== J(outcomeBefore.manifest?.spec)) {
        problems.push("the outcome changed after the refused drop on a pillar column");
      }
    }
    return { problems };
  } finally {
    conn.listeners.delete(onNetworkEvent);
    detach();
  }
}

/**
 * Collapsed-sidebar pass: over every given route, clicks the sidebar
 * trigger to collapse it, then asserts nothing inside the rail is painted
 * outside the rail's own box. This compares each visible element's real
 * getBoundingClientRect() against the rail's own rect, rather than
 * scrollWidth against clientWidth: a display:none child can still leave
 * its flex-gap neighbour's scrollWidth a few px over clientWidth with
 * nothing actually overflowing on screen, which a scrollWidth check would
 * wrongly flag; a bounding-box check catches only genuine visible spill,
 * which is what the original bug looked like (the header text staying
 * visible over the mark and the trigger).
 */
async function collapsedSidebarPass(conn, routesToCheck) {
  const { problems, detach } = watchConsole(conn, { expected: isExpected404 });
  for (const route of routesToCheck) {
    await navigateAndWait(conn, route);
    await evalJS(conn, `document.querySelector('[data-slot="sidebar-trigger"]')?.click()`);
    await sleep(300);
    const result = await evalJS(
      conn,
      `(() => {
        const rail = document.querySelector('[data-sidebar="sidebar"]');
        if (!rail) return { noRail: true, items: [] };
        const railRect = rail.getBoundingClientRect();
        const items = [];
        for (const el of rail.querySelectorAll("*")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.right > railRect.right + 1 || rect.left < railRect.left - 1) {
            items.push({
              tag: el.tagName,
              cls: (el.className || "").toString().slice(0, 60),
              text: (el.textContent || "").trim().slice(0, 30),
            });
          }
        }
        return { noRail: false, items };
      })()`,
    );
    if (result.noRail) {
      problems.push(`${route}: collapsed sidebar rail not found`);
      continue;
    }
    if (result.items.length > 0) {
      problems.push(`${route}: collapsed sidebar has visible overflow: ${J(result.items)}`);
    }
    if (route === "/" && takeShots) await captureScreenshot(conn, "home-collapsed.png");
    // Re-expand so every route starts from the same state (the cookie the
    // sidebar writes on toggle would otherwise carry the collapsed state
    // into the next route's hard navigation).
    await evalJS(conn, `document.querySelector('[data-slot="sidebar-trigger"]')?.click()`);
    await sleep(200);
  }
  detach();
  return { problems };
}

/**
 * 1024-wide pass: over every given route at a 1024-wide viewport, asserts
 * document.documentElement.scrollWidth never exceeds 1024 (no horizontal
 * scroll on the body). Also covers the goal editor, and a Sheet with the
 * rail collapsed too.
 */
async function wideAt1024Pass(conn, routesToCheck, goalRoute) {
  const { problems, detach } = watchConsole(conn, { expected: isExpected404 });
  await send(conn, "Emulation.setDeviceMetricsOverride", { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });

  for (const route of [...routesToCheck, ...(goalRoute ? [goalRoute] : [])]) {
    await navigateAndWait(conn, route);
    const scrollWidth = await evalJS(conn, "document.documentElement.scrollWidth");
    if (scrollWidth > 1024) {
      problems.push(`${route} @1024 wide: document.documentElement.scrollWidth = ${scrollWidth} > 1024`);
    }
    if (route === goalRoute && takeShots) await captureScreenshot(conn, "goal-editor-1024.png", 1024, 900);
  }

  await navigateAndWait(conn, "/sheets/Resource");
  await evalJS(conn, `document.querySelector('[data-slot="sidebar-trigger"]')?.click()`);
  await sleep(300);
  const swCollapsed = await evalJS(conn, "document.documentElement.scrollWidth");
  if (swCollapsed > 1024) {
    problems.push(`/sheets/Resource @1024 wide, collapsed: scrollWidth ${swCollapsed} > 1024`);
  }
  if (takeShots) await captureScreenshot(conn, "sheets-1024-collapsed.png", 1024, 900);
  await evalJS(conn, `document.querySelector('[data-slot="sidebar-trigger"]')?.click()`);
  await sleep(200);

  // Restore the standard viewport for whatever runs after this.
  await send(conn, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  detach();
  return { problems };
}

/**
 * Keyboard-only pass: Tab from a blank focus state through Arrange's real
 * tab order until the first "New objective" row is reached (nothing on the
 * way is reachable only by mouse, or this loop runs out before finding
 * it), Enter reveals its inline input with focus inside it, Escape closes
 * it back to the button. Tab uses CDP's "rawKeyDown", which matches a real
 * browser's focus movement; Enter uses "keyDown" with a carriage-return
 * text payload, which is the event shape a button's default action needs.
 */
async function keyboardPass(conn) {
  const { problems, detach } = watchConsole(conn, { expected: isExpected404 });
  await navigateAndWait(conn, "/goals");
  await evalJS(conn, "document.body.focus()");

  // The budget is a ceiling, not a target: what this pass asserts is that
  // the row is reachable by Tab at all, and the tree it sits in grows
  // every time the example does. It is derived from the page itself, so
  // it stays honest as the tree grows.
  const focusableCount = await evalJS(
    conn,
    `document.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])').length`,
  );
  const budget = Math.max(40, Number(focusableCount) + 10);
  let found = false;
  let lastFocused = "";
  for (let i = 0; i < budget && !found; i++) {
    await send(conn, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send(conn, "Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await sleep(20);
    lastFocused = String(await run(conn, `return document.activeElement ? accName(document.activeElement) : "";`)).slice(0, 60);
    if (lastFocused === "New objective") found = true;
  }
  if (!found) {
    problems.push(
      `keyboard: could not Tab to "New objective" within ${budget} tab presses (${focusableCount} focusable elements on the page; focus ended on "${lastFocused}")`,
    );
    detach();
    return { problems };
  }

  await pressEnter(conn);
  await sleep(300);
  const focusedIsInput = await evalJS(conn, `document.activeElement.getAttribute("data-cartograph-field") === "/metadata/name" && document.activeElement.tagName === "INPUT"`);
  if (!focusedIsInput) {
    problems.push('keyboard: Enter on the focused "New objective" row did not reveal (and focus) its inline input');
    detach();
    return { problems };
  }

  await pressEscape(conn);
  await sleep(300);
  if (await evalJS(conn, `document.activeElement.tagName === "INPUT"`)) {
    problems.push("keyboard: Escape did not close the inline input back to the button");
  }

  detach();
  return { problems };
}

/**
 * Against a vault with nothing in it: a Team through the ordinary Sheet
 * dialog (name and reason, no actor picker), then a pillar, an objective
 * and an outcome through Arrange's inline "New" rows (title only, Enter to
 * save, no dialog). Zero console errors throughout is the point of the
 * test, not an afterthought.
 */
async function bootstrapFlow(conn) {
  const { problems, detach } = watchConsole(conn, { expected: isExpected404 });

  await navigateAndWait(conn, "/sheets/Team");
  const teamName = `Bootstrap Team ${Date.now()}`;
  await clickNamed(conn, "Add", { within: "main" });
  await sleep(300);
  if (await evalJS(conn, `!!document.querySelector('[role="dialog"] [role="combobox"]:not([data-cartograph-field])')`)) {
    problems.push("Team create dialog showed a picker that edits no field (there is no actor in the interface)");
  }
  await setField(conn, "/metadata/name", teamName, { within: "dialog" });
  await setReason(conn, "bootstrap smoke: create team");
  await run(conn, `topLayer().querySelector('button[type="submit"]').click();`);
  await sleep(1000);
  if (!String(await evalJS(conn, "document.body.innerText")).includes(teamName)) {
    problems.push(`created Team "${teamName}" did not appear after submit`);
  }

  await navigateAndWait(conn, "/goals");
  const pillarName = `Bootstrap Pillar ${Date.now()}`;
  await inlineAddPillar(conn, pillarName);
  if (!(await goalShown(conn, slugify(pillarName)))) problems.push(`created pillar "${pillarName}" did not appear after Enter`);

  const strategicName = `Bootstrap Strategic ${Date.now()}`;
  await inlineAddGoal(conn, slugify(pillarName), "objective", strategicName);
  if (!(await goalShown(conn, slugify(strategicName)))) problems.push(`created objective "${strategicName}" did not appear after Enter`);

  const functionalName = `Bootstrap Functional ${Date.now()}`;
  await inlineAddGoal(conn, slugify(strategicName), "outcome", functionalName);
  if (!(await goalShown(conn, slugify(functionalName)))) problems.push(`created outcome "${functionalName}" did not appear after Enter`);

  detach();
  return { problems, teamName, pillarName, strategicName, functionalName };
}

/** Prints a flow's problems, or its line of success; returns whether it
 * failed. */
function report(label, result, okLine) {
  if (result.problems.length > 0) {
    console.error(`smoke: ${label} had problems:`);
    for (const p of result.problems) console.error(`  - ${p}`);
    return true;
  }
  console.log(`smoke: ${okLine}`);
  return false;
}

async function main() {
  console.log(`smoke: waiting for the Cartograph server at ${baseUrl}`);
  await waitForHTTP(baseUrl + "/api/v1/health", 10_000);

  console.log(`smoke: launching ${chromiumPath} with CDP on :${cdpPort}`);
  const chromium = launchChromium();
  try {
    await waitForHTTP(`http://127.0.0.1:${cdpPort}/json/version`, 10_000);
    const versionInfo = await (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json();
    const browserConn = await connectCDP(versionInfo.webSocketDebuggerUrl);
    const { targetId } = await send(browserConn, "Target.createTarget", { url: "about:blank" });
    const { webSocketDebuggerUrl } = (await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()).find(
      (t) => t.id === targetId,
    );
    const pageConn = await connectCDP(webSocketDebuggerUrl);
    await send(pageConn, "Page.enable");
    await send(pageConn, "Runtime.enable");
    await send(pageConn, "Log.enable");
    await send(pageConn, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    let failed = false;
    const finish = async () => {
      await send(browserConn, "Target.closeTarget", { targetId });
      pageConn.ws.close();
      browserConn.ws.close();
      chromium.kill();
      if (failed) {
        console.error("smoke failed");
        process.exit(1);
      }
      console.log("smoke ok");
      process.exit(0);
    };

    if (bootstrapOnly) {
      console.log("smoke: bootstrap mode, empty vault: creating a Team, then a pillar, an objective and an outcome");
      const b = await bootstrapFlow(pageConn);
      failed = report(
        "bootstrap flow",
        b,
        `bootstrap flow ok: created Team "${b.teamName}", pillar "${b.pillarName}", objective "${b.strategicName}", outcome "${b.functionalName}", zero console errors`,
      );
      await finish();
    }

    for (const route of routes) {
      console.log(`smoke: loading ${route}`);
      const { problems, bodyText } = await checkRoute(pageConn, route);
      failed = report(route, { problems }, `${route} ok, zero console errors`) || failed;
      if (bodyText.trim() === "") {
        failed = true;
        console.error(`smoke: ${route} rendered no visible text`);
      }
    }

    console.log("smoke: driving one create and one edit through the Resource sheet dialog");
    const flow = await resourceCreateEditFlow(pageConn);
    failed = report("Resource create/edit flow", flow, "Resource create/edit flow ok, zero console errors") || failed;
    {
      const id = slugify(flow.createdName);
      const res = await fetch(`${baseUrl}/api/v1/manifests/Resource/${id}`);
      if (!res.ok) {
        failed = true;
        console.error(`smoke: GET Resource/${id} returned ${res.status}`);
      } else {
        const view = await res.json();
        if (view.version?.number !== 2) {
          failed = true;
          console.error(`smoke: expected Resource/${id} at version 2 after the edit, got ${J(view.version)}`);
        } else if (view.manifest?.metadata?.name !== flow.editedName || view.manifest?.spec?.category !== "facility") {
          failed = true;
          console.error(`smoke: expected Resource/${id} to carry the edited name and category, got ${J(view.manifest)}`);
        } else {
          console.log(`smoke: Resource/${id} is at version 2 with the edited name and category, as expected`);
        }
      }
    }

    console.log("smoke: driving Arrange and the goal editor: add an objective and an outcome, add a key result, save");
    const goalFlow = await addStrategicGoalAndKeyResultFlow(pageConn);
    failed =
      report(
        "goal flow",
        goalFlow,
        `goal flow ok: created "${goalFlow.strategicGoalName}" (${goalFlow.newGoalId}), added a key result, Measurable and Time-bound moved from warn to ok, Arrange shows 1 key result`,
      ) || failed;

    console.log("smoke: driving the project journey: start, every step, jumps, leave and return, save");
    const projectFlow = await projectJourneyFlow(pageConn, { takeShots });
    failed =
      report(
        "project journey",
        projectFlow,
        `project journey ok: created ${projectFlow.id}, every step kept after reload, blocking reached 0, saved as version 1`,
      ) || failed;

    if (projectFlow.id) {
      console.log("smoke: save as version pass: save the complete project again, then try an incomplete one");
      const saveResult = await saveAsVersionPass(pageConn, projectFlow.id);
      failed =
        report("save as version pass", saveResult, "save as version pass ok, the complete project versioned, the incomplete one refused with the server's message") ||
        failed;

      console.log("smoke: snapshots pass: the saved version is listed with its reason");
      failed = report("snapshots pass", await snapshotsPass(pageConn), "snapshots pass ok, the saved version is listed with a Diff link") || failed;

      if (saveResult.incompleteId) {
        console.log("smoke: handoff pass: refused on the incomplete project, a bundle for the complete one");
        const handoff = await handoffPass(pageConn, saveResult.incompleteId, projectFlow.id);
        failed = report("handoff pass", handoff, "handoff pass ok, the incomplete project was refused, the complete one handed off with its bundle") || failed;
      }

      console.log("smoke: charter pass: the working copy's charter.html names the project and its sections");
      failed =
        report("charter pass", await charterHtmlPass(projectFlow.id, projectFlow.projectName), "charter pass ok, the name, the sections and the working copy's words") ||
        failed;
    }

    // After the project journey, not before: the blocked delete needs a
    // goal a project aligns to, and the journey's project is one.
    console.log("smoke: goals mutability pass: pillars, objectives, rename, move, delete and recover, blocked deletes, drag");
    const mutability = await goalsMutabilityPass(pageConn, goalFlow.newGoalId);
    failed = report("goals mutability pass", mutability, "goals mutability pass ok, zero console errors") || failed;

    if (projectFlow.id) {
      console.log("smoke: project journey with the sidebar collapsed: the jumps once more");
      const collapsedJumps = await projectJourneyCollapsedJumpsPass(pageConn, projectFlow.id);
      failed = report("collapsed-jumps pass", collapsedJumps, "collapsed-jumps pass ok, zero console errors") || failed;

      const seed = Number(process.env.CARTOGRAPH_SMOKE_SEED ?? 20260918);
      console.log(`smoke: project journey randomised navigation pass, 40 moves, seed = ${seed}`);
      const randomPass = await projectJourneyRandomPass(pageConn, projectFlow.id, seed);
      failed =
        report(
          `randomised pass (seed ${seed})`,
          randomPass,
          `randomised pass ok, seed ${seed}, ${randomPass.moves} moves (${randomPass.editedMoves} edited), zero console errors, whole draft identical after every unedited move`,
        ) || failed;
    }

    console.log("smoke: collapsed-sidebar pass over every route");
    failed = report("collapsed-sidebar pass", await collapsedSidebarPass(pageConn, routes), "collapsed-sidebar pass ok over every route, zero visible overflow") || failed;

    console.log("smoke: 1024-wide pass over every route, plus the goal editor and a Sheet collapsed");
    const wide = await wideAt1024Pass(pageConn, routes, goalFlow.newGoalId ? `/goals/${goalFlow.newGoalId}` : undefined);
    failed = report("1024-wide pass", wide, "1024-wide pass ok, no horizontal scroll on any route") || failed;

    console.log('smoke: keyboard-only pass, Arrange to "New objective"');
    failed =
      report("keyboard pass", await keyboardPass(pageConn), 'keyboard pass ok, Tab reached "New objective", Enter revealed its inline input, Escape closed it') ||
      failed;

    await finish();
  } catch (err) {
    chromium.kill();
    throw err;
  }
}

main().catch((err) => {
  console.error("smoke: unexpected error:", err);
  process.exit(1);
});

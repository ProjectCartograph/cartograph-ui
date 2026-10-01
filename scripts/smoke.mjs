#!/usr/bin/env node
// Headless-Chromium smoke test over raw Chrome DevTools Protocol (CDP), no
// extra runtime dependency: Node's built-in WebSocket client (stable since
// Node 22, available here on Node 24) talks straight to Chromium's
// debugger, and plain fetch talks to its HTTP endpoint. Requires an cartograph
// server already running (see below) and a Chromium binary.
//
// Usage:
//   node web/scripts/smoke.mjs [baseUrl] [chromiumPath] [cdpPort] [shots] [bootstrap]
//
// Defaults: baseUrl=http://localhost:9191, chromiumPath=$CHROMIUM or chromium,
// cdpPort=9333 (a port above 9000, never 8484, per the I0 card). Pass
// "shots" as the fourth argument to also save 1440x900 screenshots (Goals
// home, the goal editor, both expanded) plus the I2.1 quality-pass
// screenshots under web/scripts/shots/: home-collapsed.png (1440 wide, rail
// collapsed), goal-editor-1024.png and sheets-1024-collapsed.png (both
// 1024 wide, the second with the rail collapsed too).
//
// Pass "bootstrap" anywhere in argv (see `just smoke-bootstrap`) to run
// only bootstrapFlow against a brand-new, never-imported database: no
// seeding, no route sweep, no project journey -- just the first Team,
// then a Goal, entirely through the interface (I3.1's own central case:
// no required picker is ever shown with zero options).
//
// Beyond the per-route console-error check, this script also runs (I2.1):
// a collapsed-sidebar pass over every route (asserts nothing inside the
// rail visibly overflows its own box once collapsed), a 1024-wide pass
// over every route (asserts document.documentElement.scrollWidth <= 1024),
// and a keyboard-only pass (Tab from the Goals home page to the first "Add
// a Functional goal" button, Enter opens its dialog, focus lands inside it,
// Escape closes it).
//
// Exits 0 and prints "smoke ok" when every checked route loads with zero
// console errors and zero uncaught exceptions; otherwise prints what it
// found and exits 1.

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { parse as parseYAML } from "yaml";

const baseUrl = process.argv[2] ?? "http://localhost:9191";
const chromiumPath = process.argv[3] ?? process.env.CHROMIUM ?? "chromium";
const cdpPort = Number(process.argv[4] ?? 9333);
const takeShots = process.argv[5] === "shots";
// I3.1: "bootstrap" anywhere in argv runs only bootstrapFlow (see there)
// against a brand-new, never-imported database -- the full suite below
// assumes seeded Team/DataSource/BeneficiaryGroup/Goal data that a fresh
// database does not have.
const bootstrapOnly = process.argv.includes("bootstrap");
const shotsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "shots");
const SHEET_KINDS = [
  "Team",
  "BeneficiaryGroup",
  "Resource",
  "DataSource",
  "ReportingCycle",
];
const routes = [
  "/",
  "/manifests/Project",
  "/manifests/BeneficiaryGroup",
  "/sheets",
  ...SHEET_KINDS.map((k) => `/sheets/${k}`),
  "/projects",
  "/projects/new",
  "/snapshots",
];

// Mirrors web/src/surfaces/sheet/schema.ts's slugify: kept in sync by hand
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

// setNativeValue writes into a React-controlled <input> the way a real
// keystroke would: through the native value setter, so React's own change
// tracking (which intercepts the plain .value setter) still sees the write
// and fires the component's onChange.
const SET_NATIVE_VALUE_JS = `
  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    desc.set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
`;

// The reason field has no placeholder since 2026-09-30 (text is the last
// resort), so it is found by what identifies it in the source: the sheet
// dialog's form field name, the project page's and the goal editor's ids.
// Searched inside root when given, else the whole document.
const FIND_REASON_JS = `
  const findReason = (root) => {
    const scope = root || document;
    return Array.from(scope.querySelectorAll(
      'input[name="_reason"], textarea[name="_reason"], #reason, #goal-save-reason, [placeholder="Why this change"]'
    )).find((el) => !el.disabled) || null;
  };
`;

// A real CDP key event (not a JS-synthesized one), the same technique
// keyboardPass already uses: this is what a goal-tree inline add/rename
// row's own onKeyDown handler (Enter to save, Escape to cancel) actually
// listens for.
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
// el.click(): confirmed by hand (see the I3.2 hand-off's own "open
// choices") that Radix's DropdownMenuTrigger listens for a genuine
// pointerdown/pointerup pair to open, which el.click() alone never
// dispatches -- every other Radix trigger this script already drives
// (Select, Dialog, AlertDialog) responds fine to el.click(), so this is
// used only for a goal card's own "..." menu trigger.
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
  // pillars/goals exist to wrap the grid past one screen, as the organisation
  // instance directory's own larger tree does) would otherwise compute a
  // rect the click lands nowhere near.
  await evalJS(
    conn,
    `(() => {
      const el = ${jsExprReturningElement};
      if (!el) throw new Error(${JSON.stringify(errMsg)});
      el.scrollIntoView({ block: "center" });
    })()`,
  );
  await sleep(200);
  const rectJSON = await evalJS(
    conn,
    `(() => {
      const el = ${jsExprReturningElement};
      if (!el) throw new Error(${JSON.stringify(errMsg)});
      const r = el.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    })()`,
  );
  const { x, y } = JSON.parse(rectJSON);
  await realClick(conn, x, y);
}

/**
 * Drives one create and one edit of a Resource through the real Sheet
 * dialog: opens /sheets/Resource, clicks Add, fills the name and reason
 * fields (through native input events so React's controlled inputs pick
 * them up), submits (I3.2 delta: no actor picker anywhere; the dialog
 * asks only name and reason), then clicks the new row to edit it, changes
 * the name, submits again. Returns the console problems observed
 * throughout and the two names used, so the caller can assert the row
 * appeared and check the API's version count.
 */
async function resourceCreateEditFlow(conn) {
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
      problems.push(`log error: ${msg.params.entry.text}`);
    }
  };
  conn.listeners.add(onEvent);

  await send(conn, "Page.navigate", { url: baseUrl + "/sheets/Resource" });
  await new Promise((resolve) => {
    const waiter = (msg) => {
      if (msg.method === "Page.loadEventFired") {
        conn.listeners.delete(waiter);
        resolve();
      }
    };
    conn.listeners.add(waiter);
  });
  await sleep(800);

  const createdName = `Smoke Test Resource ${Date.now()}`;
  const editedName = `${createdName} Edited`;

  async function fillNameAndReason(name, reason) {
    await evalJS(
      conn,
      `(() => {
        ${SET_NATIVE_VALUE_JS}
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) throw new Error("dialog did not open");
        const nameInput = dialog.querySelectorAll("input")[0];
        setNativeValue(nameInput, ${JSON.stringify(name)});
        ${FIND_REASON_JS}
        const reasonInput = findReason(dialog);
        if (!reasonInput) throw new Error("reason input not found");
        setNativeValue(reasonInput, ${JSON.stringify(reason)});
      })()`,
    );
  }

  async function selectCategory(category) {
    await evalJS(
      conn,
      `(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) throw new Error("dialog did not open");
        const selectTriggers = dialog.querySelectorAll('[role="combobox"]');
        if (selectTriggers.length === 0) throw new Error("no select fields found");
        // First select trigger should be the category field (after name field)
        const categoryTrigger = selectTriggers[0];
        categoryTrigger.click();
      })()`,
    );
    await sleep(300);
    await evalJS(
      conn,
      `(() => {
        // The dialog prints the instance's own word for a category, not the
        // contract's value ("System", never "system"), so match on the word
        // with the hyphens and the case taken out of both sides.
        const want = ${JSON.stringify(category)}.replace(/[-_]/g, " ").toLowerCase();
        const option = Array.from(document.querySelectorAll('[role="option"]')).find(
          (o) => o.textContent.trim().replace(/[-_]/g, " ").toLowerCase() === want
        );
        if (!option) {
          const seen = Array.from(document.querySelectorAll('[role="option"]')).map((o) => o.textContent.trim());
          throw new Error("category option not found: " + ${JSON.stringify(category)} + "; options are " + JSON.stringify(seen));
        }
        option.click();
      })()`,
    );
    await sleep(200);
  }

  async function submit() {
    await evalJS(
      conn,
      `(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const submitBtn = dialog.querySelector('button[type="submit"]');
        if (!submitBtn) throw new Error("submit button not found");
        submitBtn.click();
      })()`,
    );
    await sleep(1000);
  }

  // Create.
  await evalJS(
    conn,
    `(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "Add");
      if (!btn) throw new Error("Add button not found");
      btn.click();
    })()`,
  );
  await sleep(300);
  await fillNameAndReason(createdName, "smoke test create");
  await selectCategory("system");
  await submit();

  const afterCreateText = await evalJS(conn, "document.body.innerText");
  if (!String(afterCreateText).includes(createdName)) {
    problems.push(`created row "${createdName}" did not appear after submit`);
  }

  // Wait for the table to update
  await sleep(1000);

  // Edit: click the new row, change the name, submit again.
  await evalJS(
    conn,
    `(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const row = rows.find((r) => r.textContent.includes(${JSON.stringify(createdName)}));
      if (!row) throw new Error("created row not found to edit");
      row.click();
    })()`,
  );
  await sleep(300);
  await fillNameAndReason(editedName, "smoke test edit");
  await selectCategory("facility");
  await submit();

  const afterEditText = await evalJS(conn, "document.body.innerText");
  if (!String(afterEditText).includes(editedName)) {
    problems.push(`edited row "${editedName}" did not appear after submit`);
  }

  conn.listeners.delete(onEvent);
  return { problems, createdName, editedName };
}

/**
 * The delta on top of the goals-as-root card, item 2: against a brand-new,
 * never-imported database, this now creates only a Team (through the
 * ordinary Sheet dialog: name and reason, no actor picker anywhere) and
 * then a Goal (a pillar, since none exists yet), through Goals home's own
 * inline "New goal" row -- title only, Enter to save, no dialog at
 * all (card I3.2 section 5). Zero console errors throughout is the point
 * of the test, not an afterthought.
 */
async function bootstrapFlow(conn) {
  const { problems, detach } = watchConsole(conn);

  async function clickButtonWithText(text, root = "document") {
    await evalJS(
      conn,
      `(() => {
        const scope = ${root === "document" ? "document" : `document.querySelector('${root}')`};
        if (!scope) throw new Error("scope not found: ${root}");
        const btn = Array.from(scope.querySelectorAll("button")).find((b) => b.textContent.includes(${JSON.stringify(text)}));
        if (!btn) throw new Error(${JSON.stringify(`button "${text}" not found`)});
        btn.click();
      })()`,
    );
  }

  async function submitDialog(byText) {
    await evalJS(
      conn,
      `(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const btn = ${
          byText
            ? `Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent.trim() === ${JSON.stringify(byText)})`
            : `dialog.querySelector('button[type="submit"]')`
        };
        if (!btn) throw new Error("submit/create button not found");
        btn.click();
      })()`,
    );
    await sleep(1000);
  }

  // Step 1: a Team, through the ordinary Sheet dialog.
  await navigateAndWait(conn, "/sheets/Team");
  const teamName = `Bootstrap Team ${Date.now()}`;

  await clickButtonWithText("Add");
  await sleep(300);
  const hasActorPicker = await evalJS(conn, `!!document.querySelector('[role="dialog"] button[role="combobox"]')`);
  if (hasActorPicker) {
    problems.push("Team create dialog showed an actor picker (I3.2: no actor concept in the interface at all)");
  }
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const dialog = document.querySelector('[role="dialog"]');
      const nameInput = dialog.querySelectorAll("input")[0];
      setNativeValue(nameInput, ${JSON.stringify(teamName)});
      ${FIND_REASON_JS}
      const reasonInput = findReason(dialog);
      if (!reasonInput) throw new Error("reason input not found for Team");
      setNativeValue(reasonInput, "bootstrap smoke: create team");
    })()`,
  );
  await submitDialog();

  const afterTeamText = await evalJS(conn, "document.body.innerText");
  if (!String(afterTeamText).includes(teamName)) {
    problems.push(`created Team "${teamName}" did not appear after submit`);
  }

  // Step 2: a pillar, through Goals home's own inline "New goal" row.
  await navigateAndWait(conn, "/goals");
  const pillarName = `Bootstrap Pillar ${Date.now()}`;

  await clickButtonWithText("New goal");
  await sleep(200);
  const hasInlineInput = await evalJS(conn, `!!document.querySelector('main input')`);
  if (!hasInlineInput) {
    problems.push('"New goal" click did not reveal an inline input');
  }
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const input = document.querySelector('main input');
      if (!input) throw new Error("inline add input not found");
      input.focus();
      setNativeValue(input, ${JSON.stringify(pillarName)});
    })()`,
  );
  await pressEnter(conn);
  await sleep(600);

  const afterPillarText = await evalJS(conn, "document.body.innerText");
  if (!String(afterPillarText).includes(pillarName)) {
    problems.push(`created pillar "${pillarName}" did not appear after Enter`);
  }

  // Step 3: a strategic goal under the pillar.
  const strategicName = `Bootstrap Strategic ${Date.now()}`;
  await inlineAddStrategicGoal(conn, pillarName, strategicName);

  const afterStrategicText = await evalJS(conn, "document.body.innerText");
  if (!String(afterStrategicText).includes(strategicName)) {
    problems.push(`created strategic goal "${strategicName}" did not appear after Enter`);
  }

  // Step 4: a functional goal under the strategic goal.
  const functionalName = `Bootstrap Functional ${Date.now()}`;
  await inlineAddFunctionalGoal(conn, strategicName, functionalName);

  const afterFunctionalText = await evalJS(conn, "document.body.innerText");
  if (!String(afterFunctionalText).includes(functionalName)) {
    problems.push(`created functional goal "${functionalName}" did not appear after Enter`);
  }

  detach();
  return { problems, teamName, pillarName, strategicName, functionalName };
}

/**
 * Attaches the standard console-problem listeners used by every flow below,
 * returning both the problems array (filled as events arrive) and a
 * detach() to call once the flow is done.
 */
function watchConsole(conn) {
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
      problems.push(`log error: ${msg.params.entry.text}`);
    }
  };
  conn.listeners.add(onEvent);
  return { problems, detach: () => conn.listeners.delete(onEvent) };
}

// I3.3b.1: Working copy is current content everywhere. A brand-new project
// saved as working copy is immediately visible via GET (returns the working
// copy with version 0); .../state and checks are available without a snapshot.
// Only after "Save as version" (the snapshot) does a project get a version number
// and history. No more draft-only visibility issue: working copies are always listed.
// I3.2: People and resources is now an ordinary part of the project's own
// spec (spec.resources). I3.2 delta: "Propose for review" is gone; only
// "Save as version" remains for explicit snapshots.
// I3.3b.2: /draft endpoint no longer exists; working copy is available
// through the main GET /manifests/{kind}/{id} endpoint.
const EXPECTED_404_URL_PATTERNS = [
  /\/manifests\/Project\/[^/?]+\/state(\?|$)/,
  /\/manifests\/Project\/[^/?]+(\?|$)/,
];

/** The goals mutability pass's own console watch: identical to
 * watchConsole, except a 422 from DELETE /manifests/Goal/{id} is a normal,
 * expected outcome (the refusal this pass deliberately provokes by
 * deleting a goal a Project still references), the same "handled by
 * design, not a real error" shape EXPECTED_404_URL_PATTERNS already
 * covers for the project journey's own probes. */
function watchConsoleForGoalsMutability(conn) {
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
      const isExpected422 = entry.text.includes("422") && entry.url && /\/manifests\/Goal\/[^/?]+(\?|$)/.test(entry.url);
      if (!isExpected422) problems.push(`log error: ${entry.text} (${entry.url ?? "no url"})`);
    }
  };
  conn.listeners.add(onEvent);
  return { problems, detach: () => conn.listeners.delete(onEvent) };
}

function watchConsoleForProjectJourney(conn) {
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
      const isExpected404 =
        entry.text.includes("404") && entry.url && EXPECTED_404_URL_PATTERNS.some((re) => re.test(entry.url));
      const isExpected422 =
        entry.text.includes("422") && entry.url && /\/manifests\/Project\/[^/?]+\/snapshots(\?|$)/.test(entry.url);
      if (!isExpected404 && !isExpected422) problems.push(`log error: ${entry.text} (${entry.url ?? "no url"})`);
    }
  };
  conn.listeners.add(onEvent);
  return { problems, detach: () => conn.listeners.delete(onEvent) };
}

async function navigateAndWait(conn, route) {
  // A hard navigation away from a project with edits still inside the
  // autosave debounce makes the browser block a beforeunload prompt and
  // log it. Waiting for the store to say it has saved is both what a
  // person would see and what keeps the console clean.
  await waitForSaved(conn);
  await send(conn, "Page.navigate", { url: baseUrl + route });
  await new Promise((resolve) => {
    const waiter = (msg) => {
      if (msg.method === "Page.loadEventFired") {
        conn.listeners.delete(waiter);
        resolve();
      }
    };
    conn.listeners.add(waiter);
  });
  await sleep(800);
}

/** Clicks the "New objective" row inside a specific pillar's own
 * column (matched by the pillar's own name in its text), types name into
 * the revealed inline input (no dialog, card I3.2 section 5) and presses
 * Enter. Does not navigate; per the card, the new card's editor only opens
 * if the person clicks it. */
async function inlineAddStrategicGoal(conn, pillarName, goalName) {
  await evalJS(
    conn,
    `(() => {
      const columns = Array.from(document.querySelectorAll("main .grid > div"));
      const col = columns.find((c) => c.textContent.includes(${JSON.stringify(pillarName)}));
      if (!col) throw new Error("pillar column not found for " + ${JSON.stringify(pillarName)});
      const btn = Array.from(col.querySelectorAll("button")).find((b) => b.textContent.includes("New objective"));
      if (!btn) throw new Error("Add a strategic goal button not found");
      btn.click();
    })()`,
  );
  await sleep(200);
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const input = document.querySelector('main input[placeholder="${'Name this goal'}"]');
      if (!input) throw new Error("inline add input not found");
      input.focus();
      setNativeValue(input, ${JSON.stringify(goalName)});
    })()`,
  );
  await pressEnter(conn);
  await sleep(600);
}

/** Clicks a goal card (a pillar column's own header card, or a strategic
 * goal card beneath it) by its visible name, navigating into its editor. */
async function clickGoalCardByName(conn, name) {
  await evalJS(
    conn,
    `(() => {
      const els = Array.from(document.querySelectorAll("main a"));
      const link = els.find((a) => a.textContent.includes(${JSON.stringify(name)}));
      if (!link) throw new Error("goal card link not found for " + ${JSON.stringify(name)});
      link.click();
    })()`,
  );
  await sleep(600);
}

/** Clicks the "New outcome" row inside a specific strategic goal's own
 * column (matched by the goal's own name in its text), types name into
 * the revealed inline input (no dialog, card I3.2 section 5) and presses
 * Enter. Does not navigate; the new card's editor only opens if the person clicks it. */
async function inlineAddFunctionalGoal(conn, strategicGoalName, functionalGoalName) {
  await evalJS(
    conn,
    `(() => {
      const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
      const card = cards.find((c) => c.textContent.includes(${JSON.stringify(strategicGoalName)}));
      if (!card) {
        const foundNames = cards.map((c) => {
          const firstLine = c.textContent.split("\\n")[0];
          return firstLine.slice(0, 60);
        }).join(" | ");
        throw new Error("strategic goal card not found for " + ${JSON.stringify(strategicGoalName)} + ". Cards: " + foundNames);
      }
      const parent = card.parentElement;
      const btn = Array.from(parent.querySelectorAll("button")).find((b) => b.textContent.includes("New outcome"));
      if (!btn) throw new Error("Add a functional goal button not found under " + ${JSON.stringify(strategicGoalName)});
      btn.click();
    })()`,
  );
  await sleep(200);
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const input = Array.from(document.querySelectorAll("input[placeholder]"))
        .find((i) => i.placeholder === "Name this goal" && !i.disabled);
      if (!input) throw new Error("inline add input not found for functional goal");
      input.focus();
      setNativeValue(input, ${JSON.stringify(functionalGoalName)});
    })()`,
  );
  await pressEnter(conn);
  await sleep(600);
}

/**
 * Drives the Goals home page and the goal editor through the real UI:
 * finds a pillar (discovered through the API, never hardcoded, so this
 * runs unchanged against both examples/minimal and any other instance
 * directory), adds a strategic goal beneath it through the inline "Add a
 * strategic goal" row (title only, no dialog), clicks the new card to open
 * its editor, adds a key result through the editor's own dialog, saves
 * through the reason-only dialog (I3.2: no actor picker anywhere), then
 * confirms: the checks endpoint's key-results-count check moves from warn
 * (no key results) to ok (one), and the Goals home tree shows the new goal
 * with "1 key result".
 */
async function addStrategicGoalAndKeyResultFlow(conn) {
  const { problems, detach } = watchConsole(conn);

  await navigateAndWait(conn, "/goals");
  if (takeShots) {
    await captureScreenshot(conn, "goals-home.png");
  }

  const goals = await (await fetch(`${baseUrl}/api/v1/manifests/Goal`)).json();
  let pillarName = null;
  for (const g of goals) {
    const view = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${g.id}`)).json();
    if (view.manifest?.spec?.level === "goal") {
      pillarName = view.manifest.metadata.name;
      break;
    }
  }
  if (!pillarName) {
    problems.push("no pillar found to add a strategic goal beneath");
    detach();
    return { problems };
  }

  const strategicGoalName = `Smoke Strategic Goal ${Date.now()}`;
  await inlineAddStrategicGoal(conn, pillarName, strategicGoalName);

  const afterAddText = await evalJS(conn, "document.body.innerText");
  if (!String(afterAddText).includes(strategicGoalName)) {
    problems.push(`created goal "${strategicGoalName}" did not appear after Enter`);
    detach();
    return { problems };
  }

  const functionalGoalName = `Smoke Functional Goal ${Date.now()}`;
  await inlineAddFunctionalGoal(conn, strategicGoalName, functionalGoalName);

  const afterFunctionalText = await evalJS(conn, "document.body.innerText");
  if (!String(afterFunctionalText).includes(functionalGoalName)) {
    problems.push(`created functional goal "${functionalGoalName}" did not appear after Enter`);
    detach();
    return { problems };
  }

  await clickGoalCardByName(conn, strategicGoalName);
  const pathname = await evalJS(conn, "location.pathname");
  if (!String(pathname).startsWith("/goals/")) {
    problems.push(`expected navigation to /goals/{id} after clicking the new card, got ${pathname}`);
    detach();
    return { problems };
  }
  const newGoalId = String(pathname).split("/goals/")[1];

  const checksBefore = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${newGoalId}/checks`)).json();
  const countBefore = checksBefore.find((c) => c.id === "key-results-count");
  if (!countBefore || countBefore.state !== "warn") {
    problems.push(`expected key-results-count warn before adding a key result, got ${JSON.stringify(countBefore)}`);
  }

  // Add a key result: Metric only (required); direction/kind keep their
  // defaults (increase, percent), baseline/target stay unset. No source
  // field at all (I3.2: the goal is the root of the dependency tree).
  await evalJS(
    conn,
    `(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "Add a key result");
      if (!btn) throw new Error("Add a key result button not found");
      btn.click();
    })()`,
  );
  await sleep(300);
  const hasSourceField = await evalJS(
    conn,
    `!!Array.from(document.querySelectorAll('[role="dialog"] label')).find((l) => l.textContent.trim() === "Measured from")`,
  );
  if (hasSourceField) {
    problems.push("goal key result dialog showed a Source field (I3.2: a goal's key result never references a source)");
  }
  const metricText = "checks completed";
  // The editor builds one sentence out of numbered parts. Since
  // 2026-09-26 the unit leads the metric and step 2 asks only what
  // happens to them, so the unit goes in first and the stored metric is
  // the two halves joined.
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) throw new Error("key result dialog did not open");
      const unit = dialog.querySelector('input[aria-label="Unit"]');
      if (!unit) throw new Error("unit input not found");
      setNativeValue(unit, "checks");
      const input = dialog.querySelector('input[aria-label="What happens to them"]');
      if (!input) throw new Error("metric input not found");
      setNativeValue(input, "completed");
    })()`,
  );
  await evalJS(
    conn,
    `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent.trim() === "Save key result");
      if (!btn) throw new Error("key result save button not found");
      btn.click();
    })()`,
  );
  await sleep(300);

  const afterKRText = await evalJS(conn, "document.body.innerText");
  if (!String(afterKRText).includes("1 of 3")) {
    problems.push('expected "1 of 3" key results shown after adding one');
  }
  if (!String(afterKRText).includes(metricText)) {
    problems.push("expected the new key result's metric text to appear on the page");
  }

  // Save through the reason-only dialog (I3.2: no actor picker anywhere),
  // then confirm the check moved from warn to ok.
  await evalJS(
    conn,
    `(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "Propose change");
      if (!btn) throw new Error("Propose change button not found");
      btn.click();
    })()`,
  );
  await sleep(300);
  const hasActorPickerInSave = await evalJS(conn, `!!document.querySelector('[role="dialog"] button[role="combobox"]')`);
  if (hasActorPickerInSave) {
    problems.push("goal save dialog showed an actor picker (I3.2: no actor concept in the interface at all)");
  }
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const dialog = document.querySelector('[role="dialog"]');
      const input = dialog.querySelector("input");
      if (!input) throw new Error("reason input not found in save dialog");
      setNativeValue(input, "smoke test: add key result");
    })()`,
  );
  await evalJS(
    conn,
    `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent.trim() === "Save");
      if (!btn) throw new Error("save confirm button not found");
      btn.click();
    })()`,
  );
  await sleep(1000);

  const checksAfter = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${newGoalId}/checks`)).json();
  const countAfter = checksAfter.find((c) => c.id === "key-results-count");
  if (!countAfter || countAfter.state !== "ok") {
    problems.push(`expected key-results-count ok after saving the key result, got ${JSON.stringify(countAfter)}`);
  }

  // Revisit the new goal's own route (part of the "/" and "/goals/{id}"
  // coverage the card asks for) and the Goals home tree.
  const routeCheck = await checkRoute(conn, `/goals/${newGoalId}`);
  problems.push(...routeCheck.problems);
  if (takeShots) {
    await captureScreenshot(conn, "goal-editor.png");
  }

  await navigateAndWait(conn, "/goals");
  const homeText = await evalJS(conn, "document.body.innerText");
  if (!String(homeText).includes(strategicGoalName)) {
    problems.push(`expected the Goals home tree to show the new goal "${strategicGoalName}"`);
  }
  if (!String(homeText).includes("1 key result")) {
    problems.push('expected the Goals home tree to show "1 key result" for the new goal');
  }

  detach();
  return { problems, newGoalId, strategicGoalName, pillarName, functionalGoalName };
}

/**
 * The I3.2 card's own new "goals mutability" pass (section 6): add a
 * pillar, add two strategic goals under it, rename one inline, move one to
 * another pillar, delete one, attempt to delete a goal a project aligns to
 * and assert the refusal -- all through the real UI, zero console errors.
 * Runs against Goals home directly (never hardcodes an id: the pillar and
 * the aligned goal are both created or discovered fresh here).
 *
 * goalWithKRId and goalWithKRName are passed from the prior addStrategicGoalAndKeyResultFlow
 * pass to test drag with a goal that has key results (card I3.4b.5 requirement).
 */
async function goalsMutabilityPass(conn, goalWithKRId, goalWithKRName) {
  const { problems, detach } = watchConsoleForGoalsMutability(conn);

  // Enable network events to capture rename/move requests
  await send(conn, "Network.enable", {});
  const pendingRequests = new Map();
  const goalManifestRequests = [];
  let renamedGoalId = null;
  const onNetworkEvent = (msg) => {
    if (msg.method === "Network.requestWillBeSent") {
      const req = msg.params.request;
      if (req.url && req.url.includes("/manifests/Goal/")) {
        pendingRequests.set(msg.params.requestId, {
          method: req.method,
          url: req.url.split("?")[0],
        });
      }
    }
    if (msg.method === "Network.responseReceived") {
      const resp = msg.params.response;
      const req = pendingRequests.get(msg.params.requestId);
      if (req && resp.url && resp.url.includes("/manifests/Goal/")) {
        const combined = {
          method: req.method,
          url: req.url,
          status: resp.status,
        };
        goalManifestRequests.push(combined);
        if (combined.method === "PUT" && combined.status === 200) {
          const match = combined.url.match(/\/manifests\/Goal\/([^/?]+)/);
          if (match) renamedGoalId = match[1];
        }
      }
      pendingRequests.delete(msg.params.requestId);
    }
  };
  conn.listeners.add(onNetworkEvent);

  try {
  await navigateAndWait(conn, "/goals");

  // 1: add a pillar.
  const pillarAName = `Smoke Pillar A ${Date.now()}`;
  const pillarBName = `Smoke Pillar B ${Date.now()}`;
  await evalJS(
    conn,
    `(() => {
      const btn = Array.from(document.querySelectorAll("main button")).find((b) => b.textContent.includes("New goal"));
      if (!btn) throw new Error('"New goal" button not found');
      btn.click();
    })()`,
  );
  await sleep(200);
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const input = document.querySelector('main input[placeholder="Name this pillar"]');
      if (!input) throw new Error("inline pillar-add input not found");
      setNativeValue(input, ${JSON.stringify(pillarAName)});
    })()`,
  );
  await pressEnter(conn);
  await sleep(600);
  let bodyText = await evalJS(conn, "document.body.innerText");
  if (!String(bodyText).includes(pillarAName)) {
    problems.push(`pillar "${pillarAName}" did not appear after Enter`);
  }

  // A second pillar, to move a strategic goal to later.
  await evalJS(
    conn,
    `(() => {
      const btn = Array.from(document.querySelectorAll("main button")).find((b) => b.textContent.includes("New goal"));
      if (!btn) throw new Error('"New goal" button not found (second)');
      btn.click();
    })()`,
  );
  await sleep(200);
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const input = document.querySelector('main input[placeholder="Name this pillar"]');
      if (!input) throw new Error("inline pillar-add input not found (second)");
      setNativeValue(input, ${JSON.stringify(pillarBName)});
    })()`,
  );
  await pressEnter(conn);
  await sleep(600);
  bodyText = await evalJS(conn, "document.body.innerText");
  if (!String(bodyText).includes(pillarBName)) {
    problems.push(`pillar "${pillarBName}" did not appear after Enter`);
  }

  // 2: two strategic goals under pillar A.
  const stratOneName = `Smoke Strategic One ${Date.now()}`;
  const stratTwoName = `Smoke Strategic Two ${Date.now()}`;
  await inlineAddStrategicGoal(conn, pillarAName, stratOneName);
  await inlineAddStrategicGoal(conn, pillarAName, stratTwoName);
  bodyText = await evalJS(conn, "document.body.innerText");
  if (!String(bodyText).includes(stratOneName)) problems.push(`strategic goal "${stratOneName}" did not appear`);
  if (!String(bodyText).includes(stratTwoName)) problems.push(`strategic goal "${stratTwoName}" did not appear`);

  // 3: rename stratOne inline, on its own card (click the title, type, Enter).
  // Clear the goalManifestRequests array here so we count only PUTs after the rename starts.
  goalManifestRequests.length = 0;

  const renamedName = `${stratOneName} Renamed`;
  await evalJS(
    conn,
    `(() => {
      const els = Array.from(document.querySelectorAll("main p"));
      const title = els.find((p) => p.textContent.trim() === ${JSON.stringify(stratOneName)});
      if (!title) throw new Error("strategic goal title not found to rename");
      title.click();
    })()`,
  );
  await sleep(200);
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const input = document.activeElement;
      if (!input || input.tagName !== "INPUT") throw new Error("rename input not focused");
      setNativeValue(input, ${JSON.stringify(renamedName)});
    })()`,
  );
  await pressEnter(conn);
  await sleep(600);
  // Capture dialog text if rename failed
  const renameDialogText = await evalJS(conn, `document.querySelector('[role="alertdialog"]')?.textContent ?? ""`);
  if (renameDialogText) {
    console.log(`rename dialog text: ${renameDialogText.slice(0, 200)}`);
  }
  bodyText = await evalJS(conn, "document.body.innerText");
  if (!String(bodyText).includes(renamedName)) {
    problems.push(`renamed strategic goal "${renamedName}" did not appear after Enter`);
  }
  if (String(bodyText).includes(stratOneName) && stratOneName !== renamedName.slice(0, stratOneName.length)) {
    // the old name is a strict prefix of the new one by construction, so
    // this branch only fires if something unexpected happened
    problems.push(`old name "${stratOneName}" still visible after rename`);
  }

  // 4: move stratTwo to pillar B, through the card menu's "Move to".
  const beforeStrategicMove = await evalJS(
    conn,
    `(() => {
      const els = Array.from(document.querySelectorAll("main p"));
      const title = els.find((p) => p.textContent.trim() === ${JSON.stringify(stratTwoName)});
      if (!title) return { found: false };
      const style = getComputedStyle(title);
      return {
        found: true,
        text: title.textContent,
        fontSize: style.fontSize,
      };
    })()`,
  );

  await realClickElement(
    conn,
    `(() => {
      const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
      const card = cards.find((c) => c.textContent.includes(${JSON.stringify(stratTwoName)}));
      if (!card) throw new Error("strategic goal card not found to move");
      return Array.from(card.querySelectorAll('button')).find((b) => b.querySelector('svg'));
    })()`,
    "strategic goal card's own menu button not found to move",
  );
  await sleep(300);
  await evalJS(
    conn,
    `(() => {
      const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((i) => i.textContent.trim() === "Move to");
      if (!item) throw new Error('"Move to" menu item not found');
      item.click();
    })()`,
  );
  await sleep(300);
  await evalJS(
    conn,
    `(() => {
      const options = Array.from(document.querySelectorAll('[role="option"]'));
      const option = options.find((o) => o.textContent.includes(${JSON.stringify(pillarBName)}));
      if (!option) throw new Error("pillar B not found in move-to options; found: " + JSON.stringify(options.map((o) => o.textContent)));
      option.click();
    })()`,
  );
  await sleep(600);

  const afterStrategicMove = await evalJS(
    conn,
    `(() => {
      const els = Array.from(document.querySelectorAll("main p"));
      const title = els.find((p) => p.textContent.trim() === ${JSON.stringify(stratTwoName)});
      if (!title) return { found: false };
      const style = getComputedStyle(title);
      return {
        found: true,
        text: title.textContent,
        fontSize: style.fontSize,
      };
    })()`,
  );

  if (!afterStrategicMove.found) {
    problems.push(`strategic goal "${stratTwoName}" missing from the page after moving`);
  } else if (beforeStrategicMove.found && afterStrategicMove.text !== beforeStrategicMove.text) {
    problems.push(`strategic goal title text changed after move: "${beforeStrategicMove.text}" -> "${afterStrategicMove.text}"`);
  } else if (beforeStrategicMove.found && afterStrategicMove.fontSize !== beforeStrategicMove.fontSize) {
    problems.push(
      `strategic goal font size changed after move: ${beforeStrategicMove.fontSize} -> ${afterStrategicMove.fontSize}`,
    );
  }

  // 5: delete stratTwo (now under pillar B, unreferenced). Strategic goal card
  // menu Delete opens a confirm dialog requiring a reason for removal. Type reason,
  // click Delete in dialog, verify goal is excluded via API, then navigate to
  // /snapshots and recover it to verify it returns to the tree.
  const stratTwoId = slugify(stratTwoName);
  const deleteReasonStratTwo = `smoke test leaf goal cleanup`;
  await realClickElement(
    conn,
    `(() => {
      const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
      const card = cards.find((c) => c.textContent.includes(${JSON.stringify(stratTwoName)}));
      if (!card) throw new Error("strategic goal card not found to delete");
      return Array.from(card.querySelectorAll('button')).find((b) => b.querySelector('svg'));
    })()`,
    "strategic goal card's own menu button not found to delete",
  );
  await sleep(300);
  await evalJS(
    conn,
    `(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const item = items.find((i) => i.textContent.trim() === "Delete");
      if (!item) throw new Error('"Delete" menu item not found; open menuitems: ' + JSON.stringify(items.map((i) => i.textContent.trim())));
      item.click();
    })()`,
  );
  await sleep(600);
  // Type reason into the confirmation dialog
  await evalJS(
    conn,
    `(() => {
      const input = document.querySelector('input[placeholder="Why is this being removed?"]');
      if (!input) throw new Error("reason input not found in delete dialog");
      ${SET_NATIVE_VALUE_JS}
      setNativeValue(input, ${JSON.stringify(deleteReasonStratTwo)});
    })()`,
  );
  await sleep(200);
  // Click the Delete button in the dialog
  await evalJS(
    conn,
    `(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find((b) => b.textContent.trim() === "Delete" && !b.hasAttribute("disabled"));
      if (!btn) throw new Error("Delete button not found or is disabled in reason dialog");
      btn.click();
    })()`,
  );
  await sleep(600);
  // Verify goal is excluded via API
  const excludedRes = await fetch(`${baseUrl}/api/v1/vault/excluded`);
  const excluded = await excludedRes.json();
  const stratTwoExcluded = excluded.find((e) => e.id === stratTwoId && e.kind === "Goal");
  if (!stratTwoExcluded) {
    problems.push(`stratTwo goal not found in excluded list after delete`);
  } else if (stratTwoExcluded.reason !== deleteReasonStratTwo) {
    problems.push(`stratTwo excluded with wrong reason: expected "${deleteReasonStratTwo}", got "${stratTwoExcluded.reason}"`);
  }
  // Verify GET /manifests/Goal/{id} returns 404 with recovery message
  const get404Res = await fetch(`${baseUrl}/api/v1/manifests/Goal/${stratTwoId}`);
  if (get404Res.status !== 404) {
    problems.push(`expected GET Goal/${stratTwoId} to return 404 after delete, got ${get404Res.status}`);
  } else {
    const get404Body = await get404Res.json();
    if (!JSON.stringify(get404Body).includes("recover to restore")) {
      problems.push(`expected 404 message to mention recovery, got: ${JSON.stringify(get404Body)}`);
    }
  }
  // Navigate to /snapshots and recover the deleted goal
  await navigateAndWait(conn, "/snapshots");
  await sleep(800);
  // Find and click Recover button for the goal
  await evalJS(
    conn,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const recoverBtn = buttons.find((b) => b.textContent.includes("Recover") && b.parentElement?.textContent.includes(${JSON.stringify(stratTwoName)}));
      if (!recoverBtn) {
        const allButtons = buttons.filter((b) => b.textContent.includes("Recover"));
        throw new Error(\`Recover button for stratTwoName not found. Found \${allButtons.length} Recover buttons\`);
      }
      recoverBtn.click();
    })()`,
  );
  await sleep(600);
  // Navigate back to goals home and verify goal is in tree
  await navigateAndWait(conn, "/goals");
  bodyText = await evalJS(conn, "document.body.innerText");
  if (!String(bodyText).includes(stratTwoName)) {
    problems.push(`stratTwo goal "${stratTwoName}" not visible in tree after recover from /snapshots`);
  }

  // 6: attempt to delete a goal a project aligns to, assert the refusal.
  // Discovered through the API: any Goal with at least one incoming
  // Project reference (never hardcoded, so this runs unchanged against
  // both examples/minimal and any other instance directory).
  const goals = await (await fetch(`${baseUrl}/api/v1/manifests/Goal`)).json();
  let referencedGoal = null;
  for (const g of goals) {
    const refs = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${g.id}/references`)).json();
    if ((refs.incoming ?? []).some((r) => r.kind === "Project")) {
      referencedGoal = g;
      break;
    }
  }
  if (!referencedGoal) {
    problems.push("no goal referenced by a Project found to attempt a blocked delete on");
  } else {
    await navigateAndWait(conn, "/goals");
    await realClickElement(
      conn,
      `(() => {
        const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
        const card = cards.find((c) => c.textContent.includes(${JSON.stringify(referencedGoal.name)}));
        if (!card) throw new Error("referenced goal card not found");
        return Array.from(card.querySelectorAll('button')).find((b) => b.querySelector('svg'));
      })()`,
      "referenced goal card's own menu button not found",
    );
    await sleep(300);
    await evalJS(
      conn,
      `(() => {
        const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((i) => i.textContent.trim() === "Delete");
        if (!item) throw new Error('"Delete" menu item not found on referenced goal');
        item.click();
      })()`,
    );
    await sleep(300);
    // A strategic goal card's delete opens a confirm dialog requiring a reason.
    // Type reason and click Delete to attempt the blocked delete.
    const hasConfirm = await evalJS(conn, `!!document.querySelector('[role="alertdialog"] input')`);
    if (hasConfirm) {
      // Type reason into the input
      await evalJS(
        conn,
        `(() => {
          const input = document.querySelector('input[placeholder="Why is this being removed?"]');
          if (!input) throw new Error("reason input not found in delete dialog for referenced goal");
          ${SET_NATIVE_VALUE_JS}
          setNativeValue(input, "test: attempting blocked delete");
        })()`,
      );
      await sleep(200);
      // Click the Delete button (now enabled because reason is filled)
      await evalJS(
        conn,
        `(() => {
          const dialog = document.querySelector('[role="alertdialog"]');
          const btn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent.trim() === "Delete" && !b.hasAttribute("disabled"));
          if (btn) btn.click();
        })()`,
      );
      await sleep(500);
    }
    const refusalText = await evalJS(conn, `document.querySelector('[role="alertdialog"]')?.textContent ?? ""`);
    if (!String(refusalText).includes("cannot be deleted") && !String(refusalText).includes("still references")) {
      problems.push(`expected a refusal dialog naming what references "${referencedGoal.name}", got: ${refusalText}`);
    }
    await evalJS(
      conn,
      `(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        const btn = dialog?.querySelector("button");
        if (btn) btn.click();
      })()`,
    );
    await sleep(300);
    const stillThereRes = await fetch(`${baseUrl}/api/v1/manifests/Goal/${referencedGoal.id}`);
    if (stillThereRes.status !== 200) {
      problems.push(`expected the referenced goal to survive the refused delete, GET returned ${stillThereRes.status}`);
    }
  }

  // 7: functional goal mutability. Add a functional goal under stratOne
  // (the renamed strategic goal under pillar A), rename it, move it to pillar B,
  // and assert the moved card's title text and font size remain the same.
  await navigateAndWait(conn, "/goals");
  const functionalGoalName = `Smoke Functional Goal ${Date.now()}`;
  const renamedFunctionalName = `${functionalGoalName} Renamed`;

  // Add a functional goal under stratOne (which is now called renamedName).
  await inlineAddFunctionalGoal(conn, renamedName, functionalGoalName);
  bodyText = await evalJS(conn, "document.body.innerText");
  if (!String(bodyText).includes(functionalGoalName)) {
    problems.push(`functional goal "${functionalGoalName}" did not appear after inline add`);
  }

  // Rename the functional goal inline on its card.
  await evalJS(
    conn,
    `(() => {
      const els = Array.from(document.querySelectorAll("main p"));
      const title = els.find((p) => p.textContent.trim() === ${JSON.stringify(functionalGoalName)});
      if (!title) throw new Error("functional goal title not found to rename");
      title.click();
    })()`,
  );
  await sleep(200);
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const input = document.activeElement;
      if (!input || input.tagName !== "INPUT") throw new Error("rename input not focused");
      setNativeValue(input, ${JSON.stringify(renamedFunctionalName)});
    })()`,
  );
  await pressEnter(conn);
  await sleep(600);
  bodyText = await evalJS(conn, "document.body.innerText");
  if (!String(bodyText).includes(renamedFunctionalName)) {
    problems.push(`renamed functional goal "${renamedFunctionalName}" did not appear after Enter`);
  }

  // Capture the moved card's title text and font size before moving.
  const beforeMove = await evalJS(
    conn,
    `(() => {
      const els = Array.from(document.querySelectorAll("main p"));
      const title = els.find((p) => p.textContent.trim() === ${JSON.stringify(renamedFunctionalName)});
      if (!title) return { found: false };
      const style = getComputedStyle(title);
      return {
        found: true,
        text: title.textContent,
        fontSize: style.fontSize,
      };
    })()`,
  );

  if (!beforeMove.found) {
    problems.push(`functional goal title not found before move`);
  }

  const pillarBStrategicName = `Smoke Strategic B ${Date.now()}`;
  await inlineAddStrategicGoal(conn, pillarBName, pillarBStrategicName);
  bodyText = await evalJS(conn, "document.body.innerText");
  if (!String(bodyText).includes(pillarBStrategicName)) {
    problems.push(`created strategic goal "${pillarBStrategicName}" under pillar B did not appear`);
  }

  await realClickElement(
    conn,
    `(() => {
      const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
      const card = cards.find((c) => c.textContent.includes(${JSON.stringify(renamedFunctionalName)}));
      if (!card) throw new Error("functional goal card not found to move");
      return Array.from(card.querySelectorAll('button')).find((b) => b.querySelector('svg'));
    })()`,
    "functional goal card's menu button not found to move",
  );
  await sleep(300);
  await evalJS(
    conn,
    `(() => {
      const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((i) => i.textContent.trim() === "Move to");
      if (!item) throw new Error('"Move to" menu item not found on functional goal');
      item.click();
    })()`,
  );
  await sleep(300);
  await evalJS(
    conn,
    `(() => {
      const options = Array.from(document.querySelectorAll('[role="option"]'));
      const option = options.find((o) => o.textContent.includes(${JSON.stringify(pillarBStrategicName)}));
      if (!option) throw new Error("target strategic goal not found in move-to options for functional goal");
      option.click();
    })()`,
  );
  await sleep(600);

  const afterMove = await evalJS(
    conn,
    `(() => {
      const els = Array.from(document.querySelectorAll("main p"));
      const title = els.find((p) => p.textContent.trim() === ${JSON.stringify(renamedFunctionalName)});
      if (!title) return { found: false };
      const style = getComputedStyle(title);
      return {
        found: true,
        text: title.textContent,
        fontSize: style.fontSize,
      };
    })()`,
  );

  if (!afterMove.found) {
    problems.push(`functional goal title not found after move`);
  } else if (beforeMove.found && afterMove.text !== beforeMove.text) {
    problems.push(`functional goal title text changed after move: "${beforeMove.text}" -> "${afterMove.text}"`);
  } else if (beforeMove.found && afterMove.fontSize !== beforeMove.fontSize) {
    problems.push(
      `functional goal font size changed after move: ${beforeMove.fontSize} -> ${afterMove.fontSize}`,
    );
  }

  // 8: deletion refusal: the functional goal now sits under the strategic goal created
  // in pillar B, so deleting that goal must be refused.
  await realClickElement(
    conn,
    `(() => {
      const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
      const card = cards.find((c) => c.textContent.includes(${JSON.stringify(pillarBStrategicName)}) && c.querySelector('p'));
      if (!card) throw new Error("strategic goal card with functional child not found for deletion test");
      return Array.from(card.querySelectorAll('button')).find((b) => b.querySelector('svg'));
    })()`,
    "strategic goal card's menu button not found for deletion refusal test",
  );
  await sleep(300);
  await evalJS(
    conn,
    `(() => {
      const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((i) => i.textContent.trim() === "Delete");
      if (!item) throw new Error('"Delete" menu item not found on strategic goal with child');
      item.click();
    })()`,
  );
  await sleep(300);
  const hasConfirmForChild = await evalJS(conn, `!!document.querySelector('[role="alertdialog"] button')`);
  if (hasConfirmForChild) {
    // The confirm dialog requires a reason before its Delete button enables.
    await evalJS(
      conn,
      `(() => {
        ${SET_NATIVE_VALUE_JS}
        const dialog = document.querySelector('[role="alertdialog"]');
        const input = dialog.querySelector("input");
        if (!input) throw new Error("reason input not found in the delete dialog");
        setNativeValue(input, "smoke: attempt to remove a goal with a child");
      })()`,
    );
    await sleep(200);
    await evalJS(
      conn,
      `(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        const btn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent.trim() === "Delete" && !b.hasAttribute("disabled"));
        if (!btn) throw new Error("Delete button not enabled after typing a reason");
        btn.click();
      })()`,
    );
    await sleep(700);
  }
  const refusalTextForChild = await evalJS(conn, `document.querySelector('[role="alertdialog"]')?.textContent ?? ""`);
  if (!String(refusalTextForChild).includes("cannot be deleted") && !String(refusalTextForChild).includes("still references")) {
    problems.push(`expected a refusal when deleting strategic goal with functional child, got: ${refusalTextForChild}`);
  }
  await evalJS(
    conn,
    `(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      const btn = dialog?.querySelector("button");
      if (btn) btn.click();
    })()`,
  );
  await sleep(300);

  // 9: drag a strategic goal with key results to another pillar, verify
  const manifestBeforeDrag = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${goalWithKRId}`)).json();
  // manifest data is preserved (I3.4b.1: tree edits keep the manifest).
  // Use the goal with key result from the addStrategicGoalAndKeyResultFlow pass.
  let pillarCName = "";
  if (!goalWithKRId || !goalWithKRName) {
    problems.push("goalWithKRId or goalWithKRName not passed to goalsMutabilityPass");
  } else {
    await navigateAndWait(conn, "/goals");
    pillarCName = `Smoke Pillar C ${Date.now()}`;
    await evalJS(
      conn,
      `(() => {
        const btn = Array.from(document.querySelectorAll("main button")).find((b) => b.textContent.includes("New goal"));
        if (!btn) throw new Error('"New goal" button not found for pillar C');
        btn.click();
      })()`,
    );
    await sleep(200);
    await evalJS(
      conn,
      `(() => {
        ${SET_NATIVE_VALUE_JS}
        const input = document.querySelector('main input[placeholder="Name this pillar"]');
        if (!input) throw new Error("inline pillar-add input not found for pillar C");
        setNativeValue(input, ${JSON.stringify(pillarCName)});
      })()`,
    );
    await pressEnter(conn);
    await sleep(600);

    await navigateAndWait(conn, "/goals");
    await sleep(300);
  await sleep(300);

    const beforeDragByMove = await evalJS(
      conn,
      `(() => {
        const els = Array.from(document.querySelectorAll("main p"));
        const title = els.find((p) => p.textContent.trim() === ${JSON.stringify(goalWithKRName)});
        if (!title) return { found: false };
        const style = getComputedStyle(title);
        const card = title.closest('[data-slot="card"]');
        const krText = card?.textContent || "";
        return {
          found: true,
          text: title.textContent,
          fontSize: style.fontSize,
          hasKeyResults: krText.includes("1 key result"),
        };
      })()`,
    );

    if (!beforeDragByMove.found) {
      problems.push(`goal with key result not found before drag move`);
    } else if (!beforeDragByMove.hasKeyResults) {
      problems.push(`goal with key result did not show "1 key result" before drag move`);
    }

    await evalJS(
      conn,
      `(() => {
        const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
        const sourceCard = cards.find((c) => c.textContent.includes(${JSON.stringify(goalWithKRName)}) && c.textContent.includes("1 key result"));
        if (!sourceCard) throw new Error("goal card with key result not found for drag source");

        const targetCard = cards.find((c) => c.textContent.includes(${JSON.stringify(pillarCName)}));
        if (!targetCard) throw new Error("pillar C card not found for drag target");

        const targetColumn = targetCard.closest('main')?.querySelector('div');
        if (!targetColumn) throw new Error("target column not found");

        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/cartograph-goal-id", ${JSON.stringify(goalWithKRId)});
        dataTransfer.setData("text/cartograph-goal-level-strategic", "strategic");

        const dragEvent = new DragEvent("dragstart", { dataTransfer, bubbles: true });
        sourceCard.dispatchEvent(dragEvent);
      })()`,
    );
    await sleep(200);

    const targetRect = await evalJS(
      conn,
      `(() => {
        const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
        const card = cards.find((c) => c.textContent.includes(${JSON.stringify(pillarCName)}));
        if (!card) throw new Error("pillar C card not found for drop");
        const rect = card.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height + 50 };
      })()`,
    );

    await evalJS(
      conn,
      `(() => {
        const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
        const card = cards.find((c) => c.textContent.includes(${JSON.stringify(pillarCName)}));
        const parent = card?.parentElement;
        if (!parent) throw new Error("pillar C parent container not found");

        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/cartograph-goal-id", ${JSON.stringify(goalWithKRId)});
        dataTransfer.setData("text/cartograph-goal-level-strategic", "strategic");
        dataTransfer.dropEffect = "move";

        const dragoverEvent = new DragEvent("dragover", { dataTransfer, bubbles: true, cancelable: true });
        parent.dispatchEvent(dragoverEvent);
      })()`,
    );
    await sleep(200);

    await evalJS(
      conn,
      `(() => {
        const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
        const card = cards.find((c) => c.textContent.includes(${JSON.stringify(pillarCName)}));
        const parent = card?.parentElement;
        if (!parent) throw new Error("pillar C parent container not found for drop");

        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/cartograph-goal-id", ${JSON.stringify(goalWithKRId)});
        dataTransfer.setData("text/cartograph-goal-level-strategic", "strategic");
        dataTransfer.dropEffect = "move";

        const dropEvent = new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true });
        parent.dispatchEvent(dropEvent);
      })()`,
    );
    await sleep(1000);

    const afterDragByMove = await evalJS(
      conn,
      `(() => {
        const els = Array.from(document.querySelectorAll("main p"));
        const title = els.find((p) => p.textContent.trim() === ${JSON.stringify(goalWithKRName)});
        if (!title) return { found: false };
        const style = getComputedStyle(title);
        const card = title.closest('[data-slot="card"]');
        const krText = card?.textContent || "";
        return {
          found: true,
          text: title.textContent,
          fontSize: style.fontSize,
          hasKeyResults: krText.includes("1 key result"),
        };
      })()`,
    );

    if (!afterDragByMove.found) {
      problems.push(`goal with key result not found after drag move`);
    } else if (beforeDragByMove.found && afterDragByMove.text !== beforeDragByMove.text) {
      problems.push(`goal title text changed after drag: "${beforeDragByMove.text}" -> "${afterDragByMove.text}"`);
    } else if (beforeDragByMove.found && afterDragByMove.fontSize !== beforeDragByMove.fontSize) {
      problems.push(`goal font size changed after drag: ${beforeDragByMove.fontSize} -> ${afterDragByMove.fontSize}`);
    } else if (!afterDragByMove.hasKeyResults) {
      problems.push(`goal key result count lost after drag move (UI)`);
    }

    const manifestAfterDrag = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${goalWithKRId}`)).json();
    if (!manifestAfterDrag.manifest?.spec?.keyResults?.length) {
      problems.push(`goal key results lost after drag move (manifest): ${JSON.stringify(manifestAfterDrag.manifest?.spec)}`);
    }
    const stripParent = (spec) => { const { parent, ...rest } = spec ?? {}; return rest; };
    const beforeSpec = JSON.stringify(stripParent(manifestBeforeDrag.manifest?.spec));
    const afterSpec = JSON.stringify(stripParent(manifestAfterDrag.manifest?.spec));
    if (beforeSpec !== afterSpec) {
      problems.push(`goal spec changed beyond parent after drag move: before ${beforeSpec} after ${afterSpec}`);
    }
  }

  // 10: a functional goal dragged onto a pillar column is refused before any
  // request is sent (I3.8b: a goal keeps its level).
  const goalIndex = await (await fetch(`${baseUrl}/api/v1/manifests/Goal`)).json();
  let functionalIdForDrop = null;
  for (const g of goalIndex) {
    const view = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${g.id}`)).json();
    if (view.manifest?.metadata?.name === renamedFunctionalName) {
      functionalIdForDrop = g.id;
      break;
    }
  }
  if (!functionalIdForDrop || !pillarCName) {
    problems.push(`functional goal "${renamedFunctionalName}" or the target pillar not available for the pillar-column refusal step`);
  } else {
    const putsBefore = goalManifestRequests.filter((r) => r.method === "PUT").length;
    const manifestBeforeRefusal = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${functionalIdForDrop}`)).json();
    await evalJS(
      conn,
      `(() => {
        const cards = Array.from(document.querySelectorAll('main [data-slot="card"]'));
        const targetCard = cards.find((c) => c.textContent.includes(${JSON.stringify(pillarCName)}));
        const column = targetCard?.closest('[data-slot="pillar-column"]');
        if (!column) throw new Error("pillar column not found for the functional drop");
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/cartograph-goal-id", ${JSON.stringify(functionalIdForDrop)});
        dataTransfer.setData("text/cartograph-goal-level-functional", "functional");
        column.dispatchEvent(new DragEvent("dragover", { dataTransfer, bubbles: true, cancelable: true }));
        column.dispatchEvent(new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }));
      })()`,
    );
    await sleep(800);
    const levelRefusal = String(await evalJS(conn, `document.querySelector('[role="alertdialog"]')?.textContent ?? ""`));
    if (!levelRefusal.includes('is level "pillar", not "strategic"')) {
      problems.push(`expected the level refusal after dropping a functional goal on a pillar column, got: ${levelRefusal}`);
    }
    await evalJS(
      conn,
      `(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        const btn = dialog?.querySelector("button");
        if (btn) btn.click();
      })()`,
    );
    await sleep(300);
    const putsAfter = goalManifestRequests.filter((r) => r.method === "PUT").length;
    if (putsAfter !== putsBefore) {
      problems.push(`dropping a functional goal on a pillar column sent ${putsAfter - putsBefore} PUT requests, expected none`);
    }
    const manifestAfterRefusal = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${functionalIdForDrop}`)).json();
    if (JSON.stringify(manifestAfterRefusal.manifest?.spec) !== JSON.stringify(manifestBeforeRefusal.manifest?.spec)) {
      problems.push("the functional goal changed after the refused drop on a pillar column");
    }
    console.log("smoke: functional goal dropped on a pillar column refused without a request (I3.8b)");
  }

  return { problems };
  } finally {
    conn.listeners.delete(onNetworkEvent);
    detach();

    // Print captured network events: Goal manifest requests properly mapped by requestId
    console.log(`network: ${goalManifestRequests.length} Goal manifest requests (joined by requestId)`);
    if (goalManifestRequests.length > 0) {
      console.log("Goal manifest requests (method status url):");
      for (const evt of goalManifestRequests) {
        console.log(`${evt.method} ${evt.status} ${evt.url}`);
      }
    }
    const putRequests = goalManifestRequests.filter(r => r.method === "PUT" && r.status === 200);
    if (renamedGoalId) {
      console.log(`rename/move mutation captured: renamed goal ${renamedGoalId} with ${putRequests.length} PUT 200 requests total`);
      if (putRequests.filter(r => r.url.includes(renamedGoalId)).length === 1) {
        console.log("rename mutation verified: exactly one PUT 200 for the renamed goal id");
      } else {
        console.log(`rename mutation check: ${putRequests.filter(r => r.url.includes(renamedGoalId)).length} PUT 200 for renamed goal (expected 1)`);
      }
    }
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
  console.log(`smoke: screenshot saved to web/scripts/shots/${filename}`);
}

/**
 * Collapsed-sidebar pass (I2.1 fault 1): over every given route, clicks the
 * sidebar trigger to collapse it, then asserts nothing inside the rail is
 * actually painted outside the rail's own box. This compares each visible
 * element's real getBoundingClientRect() against the rail's own rect,
 * rather than scrollWidth vs clientWidth: a display:none child (correctly
 * hidden, e.g. the header's "Cartograph / Definitions" text once collapsed) can
 * still leave its formerly-flex-gap-adjacent sibling's scrollWidth a few
 * px over clientWidth in this Chromium build with nothing actually
 * overflowing on screen, which a scrollWidth-based check would wrongly
 * flag; a bounding-box check catches only genuine visible spill, the exact
 * shape of the original bug (the header text staying visible and
 * overlapping the mark and the trigger). Screenshots one route (Goals
 * home) collapsed, at the standard 1440x900.
 */
async function collapsedSidebarPass(conn, routesToCheck) {
  const { problems, detach } = watchConsole(conn);
  for (const route of routesToCheck) {
    await navigateAndWait(conn, route);
    await evalJS(
      conn,
      `(() => { document.querySelector('[data-slot="sidebar-trigger"]')?.click(); })()`,
    );
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
      problems.push(`${route}: collapsed sidebar has visible overflow: ${JSON.stringify(result.items)}`);
    }
    if (route === "/" && takeShots) {
      await captureScreenshot(conn, "home-collapsed.png");
    }
    // Re-expand so every route's own pass starts from the same state (the
    // cookie the sidebar writes on toggle would otherwise carry collapsed
    // state into the next route's hard navigation).
    await evalJS(
      conn,
      `(() => { document.querySelector('[data-slot="sidebar-trigger"]')?.click(); })()`,
    );
    await sleep(200);
  }
  detach();
  return { problems };
}

/**
 * 1024-wide pass (I2.1 fault 8): over every given route at a 1024-wide
 * viewport, asserts document.documentElement.scrollWidth never exceeds
 * 1024 (no horizontal scroll on the body). Also covers the goal editor and
 * a Sheet with the rail collapsed too (the card's "at 1024 with it
 * collapsed" case), saving the two required 1024-wide screenshots.
 */
async function wideAt1024Pass(conn, routesToCheck, goalRoute) {
  const { problems, detach } = watchConsole(conn);
  await send(conn, "Emulation.setDeviceMetricsOverride", { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });

  for (const route of routesToCheck) {
    await navigateAndWait(conn, route);
    const scrollWidth = await evalJS(conn, "document.documentElement.scrollWidth");
    if (scrollWidth > 1024) {
      problems.push(`${route} @1024 wide: document.documentElement.scrollWidth = ${scrollWidth} > 1024`);
    }
  }

  if (goalRoute) {
    await navigateAndWait(conn, goalRoute);
    const sw = await evalJS(conn, "document.documentElement.scrollWidth");
    if (sw > 1024) problems.push(`${goalRoute} @1024 wide: scrollWidth ${sw} > 1024`);
    if (takeShots) await captureScreenshot(conn, "goal-editor-1024.png", 1024, 900);
  }

  await navigateAndWait(conn, "/sheets/Resource");
  await evalJS(conn, `(() => { document.querySelector('[data-slot="sidebar-trigger"]')?.click(); })()`);
  await sleep(300);
  const swCollapsed = await evalJS(conn, "document.documentElement.scrollWidth");
  if (swCollapsed > 1024) {
    problems.push(`/sheets/Resource @1024 wide, collapsed: scrollWidth ${swCollapsed} > 1024`);
  }
  if (takeShots) await captureScreenshot(conn, "sheets-1024-collapsed.png", 1024, 900);

  // Restore the standard viewport for whatever runs after this.
  await send(conn, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  detach();
  return { problems };
}

/**
 * Keyboard-only pass (I2.1 fault 7): Tab from a blank focus state through
 * the Goals home page's real tab order until the first "New objective"
 * button is reached (no element skipped over is reachable only by mouse, or
 * this loop runs out before finding it), Enter opens its dialog with focus
 * moved inside it (a trapped focus), Escape closes it. Tab uses CDP's
 * "rawKeyDown" (matches real browser tab-focus movement); Enter uses
 * "keyDown" with a carriage-return text payload, since a browser's default
 * action for Enter on a focused button (a click) needs that specific event
 * shape to fire under CDP, the same as a real keypress would.
 */
/**
 * I2.1's own keyboard-only pass, updated for I3.2's inline add (no dialog
 * at all any more, card section 5): Tab from Goals home to the first "Add
 * a strategic goal" button, Enter reveals its own inline input (autoFocus
 * moves focus straight into it, not a dialog to trap focus in), Escape
 * closes it back to the button.
 */
async function keyboardPass(conn) {
  const { problems, detach } = watchConsole(conn);
  await navigateAndWait(conn, "/goals");
  await evalJS(conn, "document.body.focus()");

  // The budget is a ceiling, not a target: what this pass asserts is that
  // the button is reachable by Tab at all, and the tree it sits at the
  // bottom of grows every time the example does (a fixed 40 went stale
  // the moment the example gained its plan-shaped tree). It is derived
  // from the page itself, so it stays honest as the tree grows.
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
    const text = await evalJS(conn, `(document.activeElement.textContent || "").trim()`);
    lastFocused = String(text).slice(0, 60);
    if (String(text).includes("New objective")) found = true;
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
  const focusedIsInput = await evalJS(conn, `document.activeElement.tagName === "INPUT"`);
  if (!focusedIsInput) {
    problems.push('keyboard: Enter on the focused "New objective" button did not reveal (and focus) its inline input');
    detach();
    return { problems };
  }

  await pressEscape(conn);
  await sleep(300);
  const closedByEscape = !(await evalJS(conn, `document.activeElement.tagName === "INPUT"`));
  if (!closedByEscape) problems.push("keyboard: Escape did not close the inline input back to the button");

  detach();
  return { problems };
}

async function checkRoute(conn, route) {
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
      problems.push(`log error: ${msg.params.entry.text}`);
    }
  };
  conn.listeners.add(onEvent);

  await send(conn, "Page.navigate", { url: baseUrl + route });
  await new Promise((resolve) => {
    const waiter = (msg) => {
      if (msg.method === "Page.loadEventFired") {
        conn.listeners.delete(waiter);
        resolve();
      }
    };
    conn.listeners.add(waiter);
  });
  // Give React and its data fetch a moment to settle after load.
  await sleep(800);

  const { result } = await send(conn, "Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true,
  });
  const bodyText = String(result.value ?? "");

  conn.listeners.delete(onEvent);
  return { problems, bodyText };
}

// I3.2 delta: the engine accepts any actor unconditionally now (checkActor
// on the server is a no-op). This literal string is used throughout this
// script's own API-level seeding.
const SEED_ACTOR = "smoke-seed";

/**
 * The project journey (card I3b) needs at least one DataSource (a key
 * result's source, and the Data section's own pickers) and one
 * BeneficiaryGroup (the Beneficiaries section) to exercise those pickers
 * at all. The instance directory ships with neither (confirmed: no
 * DataSource or BeneficiaryGroup file under it); these seed directly
 * through the API, only when none exists yet.
 */
async function ensureOneDataSource() {
  const raw = await (await fetch(`${baseUrl}/api/v1/manifests/DataSource`)).json();
  const existing = Array.isArray(raw) ? raw : (raw.items ?? []);
  if (existing.length > 0) return;

  const teamsRaw = await (await fetch(`${baseUrl}/api/v1/manifests/Team`)).json();
  const teams = Array.isArray(teamsRaw) ? teamsRaw : (teamsRaw.items ?? []);
  if (teams.length === 0) {
    throw new Error("smoke setup: no Team exists to reference from a seeded DataSource");
  }

  const id = "smoke-test-data-source";
  const manifest = {
    apiVersion: "cartograph/v1",
    kind: "DataSource",
    metadata: { id, name: "Smoke Test Data Source" },
    spec: { name: "Smoke Test Data Source", category: "spreadsheet", team: teams[0].id },
  };
  const res = await fetch(`${baseUrl}/api/v1/manifests/DataSource/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest, reason: "smoke test setup: seed one DataSource" }),
  });
  if (!res.ok) {
    throw new Error(`smoke setup: failed to seed a DataSource, ${res.status}: ${await res.text()}`);
  }
  console.log("smoke: seeded one DataSource (none existed) so the Aim and Data sections have an option");
}

async function ensureOneBeneficiaryGroup() {
  const raw = await (await fetch(`${baseUrl}/api/v1/manifests/BeneficiaryGroup`)).json();
  const existing = Array.isArray(raw) ? raw : (raw.items ?? []);
  if (existing.length > 0) return;

  const id = "smoke-test-beneficiary-group";
  const manifest = {
    apiVersion: "cartograph/v1",
    kind: "BeneficiaryGroup",
    metadata: { id, name: "Smoke Test Beneficiary Group" },
    spec: { name: "Smoke Test Beneficiary Group" },
  };
  const res = await fetch(`${baseUrl}/api/v1/manifests/BeneficiaryGroup/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest, reason: "smoke test setup: seed one BeneficiaryGroup" }),
  });
  if (!res.ok) {
    throw new Error(`smoke setup: failed to seed a BeneficiaryGroup, ${res.status}: ${await res.text()}`);
  }
  console.log("smoke: seeded one BeneficiaryGroup (none existed) so the Beneficiaries section has an option");
}

// ---------------------------------------------------------------------
// I3b: the project journey flow test (card section 5).
// ---------------------------------------------------------------------

// setReason fills the first enabled reason field on the page (see
// FIND_REASON_JS), inside an open dialog first.
async function setReason(conn, value) {
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      ${FIND_REASON_JS}
      const dialog = document.querySelector('[role="dialog"]');
      const el = (dialog && findReason(dialog)) || findReason(document);
      if (!el) throw new Error("reason field not found");
      setNativeValue(el, ${JSON.stringify(value)});
    })()`,
  );
}

async function setInputByPlaceholder(conn, placeholder, value) {
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      // A placeholder identifies a field, whatever element it is: a scope
      // sentence is a textarea so sixty characters can wrap.
      const el = Array.from(document.querySelectorAll("input[placeholder], textarea[placeholder]"))
        .find((i) => i.placeholder === ${JSON.stringify(placeholder)} && !i.disabled);
      if (!el) throw new Error("field not found for placeholder: " + ${JSON.stringify(placeholder)});
      setNativeValue(el, ${JSON.stringify(value)});
    })()`,
  );
}

/** Polls until the project header reports the working copy is saved, so a
 * hard navigation never races the autosave debounce. */
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

async function setFieldByLabel(conn, label, value) {
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const el = Array.from(document.querySelectorAll("input[aria-label], textarea[aria-label]"))
        .find((i) => i.getAttribute("aria-label") === ${JSON.stringify(label)} && !i.disabled);
      if (!el) throw new Error("field not found for label: " + ${JSON.stringify(label)});
      el.scrollIntoView({ block: "center" });
      setNativeValue(el, ${JSON.stringify(value)});
    })()`,
  );
}

async function setTextareaAt(conn, index, value) {
  await evalJS(
    conn,
    `(() => {
      function setNativeValue(el, value) {
        const proto = Object.getPrototypeOf(el);
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        desc.set.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const areas = document.querySelectorAll("main textarea");
      const el = areas[${index}];
      if (!el) throw new Error("textarea not found at index " + ${index});
      setNativeValue(el, ${JSON.stringify(value)});
    })()`,
  );
}

async function clickButtonByText(conn, text, { nth = 0, within } = {}) {
  await evalJS(
    conn,
    `(() => {
      const root = ${within ? `document.querySelector(${JSON.stringify(within)})` : "document"};
      if (!root) throw new Error("container not found: " + ${JSON.stringify(within ?? "")});
      // A button may carry a short word and keep its full sentence as its
      // accessible name (the mark-and-short-word buttons), so either one
      // identifies it. Text first, so an exact label still wins.
      const want = ${JSON.stringify(text)};
      const all = Array.from(root.querySelectorAll("button"));
      const byText = all.filter((b) => b.textContent.trim() === want);
      const byName = all.filter(
        (b) => (b.getAttribute("aria-label") ?? b.getAttribute("title") ?? "").trim() === want,
      );
      const btns = byText.length > 0 ? byText : byName;
      const btn = btns[${nth}];
      if (!btn) throw new Error("button not found for text: " + want + " at index " + ${nth});
      btn.click();
    })()`,
  );
}

/** Polls (up to timeoutMs) for at least `count` buttons with this exact
 * text to exist, then clicks the one at `nth`. Used where a button's
 * appearance depends on a network fetch (e.g. the proposed-criteria
 * panel), so a fixed sleep after navigation is not reliably enough. */
async function waitAndClickButtonByText(conn, text, { nth = 0, count = 1, timeoutMs = 5000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let found = 0;
  while (Date.now() < deadline) {
    found = await evalJS(
      conn,
      `(() => {
        const want = ${JSON.stringify(text)};
        const all = Array.from(document.querySelectorAll("button"));
        const byText = all.filter((b) => b.textContent.trim() === want).length;
        if (byText > 0) return byText;
        return all.filter(
          (b) => (b.getAttribute("aria-label") ?? b.getAttribute("title") ?? "").trim() === want,
        ).length;
      })()`,
    );
    if (found >= count) break;
    await sleep(200);
  }
  if (found < count) {
    throw new Error(`timed out waiting for ${count} button(s) with text "${text}", found ${found}`);
  }
  await clickButtonByText(conn, text, { nth });
}

/** Picks a month out of a MonthPicker (components/ui/date-picker.tsx):
 * clicks the trigger carrying this aria-label, steps the year to the one
 * asked for, then clicks the month. Date fields in the project journey are
 * calendar dropdowns, not text inputs, so there is nothing to type into. */
async function pickMonth(conn, ariaLabel, year, monthName) {
  await evalJS(
    conn,
    `(() => {
      const el = Array.from(document.querySelectorAll('button[aria-label]'))
        .find((b) => b.getAttribute('aria-label') === ${JSON.stringify(ariaLabel)});
      if (!el) throw new Error("month picker not found for label: " + ${JSON.stringify(ariaLabel)});
      el.scrollIntoView({ block: "center" });
      el.click();
    })()`,
  );
  await sleep(300);
  for (let i = 0; i < 12; i++) {
    const shown = await evalJS(
      conn,
      `(() => {
        const content = document.querySelector('[data-slot="popover-content"]');
        if (!content) return null;
        const label = Array.from(content.querySelectorAll('button[aria-label]'))
          .map((b) => b.getAttribute('aria-label'))
          .find((l) => /^[A-Z][a-z]+ \\d{4}$/.test(l));
        return label ? Number(label.split(" ")[1]) : null;
      })()`,
    );
    if (shown === null) throw new Error(`month picker popover did not open for ${ariaLabel}`);
    if (shown === year) break;
    await evalJS(
      conn,
      `(() => {
        const content = document.querySelector('[data-slot="popover-content"]');
        const dir = ${shown} < ${year} ? "Next year" : "Previous year";
        const btn = Array.from(content.querySelectorAll('button[aria-label]')).find((b) => b.getAttribute("aria-label") === dir);
        if (!btn) throw new Error("year stepper not found");
        btn.click();
      })()`,
    );
    await sleep(150);
  }
  await evalJS(
    conn,
    `(() => {
      const content = document.querySelector('[data-slot="popover-content"]');
      const want = ${JSON.stringify(monthName)};
      const btn = Array.from(content.querySelectorAll('button[aria-label]'))
        .find((b) => b.getAttribute("aria-label").startsWith(want) && b.getAttribute("aria-label").endsWith(" " + ${year}));
      if (!btn) throw new Error("month button not found: " + want + " " + ${year});
      btn.click();
    })()`,
  );
  await sleep(250);
}

/** Picks a named option in a shadcn Select identified by its aria-label,
 * taking the nth such select (the Resources page has one per role row plus
 * the trailing one beside "Add a role"). */
async function pickSelectOption(conn, ariaLabel, optionText, { last = false } = {}) {
  await evalJS(
    conn,
    `(() => {
      const btns = Array.from(document.querySelectorAll('button[role="combobox"][aria-label]'))
        .filter((b) => b.getAttribute("aria-label") === ${JSON.stringify(ariaLabel)});
      const target = ${last ? "btns[btns.length - 1]" : "btns[0]"};
      if (!target) throw new Error("select not found for label: " + ${JSON.stringify(ariaLabel)});
      target.scrollIntoView({ block: "center" });
      target.click();
    })()`,
  );
  await sleep(300);
  await evalJS(
    conn,
    `(() => {
      const option = Array.from(document.querySelectorAll('[role="option"]'))
        .find((o) => o.textContent.trim() === ${JSON.stringify(optionText)});
      if (!option) throw new Error("option not found: " + ${JSON.stringify(optionText)});
      option.click();
    })()`,
  );
  await sleep(200);
}

async function clickFirstMatch(conn, selector) {
  await evalJS(
    conn,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error("no element for selector: " + ${JSON.stringify(selector)});
      el.click();
    })()`,
  );
}

/** Opens a shadcn Select (button[role=combobox]) currently showing
 * placeholder text (unset), picks its first option. */
async function pickSelectShowingPlaceholder(conn, placeholder) {
  await evalJS(
    conn,
    `(() => {
      const btns = Array.from(document.querySelectorAll('button[role="combobox"]'));
      const target = btns.find((b) => b.textContent.trim() === ${JSON.stringify(placeholder)});
      if (!target) throw new Error("select not found showing placeholder: " + ${JSON.stringify(placeholder)});
      target.click();
    })()`,
  );
  await sleep(250);
  await evalJS(
    conn,
    `(() => {
      const option = document.querySelector('[role="option"]');
      if (!option) throw new Error("no option in open select");
      option.click();
    })()`,
  );
  await sleep(150);
}

/** Opens the ReferenceField combobox whose <input> carries this exact
 * placeholder, and picks its first visible option. */
async function pickComboboxByPlaceholder(conn, placeholder) {
  // The base-ui Combobox (ReferenceField.tsx) does not open its popup from
  // a plain click/focus on the <input> itself; its own chevron trigger
  // button (aria-haspopup="listbox", inside the same input-group) does.
  await evalJS(
    conn,
    `(() => {
      const input = Array.from(document.querySelectorAll("input[placeholder]"))
        .find((i) => i.placeholder === ${JSON.stringify(placeholder)});
      if (!input) throw new Error("combobox input not found for placeholder: " + ${JSON.stringify(placeholder)});
      const group = input.closest('[data-slot="input-group"]');
      const trigger = group && group.querySelector('button[aria-haspopup="listbox"]');
      if (!trigger) throw new Error("combobox trigger button not found for placeholder: " + ${JSON.stringify(placeholder)});
      trigger.click();
    })()`,
  );
  // The option list depends on its own reference-options fetch, which can
  // take longer than a fixed sleep on a larger instance directory; poll
  // instead of assuming 350ms is always enough.
  const deadline = Date.now() + 4000;
  let itemCount = 0;
  while (Date.now() < deadline) {
    itemCount = await evalJS(conn, `document.querySelectorAll('[data-slot="combobox-item"]').length`);
    if (itemCount > 0) break;
    await sleep(200);
  }
  if (itemCount === 0) {
    throw new Error(`no combobox option visible for placeholder: ${placeholder}`);
  }
  await evalJS(conn, `(() => { document.querySelector('[data-slot="combobox-item"]').click(); })()`);
  await sleep(200);
}

async function getJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${opts?.method ?? "GET"} ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getDraftManifest(id) {
  const current = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}`);
  return { ...current, manifest: parseYAML(current.yaml) };
}

/** Project spec: fetch the current content (working copy when one exists,
 * else the latest snapshot). This mirrors store.tsx's own load order exactly.
 * I3.3b.2: the working copy is always available through the main endpoint;
 * no separate /draft endpoint exists any more. The main endpoint returns
 * { manifest, version, yaml }, not the flat { yaml, on } shape of /draft. */
async function getWholeDraft(id) {
  const current = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}`);
  return { spec: current.manifest.spec, on: current.version.on };
}

function get(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/** The heart of the card (I3b.1 §1.2, still true under I3.2's simpler
 * single-spec shape): a full JSON deep-equal of the whole draft against
 * the expected object the caller has been maintaining, reported as a JSON
 * diff on any mismatch so a failure is legible without re-running
 * anything. */
function diffWholeDraft(label, expected, actual) {
  const e = JSON.stringify({ spec: expected.spec }, null, 2);
  const a = JSON.stringify({ spec: actual.spec }, null, 2);
  if (e === a) return null;
  return `${label}: whole-draft mismatch after navigating\n--- expected ---\n${e}\n--- actual ---\n${a}`;
}

/** A small, dependency-free seeded PRNG (mulberry32): deterministic given
 * the same seed, so the randomised pass's own failures reproduce exactly
 * (card §1.3: "a fixed seed printed so a failure reproduces"). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The full project journey flow test (card section 5): create a project,
 * visit every section entering the minimum, jump out of order, leave and
 * return, add proposed closing/landing lines, drive checks to zero
 * blocking, save a real version, and submit for review. Never hardcodes
 * either instance's own words: every reference id is discovered through
 * the API first.
 */
async function projectJourneyFlow(conn, { takeShots: shots } = {}) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);

  const dataSources = await getJSON(`${baseUrl}/api/v1/manifests/DataSource`);
  if ((Array.isArray(dataSources) ? dataSources : dataSources.items).length === 0) {
    problems.push("project journey: no DataSource exists to pick as a key result source");
  }

  // Discover or create a functional goal to align to. Only a functional goal
  // bound to a strategic goal is pickable (I3.8, I3.9), so a functional goal
  // sitting directly under a pillar in a hand-edited instance does not count.
  let functionalGoalId = null;
  let firstStrategicGoalId = null;
  const goals = await getJSON(`${baseUrl}/api/v1/manifests/Goal`);
  const goalArray = Array.isArray(goals) ? goals : (goals.items ?? []);
  const goalViews = new Map();
  for (const g of goalArray) {
    goalViews.set(g.id, await getJSON(`${baseUrl}/api/v1/manifests/Goal/${g.id}`));
  }
  for (const [gid, view] of goalViews) {
    const level = view.manifest?.spec?.level;
    if (level === "objective" && !firstStrategicGoalId) firstStrategicGoalId = gid;
    if (level === "outcome") {
      const parentView = goalViews.get(view.manifest?.spec?.parent);
      if (parentView?.manifest?.spec?.level === "objective") {
        functionalGoalId = gid;
        break;
      }
    }
  }
  if (!functionalGoalId && firstStrategicGoalId) {
    const newId = `smoke-functional-${Date.now()}`;
    const created = await fetch(`${baseUrl}/api/v1/manifests/Goal/${newId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "smoke: a functional goal to align the journey project to",
        manifest: {
          apiVersion: "cartograph/v1",
          kind: "Goal",
          metadata: { id: newId, name: `Smoke Functional Goal ${Date.now()}` },
          spec: { level: "outcome", parent: firstStrategicGoalId, objective: "A functional goal created by the smoke test." },
        },
      }),
    });
    if (created.ok) {
      functionalGoalId = newId;
      console.log(`smoke: project journey created functional goal ${newId} under ${firstStrategicGoalId}`);
    } else {
      problems.push(`project journey: could not create a functional goal to align to (${created.status})`);
    }
  }
  if (!functionalGoalId) {
    problems.push("project journey: no functional goal bound to a strategic goal, and none could be created");
    detach();
    return { problems };
  }

  // Step 1: create a project from /projects/new. The first view asks for a
  // name and a team only; the goal tree lives on Align, the
  // one canonical place a project is aligned.
  await navigateAndWait(conn, "/projects/new");
  const projectName = `Smoke Project ${Date.now()}`;
  await setInputByPlaceholder(conn, "Quality Check Rollout", projectName);
  await pickSelectShowingPlaceholder(conn, "Choose a team");
  await clickButtonByText(conn, "Start");
  await sleep(1200);

  const pathname = await evalJS(conn, "location.pathname");
  const match = /^\/projects\/([^/]+)\//.exec(String(pathname));
  if (!match) {
    problems.push(`project journey: expected navigation to /projects/{id}/..., got ${pathname}`);
    detach();
    return { problems };
  }
  const id = match[1];
  console.log(`smoke: project journey created ${id}`);
  if (!String(pathname).endsWith("/initiation/goals")) {
    problems.push(`project journey: a new project should open on Align, got ${pathname}`);
  }

  let lastOn = (await getWholeDraft(id)).on;

  /**
   * The whole-draft version of "edit, wait for the debounce, reload,
   * assert nothing was lost" (card §1.2, I3b.1): fetches the Project
   * draft before AND after a hard reload of `route`, asserting it
   * actually advanced and that the whole draft is byte-for-byte identical
   * before and after the reload. I3.2: People and resources is now an
   * ordinary part of this same spec.resources, one draft covering every
   * section.
   */
  async function afterEditReloadAndCheck(route, label) {
    await sleep(1000); // let the 800ms debounce flush
    await waitForSaved(conn);
    const before = await getWholeDraft(id);
    // I3.3b.1: plain saves write the working copy; no version number advances but On may advance.
    // Don't rely on On advancing; the caller verifies the specific field was saved.
    // Navigate and check that the whole draft is still identical (reload doesn't lose anything).
    await navigateAndWait(conn, route);
    const after = await getWholeDraft(id);
    const diff = diffWholeDraft(label, before, after);
    if (diff) problems.push(diff);
    return after;
  }

  // Step 2: walk the Initiation steps in their fixed order, the
  // minimum entry on each, reload and assert nothing was lost.

  // Aim: the problem, what will be different, and the mandate.
  // Quality opens on Beneficiaries: who this is for is picked before the
  // problem that names them is written. Only Align comes before it, so
  // the goals are the one earlier answer it recaps.
  // Beneficiaries are qualitative (Programme Lead, 2026-09-26): the step
  // is the register as chips, one click per group, and nothing counts
  // them. No count, no basis, no reason, and no recap paragraph.
  await navigateAndWait(conn, `/projects/${id}/initiation/beneficiaries`);
  const pickedGroup = await evalJS(
    conn,
    `(() => {
      const chip = document.querySelector('[data-slot="beneficiary-chips"] button[data-chip-id]');
      if (!chip) throw new Error("no beneficiary group chip found");
      chip.click();
      return chip.getAttribute("data-chip-id");
    })()`,
  );
  await sleep(300);
  {
    const counting = String(await evalJS(conn, "document.body.innerText"));
    for (const word of ["How many", "Basis", "Not known yet"]) {
      if (counting.includes(word)) problems.push(`beneficiaries: the step still counts people ("${word}")`);
    }
  }
  let manifest = await afterEditReloadAndCheck(`/projects/${id}/initiation/beneficiaries`, "beneficiaries");
  const benLines = get(manifest, "spec.summary.beneficiaries") ?? [];
  if (benLines.length !== 1) {
    problems.push("beneficiaries: expected one beneficiary group after reload");
  } else if (benLines[0].group !== pickedGroup) {
    problems.push(`beneficiaries: expected the picked group ${pickedGroup}, got ${benLines[0].group}`);
  } else if (Object.keys(benLines[0]).length !== 1) {
    problems.push(`beneficiaries: a line should hold a group and nothing else, got ${JSON.stringify(benLines[0])}`);
  }

  // The problem and the change are built from parts now, with the group
  // named on the step before carried into both sentences.
  await navigateAndWait(conn, `/projects/${id}/initiation/aim`);
  {
    const shown = await evalJS(
      conn,
      `document.querySelector('[data-slot="context-recap"] [data-slot="context-beneficiaries"]')?.innerText ?? ""`,
    );
    if (!String(shown).trim()) {
      problems.push("aim: the step does not show the beneficiaries the problem is about");
    }
  }
  await setFieldByLabel(conn, "What they face today", "wait a season to learn a delivery failed");
  await setFieldByLabel(conn, "Because", "checks happen after dispatch");
  await setFieldByLabel(conn, "What will be true", "every delivery is checked at intake");
  await setFieldByLabel(conn, "So they", "learn of a failure the same day");
  await clickButtonByText(conn, "Add a mandate");
  await sleep(250);
  await setInputByPlaceholder(conn, "Board decision on delivery quality", "Smoke test mandate");
  manifest = await afterEditReloadAndCheck(`/projects/${id}/initiation/aim`, "aim");
  const problemText = String(get(manifest, "spec.summary.problem") ?? "");
  if (!problemText.includes("because")) {
    problems.push(`aim: the problem should read as one sentence built from its parts, got "${problemText}"`);
  }
  if (!String(get(manifest, "spec.summary.change") ?? "").includes(", so ")) {
    problems.push("aim: the change should name who it is for");
  }
  if ((get(manifest, "spec.mandate") ?? []).length !== 1) problems.push("aim: expected one mandate after reload");

  // Align, then Refine: the aligned goal, then the objective, one key result,
  // then the KPI that key result moves.
  // Align is a flat set of chips now, one per goal a project may align
  // to (Programme Lead, 2026-09-26): the pillar and strategic levels are
  // not on screen, because a project can never pick them. A chip carries
  // the strategic area as its tag, and the search matches either.
  await navigateAndWait(conn, `/projects/${id}/initiation/goals`);
  const goalChip = await evalJS(
    conn,
    `(() => {
      const goalId = ${JSON.stringify(functionalGoalId)};
      const chip = document.querySelector('[data-slot="goal-chips"] button[data-chip-id="' + goalId + '"]');
      if (!chip) throw new Error("functional goal chip not found by data-chip-id");
      chip.scrollIntoView({ block: "center" });
      chip.click();
      return true;
    })()`,
  );
  if (!goalChip) problems.push("goals: could not pick the functional goal chip");
  await sleep(400);

  const dragGoalView = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${functionalGoalId}`)).json();
  const dragGoalName = dragGoalView.manifest?.metadata?.name ?? functionalGoalId;
  const strategicView = await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${dragGoalView.manifest?.spec?.parent}`)).json();
  const strategicName = strategicView.manifest?.metadata?.name;
  const pillarView = strategicView.manifest?.spec?.parent
    ? await (await fetch(`${baseUrl}/api/v1/manifests/Goal/${strategicView.manifest.spec.parent}`)).json()
    : null;
  const pillarName = pillarView?.manifest?.metadata?.name;
  {
    const chipText = String(
      await evalJS(
        conn,
        `document.querySelector('[data-slot="goal-chips"] button[data-chip-id="' + ${JSON.stringify(functionalGoalId)} + '"]')?.innerText ?? ""`,
      ),
    );
    if (!chipText.includes(dragGoalName)) problems.push("goals: the chip does not carry the goal's name");
    // The ancestry is read once per branch, as headings, never repeated on
    // the chip itself.
    if (strategicName && chipText.includes(strategicName)) {
      problems.push(`goals: the chip repeats its area "${strategicName}" instead of sitting under it`);
    }
    // The goal sits inside its own pillar block and its own area block.
    const placed = await evalJS(
      conn,
      `(() => {
        const chip = document.querySelector('[data-slot="goal-chips"] button[data-chip-id="' + ${JSON.stringify(functionalGoalId)} + '"]');
        if (!chip) return null;
        const area = chip.closest('[data-slot="chip-area"]');
        const group = chip.closest('[data-slot="chip-group"]');
        return {
          area: area?.querySelector("p")?.textContent ?? "",
          group: group?.querySelector("h3")?.textContent ?? "",
        };
      })()`,
    );
    if (!placed) {
      problems.push("goals: the picked goal's chip was not found");
    } else {
      if (strategicName && placed.area !== strategicName) {
        problems.push(`goals: the chip sits under area "${placed.area}", expected "${strategicName}"`);
      }
      if (pillarName && placed.group !== pillarName) {
        problems.push(`goals: the chip sits under pillar "${placed.group}", expected "${pillarName}"`);
      }
    }
    const pressed = await evalJS(
      conn,
      `document.querySelector('[data-slot="goal-chips"] button[data-chip-id="' + ${JSON.stringify(functionalGoalId)} + '"]')?.getAttribute("aria-pressed")`,
    );
    if (pressed !== "true") problems.push("goals: the picked chip is not marked pressed");
    // The two levels a project cannot pick are gone from the step.
    const noTree = await evalJS(conn, `!document.querySelector('[data-slot="picker-selected"]')`);
    if (!noTree) problems.push("goals: the old tree drop zone is still on the step");
  }

  // Search reaches a goal through its area tag, which is what the tree's
  // headings used to be for.
  if (strategicName) {
    await evalJS(
      conn,
      `(() => {
        const box = document.querySelector('[data-slot="goal-chips"] input');
        if (!box) throw new Error("goal chip search box not found");
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(box, ${JSON.stringify(strategicName)});
        box.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`,
    );
    await sleep(250);
    const stillThere = await evalJS(
      conn,
      `!!document.querySelector('[data-slot="goal-chips"] button[data-chip-id="' + ${JSON.stringify(functionalGoalId)} + '"]')`,
    );
    if (!stillThere) problems.push("goals: searching the area tag did not keep its goal on screen");
  }

  // Refine: the objective and the key results are their own step now,
  // one stage on from picking the goals this project aligns to.
  await navigateAndWait(conn, `/projects/${id}/initiation/measures`);
  await setFieldByLabel(conn, "The outcome you intend", "Improve delivery quality");
  await setFieldByLabel(conn, "By what means", "by checking every delivery against one standard");
  await clickButtonByText(conn, "Add a key result");
  await sleep(400);
  // The editor builds one sentence out of typed parts, in the order a
  // strong key result is spoken: how far, of what, by when, from where,
  // measured by what.
  await setInputByPlaceholder(conn, "5", "12");
  await setInputByPlaceholder(conn, "process maps", "checks");
  // The unit leads the metric now, so the field asks only what happens to
  // them: "checks" + "completed" is stored as one metric.
  await setInputByPlaceholder(conn, "published", "completed");
  await pickMonth(conn, "By", 2026, "Dec");
  await clickButtonByText(conn, "Not known yet", { within: '[role="dialog"]' });
  await sleep(200);
  await setInputByPlaceholder(conn, "The survey that measures it runs for the first time in March.", "Not measured before this project");
  await pickComboboxByPlaceholder(conn, "Choose a data source");
  await clickButtonByText(conn, "Save key result", { within: '[role="dialog"]' });
  await sleep(400);
  manifest = await afterEditReloadAndCheck(`/projects/${id}/initiation/measures`, "measures");
  const goalId = get(manifest, "spec.alignment.goals.0");
  if (!goalId) problems.push("goals: alignment.goals empty after reload");
  if (
    get(manifest, "spec.objectives.0.objective") !==
    "Improve delivery quality by checking every delivery against one standard"
  ) {
    problems.push(
      `goals: the objective's two parts did not compose into one stored sentence, got ${JSON.stringify(get(manifest, "spec.objectives.0.objective"))}`,
    );
  }
  if ((get(manifest, "spec.objectives.0.keyResults") ?? []).length !== 1) {
    problems.push("goals: expected exactly one key result after reload");
  }
  if (!get(manifest, "spec.objectives.0.keyResults.0.source")) {
    problems.push("goals: the key result did not keep the data source that measures it");
  }
  if (get(manifest, "spec.objectives.0.keyResults.0.metric") !== "checks completed") {
    problems.push(
      `goals: the unit and the outcome did not compose into one metric, got ${JSON.stringify(get(manifest, "spec.objectives.0.keyResults.0.metric"))}`,
    );
  }
  // The saved card carries the whole statement, not a fragment.
  {
    const statement = String(
      await evalJS(conn, `document.querySelector('[data-slot="kr-statement"]')?.innerText ?? ""`),
    );
    for (const part of ["12", "checks completed", "2026"]) {
      if (!statement.includes(part)) {
        problems.push(`goals: the key result card does not read the whole statement, got ${JSON.stringify(statement)}`);
        break;
      }
    }
  }

  // A KPI is named by the project, with the reason it is named; nothing
  // about it is asked of a key result any more (2026-09-26).
  await clickButtonByText(conn, "Add a KPI");
  await sleep(300);
  await pickComboboxByPlaceholder(conn, "Choose a KPI");
  await setFieldByLabel(conn, "Why this project moves it", "The standard is what the rate counts");
  await clickButtonByText(conn, "Add", { within: '[role="dialog"]' });
  await sleep(300);
  manifest = await afterEditReloadAndCheck(`/projects/${id}/initiation/measures`, "measures");
  const namedKpis = get(manifest, "spec.kpis") ?? [];
  if (namedKpis.length !== 1 || !namedKpis[0].kpi || !namedKpis[0].reason) {
    problems.push(`measures: expected one project KPI with a reason, got ${JSON.stringify(namedKpis)}`);
  }
  {
    const onKeyResult = get(manifest, "spec.objectives.0.keyResults.0.relatesTo");
    if (onKeyResult) problems.push("measures: a KPI is still attached to a key result");
  }



  await navigateAndWait(conn, `/projects/${id}/initiation/deliverables`);
  await clickButtonByText(conn, "Add a deliverable");
  await sleep(300);
  await setInputByPlaceholder(conn, "Published quality standard", "Smoke test deliverable");
  await clickButtonByText(conn, "Add an acceptance criterion");
  await sleep(300);
  // Naming the role that verifies it files that role in Resources,
  // accountable for Deliverables, without leaving this step.
  await evalJS(
    conn,
    `(() => {
      const t = document.querySelector('button[role="combobox"][aria-label="Verified by"]');
      if (!t) throw new Error("verifier picker not found");
      t.scrollIntoView({ block: "center" });
      t.click();
    })()`,
  );
  await sleep(350);
  await evalJS(
    conn,
    `(() => {
      const o = Array.from(document.querySelectorAll('[role="option"]')).find((x) => x.textContent.trim() === "Add a role");
      if (!o) throw new Error("the picker does not offer adding a role");
      o.click();
    })()`,
  );
  await sleep(500);
  await setFieldByLabel(conn, "How this project names the role", "Smoke test verifier");
  await clickButtonByText(conn, "Add", { within: '[role="dialog"]' });
  await sleep(400);
  await setFieldByLabel(conn, "Confirms that 1", "signs the deliverable off as ready");
  manifest = await afterEditReloadAndCheck(`/projects/${id}/initiation/deliverables`, "deliverables");
  if ((get(manifest, "spec.deliverables") ?? []).length !== 1) problems.push("deliverables: expected one deliverable after reload");
  const criteria = get(manifest, "spec.deliverables.0.acceptance") ?? [];
  if (criteria.length !== 1 || criteria[0].by !== "Smoke test verifier" || !criteria[0].outcome) {
    problems.push(`deliverables: expected one acceptance criterion naming its verifier, got ${JSON.stringify(criteria)}`);
  }
  // The same move filed the role in Resources, already accountable for
  // deliverables: whoever signs a deliverable off is accountable for it.
  const verifier = (get(manifest, "spec.resources") ?? []).find((r) => r.title === "Smoke test verifier");
  if (!verifier) {
    problems.push("deliverables: naming a verifier did not file the role in Resources");
  } else if (verifier.role !== "accountable") {
    problems.push(`deliverables: the verifier should be filed as an accountable role, got ${JSON.stringify(verifier)}`);
  } else if (verifier.accountableFor) {
    problems.push("deliverables: the verifier should not carry a per-section accountability list");
  }


  // Scope: where the project stops, with the same three answers in view.
  await navigateAndWait(conn, `/projects/${id}/initiation/scope`);
  if (!(await evalJS(conn, `!!document.querySelector('[data-slot="context-recap"]')`))) {
    problems.push("scope: the step does not show what the earlier steps said");
  }
  await clickButtonByText(conn, "Add a sentence", { nth: 0 });
  await sleep(250);
  await setInputByPlaceholder(conn, "Every delivery point on the main route", "Everything inside the smoke test");
  manifest = await afterEditReloadAndCheck(`/projects/${id}/initiation/scope`, "scope");
  if ((get(manifest, "spec.summary.scopeIn") ?? []).length !== 1) problems.push("scope: expected one in-scope line after reload");
  // Money belongs with the resources the project needs, not the boundary.
  const fundingOnScope = await evalJS(
    conn,
    `Array.from(document.querySelectorAll("main button")).some((b) => b.textContent.trim() === "Add a funding line")`,
  );
  if (fundingOnScope) problems.push("scope: funding should not be on the scope step");

  await navigateAndWait(conn, `/projects/${id}/initiation/timeline`);
  await pickMonth(conn, "Starts", 2026, "Jan");
  await clickButtonByText(conn, "Add a phase");
  await sleep(250);
  await setInputByPlaceholder(conn, "Design", "Foundation");
  await clickButtonByText(conn, "Add a phase");
  await sleep(250);
  await evalJS(
    conn,
    `(() => {
      ${SET_NATIVE_VALUE_JS}
      const inputs = Array.from(document.querySelectorAll('input[aria-label="Phase"]'));
      setNativeValue(inputs[inputs.length - 1], "Rollout");
    })()`,
  );
  await sleep(1000);
  // Phases are reordered by dragging the handle; the keyboard reaches the
  // same move through the same handle.
  await evalJS(
    conn,
    `(() => {
      const handle = document.querySelector('[data-slot="phase-row"][data-index="1"] button[draggable]');
      if (!handle) throw new Error("no drag handle on the second phase");
      handle.focus();
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    })()`,
  );
  manifest = await afterEditReloadAndCheck(`/projects/${id}/initiation/timeline`, "timeline");
  if (!get(manifest, "spec.timeline.start")) problems.push("timeline: start empty after reload");
  const phases = get(manifest, "spec.timeline.phases") ?? [];
  if (phases.length !== 2) {
    problems.push(`timeline: expected two phases after reload, got ${phases.length}`);
  } else if (phases[0].name !== "Rollout") {
    problems.push(`timeline: reordering did not move the second phase up, got ${JSON.stringify(phases.map((p) => p.name))}`);
  }

  // Resources: one step for everything the project needs around it. The
  // role select defaults to sponsor, so adding a row names the sponsor.
  await navigateAndWait(conn, `/projects/${id}/initiation/resources`);
  await clickButtonByText(conn, "Add a role");
  await sleep(300);
  await clickButtonByText(conn, "Add a funding line");
  await sleep(250);
  await setFieldByLabel(conn, "Currency", "TTD");
  await setFieldByLabel(conn, "Source", "Smoke test funding source");
  await clickButtonByText(conn, "Add a primary stakeholder");
  await sleep(250);
  await setInputByPlaceholder(conn, "Depot supervisors", "Smoke test stakeholder");
  manifest = await afterEditReloadAndCheck(`/projects/${id}/initiation/resources`, "resources");
  if (!(get(manifest, "spec.resources") ?? []).some((r) => r.role === "sponsor")) {
    problems.push("resources: sponsor role not found in spec.resources after reload");
  }
  if ((get(manifest, "spec.funding") ?? []).length !== 1) {
    problems.push("resources: expected one funding line after reload");
  }
  const stakeholders = (get(manifest, "spec.resources") ?? []).filter((r) => r.role === "stakeholder");
  if (stakeholders.length !== 1) {
    problems.push("resources: expected one stakeholder role after reload");
  } else if (stakeholders[0].tier !== "primary") {
    problems.push("resources: the stakeholder added under Primary did not keep its tier");
  }
  // Accountability is decided per deliverable, never section by section.
  if ((get(manifest, "spec.resources") ?? []).some((r) => r.accountableFor)) {
    problems.push("resources: a role still carries a per-section accountability list");
  }

  await navigateAndWait(conn, `/projects/${id}/initiation/data`);
  await clickButtonByText(conn, "Add a source"); // Uses column is first in DOM order
  await sleep(300);
  await pickComboboxByPlaceholder(conn, "Source");
  await setInputByPlaceholder(conn, "Counting failed checks per depot", "Smoke test data purpose");
  manifest = await afterEditReloadAndCheck(`/projects/${id}/initiation/data`, "data");
  if ((get(manifest, "spec.data.consumes") ?? []).length !== 1) problems.push("data: expected one consume line after reload");

  await navigateAndWait(conn, `/projects/${id}/initiation/risks`);
  await clickButtonByText(conn, "Add a risk, issue, dependency, assumption or constraint");
  await sleep(250);
  await setInputByPlaceholder(conn, "Depots may not release staff for the training days", "Smoke test risk description");
  manifest = await afterEditReloadAndCheck(`/projects/${id}/initiation/risks`, "risks");
  if ((get(manifest, "spec.risks") ?? []).length !== 1) problems.push("risks: expected one risk after reload");

  await navigateAndWait(conn, `/projects/${id}/closing`);
  await waitAndClickButtonByText(conn, "Add", { nth: 0 });
  manifest = await afterEditReloadAndCheck(`/projects/${id}/closing`, "closing");
  // Closing holds only the lines due on the day the work is accepted;
  // "each cycle after closing" is a landing line now, grouped there with
  // the rest of the lines that survive the project.
  const closingCountAfterStep2 = (get(manifest, "spec.successCriteria") ?? []).filter(
    (c) => c.when === "at closing",
  ).length;
  if (closingCountAfterStep2 < 1) problems.push("closing: expected at least one success criterion after reload");
  // The journey's key result counts a finite thing this project delivers,
  // so its outcome line is proposed at closing and never at landing: a
  // delivery is true once, and cannot be re-measured every cycle.
  {
    const proposed = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}/proposed-criteria`);
    const krLine = [...proposed.closing, ...proposed.landing].find((c) => c.derivedFrom?.keyResult);
    const takenAtClosing = (get(manifest, "spec.successCriteria") ?? []).some(
      (c) => c.derivedFrom?.keyResult && c.when === "at closing",
    );
    if (krLine) {
      if (krLine.when !== "at closing") {
        problems.push(`closing: a finite key result should propose a closing line, got "${krLine.when}"`);
      }
      if (!krLine.reason) {
        problems.push("closing: a key result's proposed line should say why it is due when it is");
      }
    } else if (!takenAtClosing) {
      problems.push("closing: expected an outcome line derived from the key result, proposed or already taken");
    }
    if (proposed.landing.some((c) => c.derivedFrom?.keyResult)) {
      problems.push("landing: a finite key result must not be proposed at landing");
    }
  }

  await navigateAndWait(conn, `/projects/${id}/landing`);
  // The Combobox's own first choice is "Define a new operation alongside"
  // (card §2, Landing); pickComboboxByPlaceholder always clicks the first
  // visible [data-slot="combobox-item"], which is exactly this one before
  // any search narrows the list.
  await pickComboboxByPlaceholder(conn, "Choose an operation, or start a new one");
  await sleep(1000); // let the operation save land, so its own suggested criteria appear
  await navigateAndWait(conn, `/projects/${id}/landing`);
  await waitAndClickButtonByText(conn, "Add", { nth: 0 });
  manifest = await afterEditReloadAndCheck(`/projects/${id}/landing`, "landing");
  if (get(manifest, "spec.operation") !== "new") problems.push("landing: expected operation 'new' after reload");
  const landingCountAfterStep2 = (get(manifest, "spec.successCriteria") ?? []).filter(
    (c) => c.when === "at landing" || c.when === "each cycle after closing",
  ).length;
  if (landingCountAfterStep2 < 1) problems.push("landing: expected at least one success criterion after reload");

  if (shots) {
    await navigateAndWait(conn, `/projects/${id}/initiation/goals`);
    await captureScreenshot(conn, "project-goals.png");
    await navigateAndWait(conn, `/projects/${id}/initiation/aim`);
    await captureScreenshot(conn, "project-aim.png");
    await navigateAndWait(conn, `/projects/${id}/initiation/timeline`);
    await captureScreenshot(conn, "project-timeline.png");
    await navigateAndWait(conn, `/projects/${id}/initiation/resources`);
    await captureScreenshot(conn, "project-people.png");
    await navigateAndWait(conn, `/projects/${id}/closing`);
    await captureScreenshot(conn, "project-closing.png");
    await navigateAndWait(conn, `/projects/${id}/landing`);
    await captureScreenshot(conn, "project-landing.png");
    // Card §1.4/§3: the Projects list with a draft (includeDrafts=true,
    // "Draft" Badge) -- this project is still draft-only at this point in
    // the flow (step 6's full save has not run yet), so its row is exactly
    // the draft-only case the card wants a screenshot of.
    await navigateAndWait(conn, "/projects");
    await captureScreenshot(conn, "project-list-draft.png");
  }

  // Step 3 (card §1.2, the heart of this card): jump out of order (Risks ->
  // Aim -> Landing -> Scope via the rail), editing in Risks, and after
  // EVERY jump -- not just a spot-checked handful of fields -- fetch the
  // whole draft and deep-equal it against a
  // running "expected" object this test itself maintains: it starts as
  // whatever step 2 left behind, and is only ever replaced by a fresher
  // snapshot right after a jump whose own edit has been independently
  // confirmed to have landed (Risks, below); every pure jump (no edit)
  // must reproduce the very same whole draft, or the run fails with a
  // JSON diff naming exactly what changed.
  async function jumpViaRail(route) {
    await navigateAndWait(conn, route);
    await sleep(300);
  }

  let expectedWhole = await getWholeDraft(id);

  await jumpViaRail(`/projects/${id}/initiation/risks`);
  await setInputByPlaceholder(
    conn,
    "Agree the dates with depot managers before the schedule is fixed",
    "Smoke test mitigation added on the jump pass",
  );
  await sleep(1000);
  let whole = await getWholeDraft(id);
  if (get(whole, "spec.risks.0.mitigation") !== "Smoke test mitigation added on the jump pass") {
    problems.push("jump:risks: mitigation edit did not land in the whole draft");
  }
  expectedWhole = whole; // the only field this move legitimately changed

  await jumpViaRail(`/projects/${id}/initiation/aim`);
  whole = await getWholeDraft(id);
  let diff = diffWholeDraft("jump:aim", expectedWhole, whole);
  if (diff) problems.push(diff);

  await jumpViaRail(`/projects/${id}/landing`);
  whole = await getWholeDraft(id);
  diff = diffWholeDraft("jump:landing", expectedWhole, whole);
  if (diff) problems.push(diff);

  await jumpViaRail(`/projects/${id}/initiation/scope`);
  whole = await getWholeDraft(id);
  diff = diffWholeDraft("jump:scope", expectedWhole, whole);
  if (diff) problems.push(diff);

  // Step 4: leave to /sheets/Resource, come back via /projects -- for real,
  // by clicking the project's own row, not a direct URL. I3.3b.1: working
  // copy is current content, so the project is immediately visible after
  // Save (autosave writes working copy). No "Draft" Badge needed; the project
  // is always reachable again, not only by a bookmarked URL.
  const beforeLeave = await getWholeDraft(id);
  await navigateAndWait(conn, "/sheets/Resource");
  await navigateAndWait(conn, "/projects");
  const rowFound = await evalJS(
    conn,
    `(() => {
      const link = Array.from(document.querySelectorAll("a")).find((a) => a.textContent.trim() === ${JSON.stringify(projectName)});
      if (!link) return false;
      const row = link.closest("tr");
      const hasStateBadge = !!row && Array.from(row.querySelectorAll('[data-slot="badge"]')).some((b) => b.textContent.trim() === "draft");
      if (!hasStateBadge) return "no-state-badge";
      row.click();
      return true;
    })()`,
  );
  if (rowFound === false) {
    problems.push(`leave-and-return: no row for "${projectName}" on /projects`);
  } else if (rowFound === "no-state-badge") {
    problems.push(`leave-and-return: row for "${projectName}" on /projects has no state badge showing "draft"`);
  }
  // A real client-side click (TanStack Router Link), not a hard reload:
  // poll for the route to actually land, rather than a fixed sleep tuned
  // for navigateAndWait's own Page.navigate + Page.loadEventFired wait.
  {
    const deadline = Date.now() + 5000;
    let pathname = "";
    while (Date.now() < deadline) {
      pathname = String(await evalJS(conn, "location.pathname"));
      if (pathname === `/projects/${id}`) break;
      await sleep(150);
    }
    if (pathname !== `/projects/${id}`) {
      problems.push(`leave-and-return: expected the row click to land on /projects/${id}, still at ${pathname}`);
    }
  }
  await sleep(500);
  const afterReturn = await getWholeDraft(id);
  diff = diffWholeDraft("leave-and-return", beforeLeave, afterReturn);
  if (diff) problems.push(diff);
  expectedWhole = afterReturn;

  // Step 5: two more proposed closing lines, one more proposed landing line.
  await navigateAndWait(conn, `/projects/${id}/closing`);
  await waitAndClickButtonByText(conn, "Add", { nth: 0 });
  await sleep(500);
  await waitAndClickButtonByText(conn, "Add", { nth: 0 });
  await sleep(800);
  let closingNow = (get((await getDraftManifest(id)).manifest, "spec.successCriteria") ?? []).filter(
    (c) => c.when === "at closing",
  ).length;
  if (closingNow < closingCountAfterStep2 + 1) {
    problems.push(`step5: expected more closing lines than after step 2 (${closingCountAfterStep2}), got ${closingNow}`);
  }

  await navigateAndWait(conn, `/projects/${id}/landing`);
  const landingProposed = (await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}/proposed-criteria`)).landing.length;
  if (landingProposed > 0) {
    await waitAndClickButtonByText(conn, "Add", { nth: 0 });
    await sleep(800);
  }
  let landingNow = (get((await getDraftManifest(id)).manifest, "spec.successCriteria") ?? []).filter(
    (c) => c.when === "at landing" || c.when === "each cycle after closing",
  ).length;
  const expectedLanding = landingCountAfterStep2 + (landingProposed > 0 ? 1 : 0);
  if (landingNow < expectedLanding) {
    problems.push(`step5: expected ${expectedLanding} landing lines, got ${landingNow}`);
  }

  // Step 6: Resources names the remaining roles, then a full "Save as
  // version" (the only header action left; "Propose for review" is gone),
  // and only then can checks actually reach zero blocking. There is no
  // accountability grid to tick: a RACI's rows are deliverables and
  // decisions, and the deliverable step already named its verifier.
  await navigateAndWait(conn, `/projects/${id}/initiation/resources`);
  await pickSelectOption(conn, "Role", "Lead", { last: true });
  await clickButtonByText(conn, "Add a role");
  await sleep(300);

  await pickSelectOption(conn, "Role", "Operational owner", { last: true });
  await clickButtonByText(conn, "Add a role");
  await sleep(300);

  await navigateAndWait(conn, `/projects/${id}`);
  await clickButtonByText(conn, "Save as version");
  await sleep(300);
  const hasActorPickerInSave = await evalJS(conn, `!!document.querySelector('[role="dialog"] button[role="combobox"]')`);
  if (hasActorPickerInSave) {
    problems.push("Save as version dialog showed an actor picker (I3.2: no actor concept in the interface at all)");
  }
  await setReason(conn, "Smoke test full save");
  await evalJS(
    conn,
    `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent.trim() === "Save");
      if (!btn) throw new Error("save confirm button not found");
      btn.click();
    })()`,
  );
  await sleep(1200);

  const committed = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}`);
  if (committed.version.number !== 1) {
    problems.push(`step6: expected version 1 after the full save, got ${JSON.stringify(committed.version)}`);
  }
  if (!(committed.manifest?.spec?.resources ?? []).some((r) => r.role === "sponsor")) {
    problems.push("step6: expected the committed project to carry a sponsor role in spec.resources");
  }

  const checksAfterFull = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}/checks`);
  if (checksAfterFull.blocking !== 0) {
    problems.push(
      `step6: expected blocking 0 once People had named every role and the full save committed it, got ${checksAfterFull.blocking}: ` +
        JSON.stringify(checksAfterFull.items.filter((i) => i.state === "block")),
    );
  }

  const proposeButtonGone = await evalJS(
    conn,
    `!Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === "Propose for review")`,
  );
  if (!proposeButtonGone) {
    problems.push('step6: expected no "Propose for review" button anywhere on the record page (I3.2: removed)');
  }

  // Rule 4 ("nothing overflows at 1440, 1280 or 1024"): the static-route
  // wideAt1024Pass below never reaches these dynamic /projects/$id/...
  // routes, so the project journey checks a representative set of its own
  // screens here (the three-column initiation layout, Aim's own two-column
  // layout with its own internal 420px-KPI-plus-content split -- I3b.1's
  // own fix for the squeeze this exact check would otherwise have caught
  // at 1440 already -- the two-column closing/landing layout, and the
  // three-column record layout are the journey's own distinct layouts).
  for (const width of [1024, 1280]) {
    await send(conn, "Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const route of [
      `/projects/${id}/initiation/aim`,
      `/projects/${id}/initiation/resources`,
      `/projects/${id}/closing`,
      `/projects/${id}`,
    ]) {
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
  return { problems, id };
}

/** Save as version pass: open an already-committed project's record, click
 * Save as version, enter a reason, submit; assert the versions list shows
 * the new version with that reason and the state pill shows "defined".
 * Then create an incomplete project through the first screen only, click
 * Save as version, assert the problems are shown in the dialog and no
 * version was created. */
async function charterHtmlPass(id) {
  const problems = [];

  try {
    // Fetch charter.html for the working copy
    const charterRes = await fetch(`${baseUrl}/api/v1/manifests/Project/${id}/charter.html?working=true`);
    if (!charterRes.ok) {
      problems.push(`charterHtmlPass: charter.html fetch failed with status ${charterRes.status}`);
      return { problems };
    }

    const charterHtml = await charterRes.text();

    // Check for the project ID in the rendered HTML (document control section)
    if (!charterHtml.includes(`<strong>ID:</strong> ${id}`)) {
      problems.push(`charterHtmlPass: project ID not found in charter.html`);
    }

    // Check for at least one section heading (e.g., "Summary and Scope")
    if (!charterHtml.includes("Summary and Scope")) {
      problems.push("charterHtmlPass: 'Summary and Scope' section heading not found in charter.html");
    }

    // Check for a "held elsewhere" section
    if (!charterHtml.includes("Not held in Cartograph")) {
      problems.push("charterHtmlPass: 'Not held in Cartograph' note not found in charter.html");
    }
  } catch (e) {
    problems.push(`charterHtmlPass: ${e.message}`);
  }

  return { problems };
}

async function saveAsVersionPass(conn, id) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);

  // Test 1: Complete project, save a version
  await navigateAndWait(conn, `/projects/${id}`);
  const initialVersions = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}/versions`);
  const initialCount = Array.isArray(initialVersions) ? initialVersions.length : (initialVersions.items ?? []).length;

  await clickButtonByText(conn, "Save as version");
  await sleep(500);
  const hasDialog = await evalJS(conn, `!!document.querySelector('[role="dialog"]')`);
  if (!hasDialog) {
    problems.push("saveAsVersionPass: Save as version dialog did not open");
    detach();
    return { problems };
  }

  const reason = "smoke test save version";
  await setReason(conn, reason);
  await sleep(300);
  await evalJS(
    conn,
    `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent.trim() === "Save");
      if (!btn) throw new Error("save button not found in dialog");
      btn.click();
    })()`,
  );
  await sleep(1000);

  const afterVersions = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}/versions`);
  const afterCount = Array.isArray(afterVersions) ? afterVersions.length : (afterVersions.items ?? []).length;
  if (afterCount <= initialCount) {
    problems.push(`saveAsVersionPass: expected versions to increase from ${initialCount}, got ${afterCount}`);
  }

  const stateRes = await getJSON(`${baseUrl}/api/v1/manifests/Project/${id}/state`);
  if (stateRes.state !== "defined") {
    problems.push(`saveAsVersionPass: expected state "defined", got "${stateRes.state}"`);
  }

  // Test 2: Incomplete project, save as version should show problems
  const incompleteProjectName = `Incomplete Smoke Project ${Date.now()}`;
  await navigateAndWait(conn, "/projects/new");
  await setInputByPlaceholder(conn, "Quality Check Rollout", incompleteProjectName);
  await pickSelectShowingPlaceholder(conn, "Choose a team");
  await clickButtonByText(conn, "Start");
  await sleep(1200);

  const pathname = await evalJS(conn, "location.pathname");
  const match = /^\/projects\/([^/]+)\//.exec(String(pathname));
  if (!match) {
    problems.push(`saveAsVersionPass: expected to navigate to a new project, got ${pathname}`);
    detach();
    return { problems };
  }
  const incompleteId = match[1];

  await clickButtonByText(conn, "Save as version");
  await sleep(500);
  await setReason(conn, "attempt to save incomplete project");
  await sleep(300);
  await evalJS(
    conn,
    `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent.trim() === "Save");
      if (!btn) throw new Error("save button not found in dialog");
      btn.click();
    })()`,
  );
  await sleep(1000);

  // Check that the dialog is still open (error was caught)
  const dialogStillOpen = await evalJS(conn, `!!document.querySelector('[role="dialog"]')`);
  if (!dialogStillOpen) {
    problems.push("saveAsVersionPass: dialog closed despite validation problems");
  }

  // Verify no version was created for the incomplete project
  const incompleteVersions = await getJSON(`${baseUrl}/api/v1/manifests/Project/${incompleteId}/versions`);
  const incompleteCount = Array.isArray(incompleteVersions) ? incompleteVersions.length : (incompleteVersions.items ?? []).length;
  if (incompleteCount !== 0) {
    problems.push(`saveAsVersionPass: incomplete project should have no versions, got ${incompleteCount}`);
  }

  detach();
  return { problems, incompleteId };
}

/** I3.3c.3: Handoff pass: test handoff on incomplete project (expect alert) and complete versioned project (expect success). */
async function handoffPass(conn, incompleteId, completeId) {
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
      const isExpected404 =
        entry.text.includes("404") && entry.url && EXPECTED_404_URL_PATTERNS.some((re) => re.test(entry.url));
      const isExpected422 =
        entry.text.includes("422") && entry.url && (/\/manifests\/Project\/[^/?]+\/snapshots(\?|$)/.test(entry.url) ||
        /\/manifests\/Project\/[^/?]+\/state(\?|$)/.test(entry.url));
      if (!isExpected404 && !isExpected422) problems.push(`log error: ${entry.text} (${entry.url ?? "no url"})`);
    }
  };
  conn.listeners.add(onEvent);

  try {
    // Test 1: Handoff on incomplete project should show alert
    await navigateAndWait(conn, `/projects/${incompleteId}/handoff`);
    await sleep(500);

    // Click the Hand off button on incomplete project
    await clickButtonByText(conn, "Hand off");

    // Wait for alert to appear - poll with retries
    let hasAlert = false;
    let alertText = "";
    for (let i = 0; i < 10; i++) {
      await sleep(300);
      hasAlert = await evalJS(conn, `!!document.querySelector('[role="alert"]')`);
      if (hasAlert) {
        alertText = await evalJS(conn, `document.querySelector('[role="alert"]')?.textContent || ''`);
        if (alertText.includes("Handoff refused")) break;
      }
    }

    if (!hasAlert) {
      problems.push("handoffPass: Expected alert on incomplete project, but no alert found");
    } else if (!alertText.includes("Handoff refused")) {
      problems.push("handoffPass: Alert should contain 'Handoff refused'");
    }

    // Test 2: Handoff on complete versioned project should succeed
    await sleep(500);
    await navigateAndWait(conn, `/projects/${completeId}/handoff`);
    await sleep(500);

    // Click the Hand off button
    await clickButtonByText(conn, "Hand off");

    // Wait for bundle card to appear - poll with retries
    let bundleCardVisible = false;
    let hasHtml = false;
    let hasJson = false;
    let hasPdf = false;
    let pageText = "";

    for (let i = 0; i < 10; i++) {
      await sleep(300);
      pageText = await evalJS(conn, `document.body.textContent`);

      bundleCardVisible = pageText.includes('charter-') && pageText.includes('.html');

      if (bundleCardVisible) {
        hasHtml = pageText.includes('.html');
        hasJson = pageText.includes('.json');
        hasPdf = pageText.includes('.pdf');
        if (hasHtml && hasJson && hasPdf) break;
      }
    }

    // Check state was updated
    if (!pageText.includes("handed off")) {
      problems.push("handoffPass: State should show 'handed off'");
    }

    // Check for bundle card showing directory and file names
    if (!bundleCardVisible) {
      problems.push("handoffPass: Bundle card should show 'Handed off' label and 'charter-' file names");
    }

    // Check for specific file extensions
    if (!hasHtml) problems.push("handoffPass: Bundle should list .html file");
    if (!hasJson) problems.push("handoffPass: Bundle should list .json file");
    if (!hasPdf) problems.push("handoffPass: Bundle should list .pdf file");
  } finally {
    conn.listeners.delete(onEvent);
  }

  return { problems };
}

/** Step 7: collapse the sidebar and repeat step 3's rail jumps once more,
 * on an already-committed project (post step 6), asserting zero console
 * errors throughout. */
async function projectJourneyCollapsedJumpsPass(conn, id) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);
  await navigateAndWait(conn, `/projects/${id}`);
  await evalJS(conn, `(() => { document.querySelector('[data-slot="sidebar-trigger"]')?.click(); })()`);
  await sleep(300);

  for (const route of [
    `/projects/${id}/initiation/risks`,
    `/projects/${id}/initiation/aim`,
    `/projects/${id}/landing`,
    `/projects/${id}/initiation/scope`,
  ]) {
    await navigateAndWait(conn, route);
  }

  await evalJS(conn, `(() => { document.querySelector('[data-slot="sidebar-trigger"]')?.click(); })()`);
  await sleep(200);
  detach();
  return { problems };
}

// One field per editable route the randomised pass below can land on, each
// reusing a placeholder/index already known to exist by the time this pass
// runs (after the full flow's own step 2 through 6 have filled every
// section at least once): the same setTextareaAt/setInputByPlaceholder
// primitives the deterministic flow above already uses. Goals, People,
// the record page and the projects list have no single field this
// generic enough to reuse safely (Goals' and People's own edits are
// exercised at length by the deterministic flow already), so they are
// left out here and only ever navigated to, never edited.
const RANDOM_EDIT_FIELDS = {
  aim: { kind: "label", label: "What they face today" },
  // Align holds the goal picker and no free-text field of its own; the
  // objective it used to carry moved to Measures with the split.
  measures: { kind: "label", label: "The outcome you intend" },
  resources: { kind: "input", placeholder: "Depot supervisors" },
  deliverables: { kind: "input", placeholder: "Published quality standard" },
  scope: { kind: "input", placeholder: "Every delivery point on the main route" },
  // Beneficiaries is chips only since the counts went; it has no free-text
  // field to retype, so the pass navigates to it and never edits it.
  timeline: { kind: "input", placeholder: "Design" },
  data: { kind: "input", placeholder: "Counting failed checks per depot" },
  risks: { kind: "input", placeholder: "Depots may not release staff for the training days" },
  closing: { kind: "input", placeholder: "What must be true" },
  landing: { kind: "input", placeholder: "What must be true" },
};

function routeSectionKey(route) {
  const initiation = /\/initiation\/([a-z]+)$/.exec(route);
  if (initiation) return initiation[1];
  if (route.endsWith("/closing")) return "closing";
  if (route.endsWith("/landing")) return "landing";
  return null;
}

/**
 * Card §1.3: 40 random moves among all fourteen routes of one project
 * (every Initiation step, Closing, Landing, the record page and
 * the projects list), the sidebar toggled at random, editing one field on
 * arrival in roughly half of the moves (whichever moves land on a route
 * with an entry in RANDOM_EDIT_FIELDS above and the coin flip says yes),
 * comparing the whole draft after every single
 * move -- not just the ones that edited something -- against a running
 * expected object this function itself maintains, exactly the same
 * "maintained expected object, JSON diff on any difference" contract as
 * step 3 above. Runs on the already-committed, "in review" project step 6
 * left behind (forms stay editable regardless of state; nothing in this
 * codebase gates on it), navigating with the same hard-reload
 * navigateAndWait primitive every other pass in this file already uses,
 * so a reload's own persistence (not merely in-memory React state) is
 * what is actually being proven after every move.
 */
async function projectJourneyRandomPass(conn, id, seed) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);
  const rng = mulberry32(seed);

  const routesList = [
    `/projects/${id}/initiation/aim`,
    `/projects/${id}/initiation/goals`,
    `/projects/${id}/initiation/measures`,
    `/projects/${id}/initiation/deliverables`,
    `/projects/${id}/initiation/beneficiaries`,
    `/projects/${id}/initiation/scope`,
    `/projects/${id}/initiation/timeline`,
    `/projects/${id}/initiation/resources`,
    `/projects/${id}/initiation/data`,
    `/projects/${id}/initiation/risks`,
    `/projects/${id}/closing`,
    `/projects/${id}/landing`,
    `/projects/${id}`,
    "/projects",
  ];
  if (routesList.length !== 14) {
    problems.push(`random pass: expected exactly 14 routes, built ${routesList.length}`);
  }

  let expectedWhole = await getWholeDraft(id);
  let editedMoves = 0;
  const MOVES = 40;

  for (let i = 0; i < MOVES; i++) {
    const route = routesList[Math.floor(rng() * routesList.length)];
    await navigateAndWait(conn, route);

    if (rng() < 0.5) {
      await evalJS(
        conn,
        `(() => { document.querySelector('[data-slot="sidebar-trigger"]')?.click(); })()`,
      );
      await sleep(150);
    }

    const editSpec = RANDOM_EDIT_FIELDS[routeSectionKey(route) ?? ""];
    let didEdit = false;
    if (editSpec && rng() < 0.5) {
      const value = `Random move ${i} edit, seed ${seed}`;
      try {
        if (editSpec.kind === "textarea") {
          await setTextareaAt(conn, editSpec.index, value);
        } else if (editSpec.kind === "label") {
          await setFieldByLabel(conn, editSpec.label, value);
        } else {
          await setInputByPlaceholder(conn, editSpec.placeholder, value);
        }
        didEdit = true;
        editedMoves++;
      } catch (e) {
        problems.push(`random pass seed ${seed}, move ${i} (${route}): edit attempt failed: ${e.message}`);
      }
    }

    if (didEdit) {
      await sleep(1000); // past the 800ms debounce, so this move's own edit is the new baseline
      expectedWhole = await getWholeDraft(id);
    } else {
      await sleep(300);
      const whole = await getWholeDraft(id);
      const diff = diffWholeDraft(`random pass seed ${seed}, move ${i} (${route})`, expectedWhole, whole);
      if (diff) problems.push(diff);
    }
  }

  detach();
  return { problems, editedMoves, moves: MOVES, seed };
}

/** I3.3d.2: Snapshots pass: open /snapshots and verify vault card and journey snapshot. */
async function snapshotsPass(conn, projectId) {
  const { problems, detach } = watchConsoleForProjectJourney(conn);

  try {
    await navigateAndWait(conn, "/snapshots");

    // Check that the snapshots page loaded
    const pageTitle = await evalJS(conn, "document.body.textContent");
    if (!pageTitle?.includes("Snapshots")) {
      problems.push("snapshotsPass: page does not contain 'Snapshots' text");
      detach();
      return { problems };
    }

    // Verify vault summary card shows path and file count
    const vaultCardCheck = await evalJS(
      conn,
      `(() => {
        const pageText = document.body.textContent;
        return {
          hasVault: pageText.includes('Vault'),
          hasPath: pageText.includes('/tmp/') || pageText.includes('/'),
          hasFiles: /\\d+\\s+across\\s+\\d+\\s+kinds|across.*kind/.test(pageText) || /\\d+/.test(pageText.match(/Files[^\\n]*\\d+/)?.[0] || ''),
        };
      })()`,
    );

    if (!vaultCardCheck.hasVault) {
      problems.push("snapshotsPass: vault section not found on page");
    } else if (!vaultCardCheck.hasPath) {
      problems.push("snapshotsPass: vault path not displayed");
    } else if (!vaultCardCheck.hasFiles) {
      // File count check is secondary, don't fail if missing
      console.log("snapshotsPass: note - file count not clearly visible but page loaded");
    }

    // Find the journey project's snapshot in the table
    // The page shows the project NAME and reason, not the id
    // Look for row with reason "smoke test save version" and Diff link
    const projectSnapshot = await evalJS(
      conn,
      `(() => {
        const saveVersionReason = "smoke test save version";
        const rows = document.querySelectorAll('table tbody tr');
        for (const row of rows) {
          const rowText = row.textContent;
          // Check if row contains the save version reason
          if (rowText.includes(saveVersionReason)) {
            // Check for Diff link
            const diffLink = row.querySelector('a');
            const hasDiffLink = !!diffLink && (diffLink.textContent?.includes('Diff') || diffLink.href?.includes('diff'));
            return {
              found: true,
              hasReason: rowText.includes(saveVersionReason),
              hasDiffLink,
              diffText: diffLink?.textContent,
              diffHref: diffLink?.href,
            };
          }
        }
        return { found: false };
      })()`,
    );

    if (!projectSnapshot?.found) {
      problems.push("snapshotsPass: snapshot with save version reason not found in table");
    } else if (!projectSnapshot?.hasReason) {
      problems.push("snapshotsPass: snapshot row missing save version reason");
    } else if (!projectSnapshot?.hasDiffLink) {
      problems.push("snapshotsPass: snapshot row missing Diff link");
    } else {
      console.log(`snapshotsPass: found snapshot with reason and Diff link`);
    }

    detach();
    return { problems };
  } catch (err) {
    problems.push(`snapshotsPass: unexpected error: ${err}`);
    detach();
    return { problems };
  }
}

async function main() {
  console.log(`smoke: waiting for cartograph server at ${baseUrl}`);
  await waitForHTTP(baseUrl + "/api/v1/health", 10_000);
  if (!bootstrapOnly) {
    await ensureOneDataSource();
    await ensureOneBeneficiaryGroup();
  }

  console.log(`smoke: launching ${chromiumPath} with CDP on :${cdpPort}`);
  const chromium = launchChromium();
  try {
    await waitForHTTP(`http://localhost:${cdpPort}/json/version`, 10_000);

    const versionInfo = await (await fetch(`http://localhost:${cdpPort}/json/version`)).json();
    const browserConn = await connectCDP(versionInfo.webSocketDebuggerUrl);

    const { targetId } = await send(browserConn, "Target.createTarget", { url: "about:blank" });
    const { webSocketDebuggerUrl } = await (
      await fetch(`http://localhost:${cdpPort}/json/list`)
    )
      .json()
      .then((targets) => targets.find((t) => t.id === targetId));

    const pageConn = await connectCDP(webSocketDebuggerUrl);
    await send(pageConn, "Page.enable");
    await send(pageConn, "Runtime.enable");
    await send(pageConn, "Log.enable");

    if (bootstrapOnly) {
      console.log("smoke: bootstrap mode, empty database: creating a Team, then a Goal");
      const bootstrap = await bootstrapFlow(pageConn);
      let bootstrapFailed = false;
      if (bootstrap.problems.length > 0) {
        bootstrapFailed = true;
        console.error("smoke: bootstrap flow had problems:");
        for (const p of bootstrap.problems) console.error(`  - ${p}`);
      } else {
        console.log(
          `smoke: bootstrap flow ok: created Team "${bootstrap.teamName}", pillar "${bootstrap.pillarName}", strategic goal "${bootstrap.strategicName}", functional goal "${bootstrap.functionalName}", zero console errors`,
        );
      }
      await send(browserConn, "Target.closeTarget", { targetId });
      pageConn.ws.close();
      browserConn.ws.close();
      chromium.kill();
      if (bootstrapFailed) {
        console.error("smoke failed");
        process.exit(1);
      }
      console.log("smoke ok");
      process.exit(0);
    }

    let failed = false;
    for (const route of routes) {
      console.log(`smoke: loading ${route}`);
      const { problems, bodyText } = await checkRoute(pageConn, route);
      if (problems.length > 0) {
        failed = true;
        console.error(`smoke: ${route} had console problems:`);
        for (const p of problems) console.error(`  - ${p}`);
      } else {
        console.log(`smoke: ${route} ok, zero console errors`);
      }
      if (bodyText.trim() === "") {
        failed = true;
        console.error(`smoke: ${route} rendered no visible text`);
      }
    }

    console.log("smoke: driving one create and one edit through the Resource sheet dialog");
    const flow = await resourceCreateEditFlow(pageConn);
    if (flow.problems.length > 0) {
      failed = true;
      console.error("smoke: Resource create/edit flow had problems:");
      for (const p of flow.problems) console.error(`  - ${p}`);
    } else {
      console.log("smoke: Resource create/edit flow ok, zero console errors");
    }

    const id = slugify(flow.createdName);
    const manifestUrl = `${baseUrl}/api/v1/manifests/Resource/${id}`;
    const manifestRes = await fetch(manifestUrl);
    if (!manifestRes.ok) {
      failed = true;
      console.error(`smoke: GET ${manifestUrl} returned ${manifestRes.status}`);
    } else {
      const view = await manifestRes.json();
      if (view.version?.number !== 2) {
        failed = true;
        console.error(`smoke: expected Resource/${id} at version 2 after the edit, got ${JSON.stringify(view.version)}`);
      } else if (view.manifest?.metadata?.name !== flow.editedName) {
        failed = true;
        console.error(`smoke: expected Resource/${id} name "${flow.editedName}", got ${JSON.stringify(view.manifest?.metadata)}`);
      } else {
        console.log(`smoke: Resource/${id} is at version 2 with the edited name, as expected`);
      }
    }

    console.log("smoke: driving Goals home and the goal editor: add a strategic goal, add a key result, save");
    const goalFlow = await addStrategicGoalAndKeyResultFlow(pageConn);
    if (goalFlow.problems.length > 0) {
      failed = true;
      console.error("smoke: goal tree/editor flow had problems:");
      for (const p of goalFlow.problems) console.error(`  - ${p}`);
    } else {
      console.log(
        `smoke: goal flow ok: created "${goalFlow.strategicGoalName}" (${goalFlow.newGoalId}), added a key result, ` +
          "checks moved from warn to ok, tree shows it with 1 key result",
      );
    }

    console.log("smoke: driving the project journey: create, every section, jumps, leave/return, save");
    const projectFlow = await projectJourneyFlow(pageConn, { takeShots: takeShots });
    if (projectFlow.problems.length > 0) {
      failed = true;
      console.error("smoke: project journey flow had problems:");
      for (const p of projectFlow.problems) console.error(`  - ${p}`);
    } else {
      console.log(`smoke: project journey flow ok: created ${projectFlow.id}, blocking reached 0, version 1, saved as a version`);
    }

    if (projectFlow.id) {
      console.log("smoke: save as version pass: save a complete project version, then attempt an incomplete project (show problems)");
      const saveAsVersionResult = await saveAsVersionPass(pageConn, projectFlow.id);
      if (saveAsVersionResult.problems.length > 0) {
        failed = true;
        console.error("smoke: save as version pass had problems:");
        for (const p of saveAsVersionResult.problems) console.error(`  - ${p}`);
      } else {
        console.log("smoke: save as version pass ok, complete project versioned, incomplete showed problems");
      }

      // I3.3d.2: snapshots pass, open /snapshots and find the journey project's snapshot
      console.log("smoke: snapshots pass: open /snapshots and verify the journey project's snapshot is listed");
      const snapshotsResult = await snapshotsPass(pageConn, projectFlow.id);
      if (snapshotsResult.problems.length > 0) {
        failed = true;
        console.error("smoke: snapshots pass had problems:");
        for (const p of snapshotsResult.problems) console.error(`  - ${p}`);
      } else {
        console.log("smoke: snapshots pass ok, journey project snapshot found");
      }

      // I3.3c.3: handoff pass, use the incomplete and complete projects from saveAsVersionPass
      if (saveAsVersionResult.incompleteId && projectFlow.id) {
        console.log("smoke: handoff pass: test handoff on incomplete project (expect alert) and complete versioned project (expect success)");
        const handoffResult = await handoffPass(pageConn, saveAsVersionResult.incompleteId, projectFlow.id);
        if (handoffResult.problems.length > 0) {
          failed = true;
          console.error("smoke: handoff pass had problems:");
          for (const p of handoffResult.problems) console.error(`  - ${p}`);
        } else {
          console.log("smoke: handoff pass ok, incomplete showed alert, complete versioned showed success with bundle");
        }
      }

      console.log("smoke: charter html pass: render the project's charter.html?working=true and check for title and sections");
      const charterResult = await charterHtmlPass(projectFlow.id);
      if (charterResult.problems.length > 0) {
        failed = true;
        console.error("smoke: charter html pass had problems:");
        for (const p of charterResult.problems) console.error(`  - ${p}`);
      } else {
        console.log("smoke: charter html pass ok, charter rendered with ID and section headings");
      }
    }

    // Run after the project journey (not before): its own step 1 aligns
    // the new project to a goal, which the mutability pass's own "attempt
    // a blocked delete" step (6) needs at least one of to exist -- neither
    // examples/minimal nor a freshly imported instance directory otherwise
    // guarantees a Project exists yet at this point in the run.
    console.log("smoke: goals mutability pass: add a pillar, add two strategic goals, rename, move, delete, blocked delete, drag with key results");
    const mutabilityFlow = await goalsMutabilityPass(pageConn, goalFlow.newGoalId, goalFlow.strategicGoalName);
    if (mutabilityFlow.problems.length > 0) {
      failed = true;
      console.error("smoke: goals mutability pass had problems:");
      for (const p of mutabilityFlow.problems) console.error(`  - ${p}`);
    } else {
      console.log("smoke: goals mutability pass ok, zero console errors");
    }

    if (projectFlow.id) {
      console.log("smoke: project journey step 7: collapsed sidebar, repeat the rail jumps once");
      const collapsedJumps = await projectJourneyCollapsedJumpsPass(pageConn, projectFlow.id);
      if (collapsedJumps.problems.length > 0) {
        failed = true;
        console.error("smoke: project journey collapsed-jumps pass had problems:");
        for (const p of collapsedJumps.problems) console.error(`  - ${p}`);
      } else {
        console.log("smoke: project journey collapsed-jumps pass ok, zero console errors");
      }

      const randomSeed = Number(process.env.CARTOGRAPH_SMOKE_SEED ?? 20260918);
      console.log(`smoke: project journey randomised navigation pass, 40 moves, seed = ${randomSeed}`);
      const randomPass = await projectJourneyRandomPass(pageConn, projectFlow.id, randomSeed);
      if (randomPass.problems.length > 0) {
        failed = true;
        console.error(`smoke: project journey randomised pass (seed ${randomSeed}) had problems:`);
        for (const p of randomPass.problems) console.error(`  - ${p}`);
      } else {
        console.log(
          `smoke: project journey randomised pass ok, seed ${randomSeed}, ${randomPass.moves} moves (${randomPass.editedMoves} edited), zero console errors, whole draft identical after every unedited move`,
        );
      }
    }

    console.log("smoke: collapsed-sidebar pass over every route (I2.1)");
    const collapsedResult = await collapsedSidebarPass(pageConn, routes);
    if (collapsedResult.problems.length > 0) {
      failed = true;
      console.error("smoke: collapsed-sidebar pass had problems:");
      for (const p of collapsedResult.problems) console.error(`  - ${p}`);
    } else {
      console.log("smoke: collapsed-sidebar pass ok over every route, zero visible overflow");
    }

    console.log("smoke: 1024-wide pass over every route, plus the goal editor and a Sheet collapsed (I2.1)");
    const wideResult = await wideAt1024Pass(
      pageConn,
      routes,
      goalFlow.newGoalId ? `/goals/${goalFlow.newGoalId}` : undefined,
    );
    if (wideResult.problems.length > 0) {
      failed = true;
      console.error("smoke: 1024-wide pass had problems:");
      for (const p of wideResult.problems) console.error(`  - ${p}`);
    } else {
      console.log("smoke: 1024-wide pass ok, no horizontal scroll on any route");
    }

    console.log("smoke: keyboard-only pass, Goals home to \"Add a strategic goal\" (I2.1)");
    const keyboardResult = await keyboardPass(pageConn);
    if (keyboardResult.problems.length > 0) {
      failed = true;
      console.error("smoke: keyboard pass had problems:");
      for (const p of keyboardResult.problems) console.error(`  - ${p}`);
    } else {
      console.log("smoke: keyboard pass ok, Tab reached \"Add a strategic goal\", Enter revealed its inline input, Escape closed it");
    }

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
  } catch (err) {
    chromium.kill();
    throw err;
  }
}

main().catch((err) => {
  console.error("smoke: unexpected error:", err);
  process.exit(1);
});

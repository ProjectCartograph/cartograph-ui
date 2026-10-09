// The people's trace records the interface's acts by their shape, and
// only where the deployment keeps one (engine docs/adr/0034).

import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeClient } from "@/client/fake";
import { NotFound, type EventBatch } from "@/client/port";
import { act, guideOpened, inFlow, resetTrace, startTrace, tracePicker } from "@/trace";
import { PeopleTrace, shaped } from "@/trace/trace";

function tracing(traceOn: boolean) {
  const batches: EventBatch[] = [];
  const client = fakeClient({
    session: async () => ({ actor: "ada", canWrite: true, traceOn }),
    recordEvents: async (b) => {
      batches.push(b);
    },
  });
  return { client, batches };
}

const sent = (batches: EventBatch[]) => batches.flatMap((b) => b.events);

afterEach(() => {
  resetTrace();
  document.body.innerHTML = "";
});

describe("PeopleTrace", () => {
  it("builds and sends nothing while the deployment keeps no trace", async () => {
    const { client, batches } = tracing(false);
    const recordEvents = vi.spyOn(client, "recordEvents");
    const t = new PeopleTrace(client, { session: "w1" });
    expect(await t.start()).toBe(false);
    t.act({ name: "press", target: "action" });
    await t.flush();
    expect(recordEvents).not.toHaveBeenCalled();
    expect(batches).toEqual([]);
  });

  it("sends its acts in one batch, stamped with the window and the screen", async () => {
    const { client, batches } = tracing(true);
    const t = new PeopleTrace(client, { session: "w1", surface: () => "goals/$id", now: () => new Date("2026-10-09T13:00:00Z") });
    await t.start();
    t.act({ name: "step.enter", kind: "Goal", record: "g1", step: "aim" });
    t.act({ name: "press", target: "none", millis: 12.4 });
    await t.flush();
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({ session: "w1", interface: "web" });
    expect(batches[0].events[1]).toEqual({ name: "press", target: "none", millis: 12, surface: "goals/$id", at: "2026-10-09T13:00:00.000Z" });
  });

  it("stops when the server says it keeps no trace", async () => {
    const { client } = tracing(true);
    const recordEvents = vi.spyOn(client, "recordEvents").mockRejectedValue(new NotFound([]));
    const t = new PeopleTrace(client, { session: "w1" });
    await t.start();
    t.act({ name: "press" });
    await t.flush();
    expect(t.enabled).toBe(false);
    t.act({ name: "press" });
    await t.flush();
    expect(recordEvents).toHaveBeenCalledTimes(1);
  });
});

describe("shaped", () => {
  it("leaves out whatever could carry what a person wrote", () => {
    const out = shaped({
      name: "field.set",
      step: "Feed the town",
      field: "/spec/objective=Feed the town",
      surface: "goals/feed the town",
      record: "g-7f3a",
    });
    expect(out).toEqual({ name: "field.set", record: "g-7f3a" });
    expect(shaped({ name: "field.set", field: "/spec/keyResults/{kr-1}/target" }).field).toBe("/spec/keyResults/{kr-1}/target");
  });
});

describe("startTrace", () => {
  it("names the field answered and never what was typed in it", async () => {
    const { client, batches } = tracing(true);
    const stop = await startTrace(client, () => "goals/$id");
    inFlow("Goal", "g1", "aim", 0, false, undefined);
    document.body.innerHTML = `<div data-cartograph-field="/spec/objective"><input id="aim" /></div>`;
    const input = document.getElementById("aim") as HTMLInputElement;
    input.value = "Feed the town from its own farms";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    stop();
    await vi.waitFor(() => expect(sent(batches).some((e) => e.name === "field.set")).toBe(true));
    const set = sent(batches).find((e) => e.name === "field.set");
    expect(set).toMatchObject({ kind: "Goal", record: "g1", step: "aim", field: "/spec/objective" });
    expect(JSON.stringify(batches)).not.toContain("Feed the town");
  });

  it("tells a press on nothing from a press on an action, with its answer time", async () => {
    const { client, batches } = tracing(true);
    const stop = await startTrace(client, () => "projects");
    document.body.innerHTML = `<p id="prose">Words</p><button id="go">Go</button>`;
    document.getElementById("prose")!.click();
    document.getElementById("go")!.click();
    await new Promise((r) => setTimeout(r, 50));
    stop();
    await vi.waitFor(() => expect(sent(batches).filter((e) => e.name === "press")).toHaveLength(2));
    const presses = sent(batches).filter((e) => e.name === "press");
    expect(presses.map((p) => p.target)).toEqual(["none", "action"]);
    expect(presses.every((p) => typeof p.millis === "number" && p.millis >= 0)).toBe(true);
  });

  it("says whether a picker closed with a choice, and when a step is left backwards", async () => {
    const { client, batches } = tracing(true);
    const stop = await startTrace(client, () => "goals/$id");
    inFlow("Goal", "g1", "measures", 1, false, undefined);
    const onOpen = vi.fn();
    const picker = tracePicker(onOpen);
    picker(true);
    picker(false);
    picker(true);
    document.body.innerHTML = `<div role="option" id="o">A</div>`;
    document.getElementById("o")!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    picker(false);
    inFlow("Goal", "g1", "aim", 0, false, undefined);
    guideOpened("/spec/objective");
    act({ name: "screen.deadend" });
    stop();
    await vi.waitFor(() => expect(sent(batches).length).toBeGreaterThan(0));
    const names = sent(batches).map((e) => `${e.name}${e.target ? ":" + e.target : ""}`);
    expect(names).toEqual(
      expect.arrayContaining(["picker.close:none", "picker.close:chosen", "step.back", "guide.open", "screen.deadend"]),
    );
    expect(sent(batches).find((e) => e.name === "step.back")?.step).toBe("measures");
    expect(onOpen).toHaveBeenCalledTimes(4);
  });

  it("listens to nothing while the trace is off", async () => {
    const { client, batches } = tracing(false);
    const add = vi.spyOn(document, "addEventListener");
    await startTrace(client, () => "");
    expect(add).not.toHaveBeenCalled();
    act({ name: "press" });
    expect(batches).toEqual([]);
    add.mockRestore();
  });
});

/// <reference types="@testing-library/jest-dom" />
// Presence as a person sees it: the people on the screen in the header, a
// ring on the field another session is in, their caret inside text, and
// their pointer over the same thing it is over on their screen. Drawn from
// a fake presence feed, and once end to end through two sessions.

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { ClientProvider } from "@/client/context";
import type { Peer, PresenceState, SharedDraft } from "@/client/port";
import { fakeClient } from "@/client/fake";
import { sessions } from "@/client/testing";
import { TooltipProvider } from "@/components/ui/tooltip";
import { copy } from "@/copy";
import { PeopleHere } from "@/collab/PeopleHere";
import { PresenceOverlay } from "@/collab/PresenceOverlay";
import { PresenceFeed, PresenceProvider, type PresenceApi } from "@/collab/presence";
import { PresenceTracker } from "@/collab/PresenceTracker";

function peer(over: Partial<Peer> & { session: string; actor: string }): Peer {
  return { color: "#2563eb", focus: null, caret: null, pointer: null, heard: 0, ...over };
}

/** Puts an element at a fixed place on screen, as layout would. */
function placeAt(el: Element, r: { left: number; top: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON() {} }) as DOMRect;
}

const ada = peer({
  session: "s-ada-0001",
  actor: "ada",
  name: "Ada Lovelace",
  color: "#db2777",
  focus: { path: "/spec/aim" },
  pointer: { target: "/spec/aim", x: 0.5, y: 0.25 },
});

/** A page as the app lays it out: what is shared sits in main, beside
 * the rail, which is each person's own. */
function Page() {
  return (
    <>
      <nav data-cartograph-region="rail" />
      <main data-cartograph-region="main">
        <textarea aria-label="Aim" data-cartograph-field="/spec/aim" defaultValue="Reports arrive on time" />
        <div data-cartograph-region="goal-tree" />
        <div data-cartograph-region="far-away" />
      </main>
    </>
  );
}

function drawn(value: Partial<PresenceApi>) {
  const api: PresenceApi = { peers: [], publish: () => {}, ...value };
  const view = render(
    <TooltipProvider>
      <PresenceFeed value={api}>
        <header>
          <PeopleHere />
        </header>
        <Page />
        <PresenceOverlay />
      </PresenceFeed>
    </TooltipProvider>,
  );
  placeAt(document.querySelector('[data-cartograph-field="/spec/aim"]')!, { left: 100, top: 200, width: 400, height: 40 });
  placeAt(document.querySelector('[data-cartograph-region="goal-tree"]')!, { left: 0, top: 300, width: 200, height: 100 });
  placeAt(document.querySelector('[data-cartograph-region="far-away"]')!, { left: 0, top: 5000, width: 200, height: 100 });
  // Laid out after the first draw, as a browser would; draw again.
  view.rerender(
    <TooltipProvider>
      <PresenceFeed value={{ ...api }}>
        <header>
          <PeopleHere />
        </header>
        <Page />
        <PresenceOverlay />
      </PresenceFeed>
    </TooltipProvider>,
  );
  return view;
}

const overlay = () => document.querySelector('[data-slot="presence-overlay"]') as HTMLElement | null;

describe("the people on this screen", () => {
  it("shows each person once, as initials named on focus", () => {
    drawn({
      peers: [ada, { ...ada, session: "s-ada-0002" }, peer({ session: "s-bo-00001", actor: "bo@example.org" })],
    });
    const list = screen.getByRole("list", { name: copy.collab.peopleHere });
    const people = within(list).getAllByRole("img");
    expect(people.map((p) => p.getAttribute("aria-label"))).toEqual(["Ada Lovelace", "bo@example.org"]);
    expect(people[0]).toHaveTextContent("AL");
    expect(people[0]).toHaveAttribute("tabindex", "0");
  });

  it("shows nothing when nobody else is here", () => {
    drawn({ peers: [] });
    expect(screen.queryByRole("list", { name: copy.collab.peopleHere })).toBeNull();
    expect(overlay()).toBeNull();
  });
});

describe("another session's ring and pointer", () => {
  it("rings the field they are in, in their colour, with their name", () => {
    drawn({ peers: [ada] });
    const ring = document.querySelector('[data-slot="presence-ring"]') as HTMLElement;
    expect(ring).toHaveAttribute("data-field", "/spec/aim");
    expect(ring.style.left).toBe("98px");
    expect(ring.style.top).toBe("198px");
    expect(ring.style.width).toBe("404px");
    expect(ring.style.boxShadow).toContain("#db2777");
    expect(ring).toHaveTextContent("Ada Lovelace");
  });

  it("puts the pointer over the same place on the same field", () => {
    drawn({ peers: [ada] });
    const pointer = document.querySelector('[data-slot="presence-pointer"]') as HTMLElement;
    expect(pointer).toHaveAttribute("data-target", "/spec/aim");
    // Half way across a 400px field at 100, a quarter down a 40px one at 200.
    expect(pointer.style.transform).toBe("translate(300px, 210px)");
    expect(pointer).toHaveTextContent("Ada Lovelace");
  });

  it("anchors a pointer over a region that is not a field", () => {
    drawn({ peers: [{ ...ada, focus: null, pointer: { target: "goal-tree", x: 0.25, y: 1 } }] });
    const pointer = document.querySelector('[data-slot="presence-pointer"]') as HTMLElement;
    expect(pointer.style.transform).toBe("translate(50px, 400px)");
  });

  it("hides a pointer whose target is not on screen, or not on this page", () => {
    drawn({
      peers: [
        { ...ada, focus: null, pointer: { target: "far-away", x: 0.5, y: 0.5 } },
        peer({ session: "s-bo-00001", actor: "bo", pointer: { target: "/spec/missing", x: 0, y: 0 } }),
      ],
    });
    expect(document.querySelector('[data-slot="presence-pointer"]')).toBeNull();
  });

  it("never stands in the way of input", () => {
    drawn({ peers: [ada] });
    expect(overlay()!.style.pointerEvents).toBe("none");
    expect(overlay()).toHaveAttribute("aria-hidden", "true");
  });

  it("draws a caret inside the text where their cursor resolves", () => {
    const draft = {
      cursorPosition: (_path: string, cursor: string) => (cursor === "c-anchor" ? 8 : 14),
    } as unknown as SharedDraft;
    drawn({ peers: [{ ...ada, caret: { path: "/spec/aim", anchor: "c-anchor", head: "c-head" } }], draft });
    const caret = document.querySelector('[data-slot="presence-caret"]') as HTMLElement;
    expect(caret).toHaveAttribute("data-session", ada.session);
    expect(caret.style.left).toBe("100px");
    expect(caret.style.top).toBe("200px");
    // A selection, so a highlight under the caret line.
    expect(caret.querySelectorAll("span").length).toBeGreaterThan(1);
  });
});

describe("what this session publishes", () => {
  it("says which field it is in and where its caret is, as cursors", () => {
    const published: PresenceState[] = [];
    const draft = { cursor: (_p: string, i: number) => `cursor-${i}` } as unknown as SharedDraft;
    render(
      <PresenceFeed value={{ peers: [], draft, publish: (s) => published.push(s) }}>
        <PresenceTracker />
        <Page />
      </PresenceFeed>,
    );
    const aim = screen.getByRole("textbox", { name: "Aim" }) as HTMLTextAreaElement;
    act(() => {
      aim.focus();
      aim.setSelectionRange(3, 7);
    });
    fireEvent.keyUp(aim);
    expect(published).toContainEqual({ focus: { path: "/spec/aim" }, caret: expect.anything() });
    expect(published.at(-1)).toEqual({ caret: { path: "/spec/aim", anchor: "cursor-3", head: "cursor-7" } });
    act(() => aim.blur());
    expect(published.at(-1)).toEqual({ focus: null, caret: null });
  });

  it("gives the pointer relative to what it is over", () => {
    const published: PresenceState[] = [];
    render(
      <PresenceFeed value={{ peers: [], publish: (s) => published.push(s) }}>
        <PresenceTracker />
        <Page />
      </PresenceFeed>,
    );
    const tree = document.querySelector('[data-cartograph-region="goal-tree"]')!;
    placeAt(tree, { left: 0, top: 300, width: 200, height: 100 });
    fireEvent.pointerMove(tree, { clientX: 50, clientY: 375 });
    expect(published.at(-1)).toEqual({ pointer: { target: "goal-tree", x: 0.25, y: 0.75 } });
  });

  it("never shares a pointer on the rail, which is each person's own", () => {
    const published: PresenceState[] = [];
    render(
      <PresenceFeed value={{ peers: [], publish: (s) => published.push(s) }}>
        <PresenceTracker />
        <Page />
      </PresenceFeed>,
    );
    fireEvent.pointerMove(document.querySelector('[data-cartograph-region="rail"]')!, { clientX: 5, clientY: 5 });
    expect(published.at(-1)).toEqual({ pointer: null });
  });
});

describe("only what is in front of this person", () => {
  it("draws a pointer from the same view, and none from another section or the rail", () => {
    const sameSection = { ...ada, route: "/goals/g1" };
    const otherSection = peer({ session: "s-bo-00001", actor: "bo", route: "/goals/g1/measures", pointer: { target: "/spec/aim", x: 0, y: 0 } });
    const onRail = peer({ session: "s-cy-00001", actor: "cy", route: "/goals/g1", pointer: { target: "rail", x: 0, y: 0 } });
    drawn({ peers: [sameSection, otherSection, onRail], here: [sameSection, onRail] });
    const pointers = [...document.querySelectorAll('[data-slot="presence-pointer"]')].map((p) => p.getAttribute("data-session"));
    expect(pointers).toEqual([ada.session]);
  });

  it("streams no pointer when nobody else is on this view", async () => {
    const sent: PresenceState[] = [];
    const channel = {
      publish: (s: PresenceState) => sent.push(s),
      subscribe: (l: (peers: Peer[]) => void) => {
        l([peer({ session: "s-bo-00001", actor: "bo", route: "/goals/g1/measures" })]);
        return () => {};
      },
      close: () => {},
    };
    const client = fakeClient({ joinPresence: async () => channel, getWorking: async () => undefined } as never);
    render(
      <ClientProvider client={client}>
        <PresenceProvider screen={null} route="/goals">
          <PresenceTracker />
          <Page />
        </PresenceProvider>
      </ClientProvider>,
    );
    await waitFor(() => expect(sent).toContainEqual({ route: "/goals" }));
    const tree = document.querySelector('[data-cartograph-region="goal-tree"]')!;
    placeAt(tree, { left: 0, top: 300, width: 200, height: 100 });
    fireEvent.pointerMove(tree, { clientX: 50, clientY: 375 });
    expect(sent.some((s) => s.pointer)).toBe(false);
  });
});

describe("presence between two sessions", () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  it("rings, on one screen, the field the other session has focused", async () => {
    const live = sessions(2, {
      "Goal/g1": { manifest: { kind: "Goal", metadata: { id: "g1" }, spec: { aim: "Reports" } }, text: ["/spec/aim"] },
    });
    close = live.close;
    const screenOf = (i: number, who: string) => (
      <ClientProvider client={live.clients[i]}>
        <PresenceProvider screen={{ kind: "Goal", id: "g1" }} route="/goals/g1">
          {i === 0 ? <PresenceTracker /> : <PresenceOverlay />}
          <input aria-label={who} data-cartograph-field={`/spec/${who}`} />
        </PresenceProvider>
      </ClientProvider>
    );
    render(
      <>
        {screenOf(0, "objective")}
        {screenOf(1, "other")}
      </>,
    );
    // Both joined before the first one moves.
    await new Promise((r) => setTimeout(r, 100));
    act(() => screen.getByRole("textbox", { name: "objective" }).focus());
    await waitFor(
      () => expect(document.querySelector('[data-slot="presence-ring"]')).toHaveAttribute("data-field", "/spec/objective"),
      { timeout: 3000 },
    );
    expect(document.querySelector('[data-slot="presence-ring"]')).toHaveTextContent("Person 1");
    vi.useRealTimers();
  });
});

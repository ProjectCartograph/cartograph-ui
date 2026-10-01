import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { client } from "@/api/client";
import { moveGoal } from "../mutations";
import { GoalsHome } from "../GoalsHome";

// The page is rendered for real over a faked API client; the router's Link
// becomes a plain anchor and the mutations are observed, nothing else.
vi.mock("@/api/client");
vi.mock("../mutations");
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, draggable, className }: { children: ReactNode; draggable?: boolean; className?: string }) => (
    <a href="#" draggable={draggable} className={className}>
      {children}
    </a>
  ),
}));

const aligned = { projects: 0, programmes: 0, operations: 0, kpis: 0 };
const tree = {
  levels: ["Pillar", "Strategic", "Functional"],
  nodes: [
    {
      id: "pillar-1", name: "Pillar One", level: "goal", keyResults: 0, aligned,
      children: [
        {
          id: "strategic-1", name: "Strategic One", level: "objective", parent: "pillar-1", keyResults: 0, aligned,
          children: [
            { id: "functional-1", name: "Functional One", level: "outcome", parent: "strategic-1", keyResults: 0, aligned, children: [] },
          ],
        },
      ],
    },
    {
      id: "pillar-2", name: "Pillar Two", level: "goal", keyResults: 0, aligned,
      children: [
        { id: "strategic-2", name: "Strategic Two", level: "objective", parent: "pillar-2", keyResults: 0, aligned, children: [] },
        // Only a hand-edited file produces this: a functional goal directly under a pillar.
        { id: "functional-stray", name: "Functional Stray", level: "outcome", parent: "pillar-2", keyResults: 0, aligned, children: [] },
      ],
    },
  ],
};

const GOAL_TYPE = "text/cartograph-goal-id";

function fakeTransfer(payload: Record<string, string>) {
  const store = { ...payload };
  return {
    effectAllowed: "uninitialized",
    dropEffect: "none",
    get types() { return Object.keys(store); },
    setData: vi.fn((type: string, value: string) => { store[type] = value; }),
    getData: (type: string) => store[type] ?? "",
  };
}

async function mountHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GoalsHome />
    </QueryClientProvider>,
  );
  await screen.findByText("Pillar Two");
}

function columnOf(pillarName: string): HTMLElement {
  const title = screen.getByRole("button", { name: pillarName });
  const column = title.closest('[data-slot="pillar-column"]');
  if (!(column instanceof HTMLElement)) throw new Error(`no column for ${pillarName}`);
  return column;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client).GET.mockImplementation(async (path: string) => {
    if (path === "/goals/tree") return { data: tree, error: undefined, response: new Response() } as never;
    if (path.endsWith("/references")) return { data: { incoming: [], outgoing: [] }, error: undefined, response: new Response() } as never;
    return { data: [], error: undefined, response: new Response() } as never;
  });
  vi.mocked(moveGoal).mockResolvedValue({ ok: true, problems: [] });
});

describe("Goals home drag and drop", () => {
  it("a pillar column claims the drop on dragenter as well as dragover, only for a strategic goal payload", async () => {
    await mountHome();
    const column = columnOf("Pillar Two");

    const enter = fireEvent.dragEnter(column, { dataTransfer: fakeTransfer({ [GOAL_TYPE]: "strategic-1", "text/cartograph-goal-level-objective": "objective" }) });
    const over = fireEvent.dragOver(column, { dataTransfer: fakeTransfer({ [GOAL_TYPE]: "strategic-1", "text/cartograph-goal-level-objective": "objective" }) });
    // fireEvent returns false when a handler called preventDefault.
    expect(enter).toBe(false);
    expect(over).toBe(false);

    const textEnter = fireEvent.dragEnter(column, { dataTransfer: fakeTransfer({ "text/plain": "hello" }) });
    const textOver = fireEvent.dragOver(column, { dataTransfer: fakeTransfer({ "text/plain": "hello" }) });
    expect(textEnter).toBe(true);
    expect(textOver).toBe(true);
  });

  it("dragging a functional card carries its own id, not its strategic parent's", async () => {
    await mountHome();
    const card = screen.getByRole("button", { name: "Functional One" }).closest("[draggable]");
    if (!(card instanceof HTMLElement)) throw new Error("no functional card");
    const transfer = fakeTransfer({});

    fireEvent.dragStart(card, { dataTransfer: transfer });

    expect(transfer.setData).toHaveBeenCalledTimes(2);
    expect(transfer.setData).toHaveBeenCalledWith(GOAL_TYPE, "functional-1");
    expect(transfer.setData).toHaveBeenCalledWith("text/cartograph-goal-level-outcome", "outcome");
    expect(transfer.effectAllowed).toBe("move");
  });

  it("the card, not the link inside it, is the drag source", async () => {
    await mountHome();
    const title = screen.getByRole("button", { name: "Strategic One" });
    const link = title.closest("a");
    expect(link?.getAttribute("draggable")).toBe("false");
    expect(link?.parentElement?.closest("[draggable]")?.getAttribute("draggable")).toBe("true");
  });

  it("dropping a strategic goal on another pillar moves it there", async () => {
    await mountHome();
    const column = columnOf("Pillar Two");

    fireEvent.drop(column, { dataTransfer: fakeTransfer({ [GOAL_TYPE]: "strategic-1", "text/cartograph-goal-level-objective": "objective" }) });

    await vi.waitFor(() => expect(moveGoal).toHaveBeenCalledWith("strategic-1", "pillar-2"));
  });

  it("a pillar column claims a functional goal drag too, but highlights only a strategic one", async () => {
    await mountHome();
    const column = columnOf("Pillar Two");

    const functional = { [GOAL_TYPE]: "functional-1", "text/cartograph-goal-level-outcome": "outcome" };
    expect(fireEvent.dragEnter(column, { dataTransfer: fakeTransfer(functional) })).toBe(false);
    expect(fireEvent.dragOver(column, { dataTransfer: fakeTransfer(functional) })).toBe(false);
    expect(column.className).not.toContain("bg-accent");

    const strategic = { [GOAL_TYPE]: "strategic-1", "text/cartograph-goal-level-objective": "objective" };
    expect(fireEvent.dragEnter(column, { dataTransfer: fakeTransfer(strategic) })).toBe(false);
    expect(fireEvent.dragOver(column, { dataTransfer: fakeTransfer(strategic) })).toBe(false);
    expect(column.className).toContain("bg-accent");
  });

  it("dropping a functional goal on a pillar column sends no request and shows the rule's message", async () => {
    await mountHome();
    const column = columnOf("Pillar Two");

    fireEvent.drop(column, { dataTransfer: fakeTransfer({ [GOAL_TYPE]: "functional-1", "text/cartograph-goal-level-outcome": "outcome" }) });

    await vi.waitFor(() => {
      expect(screen.getByText(/parent goal "Pillar Two" is level "goal", not "objective"/)).toBeInTheDocument();
    });
    expect(moveGoal).not.toHaveBeenCalled();
  });

  it("dropping a functional goal on a strategic zone moves it under that strategic goal, once", async () => {
    await mountHome();
    const zones = document.querySelectorAll('[data-slot="strategic-drop"]');
    const zone = zones[1];
    if (!(zone instanceof HTMLElement)) throw new Error("no strategic drop zone for Strategic Two");

    fireEvent.drop(zone, { dataTransfer: fakeTransfer({ [GOAL_TYPE]: "functional-1", "text/cartograph-goal-level-outcome": "outcome" }) });

    await vi.waitFor(() => expect(moveGoal).toHaveBeenCalledWith("functional-1", "strategic-2"));
    expect(moveGoal).toHaveBeenCalledTimes(1);
  });

  it("a strategic goal dropped on another pillar's strategic zone moves to that pillar", async () => {
    await mountHome();
    const zones = document.querySelectorAll('[data-slot="strategic-drop"]');
    const zone = zones[1];
    if (!(zone instanceof HTMLElement)) throw new Error("no strategic drop zone for Strategic Two");

    fireEvent.drop(zone, { dataTransfer: fakeTransfer({ [GOAL_TYPE]: "strategic-1", "text/cartograph-goal-level-objective": "objective" }) });

    await vi.waitFor(() => expect(moveGoal).toHaveBeenCalledWith("strategic-1", "pillar-2"));
    expect(moveGoal).toHaveBeenCalledTimes(1);
  });

  it("dropping a goal on the pillar it already belongs to sends nothing", async () => {
    await mountHome();
    const column = columnOf("Pillar One");

    fireEvent.drop(column, { dataTransfer: fakeTransfer({ [GOAL_TYPE]: "strategic-1", "text/cartograph-goal-level-objective": "objective" }) });

    await new Promise((r) => setTimeout(r, 20));
    expect(moveGoal).not.toHaveBeenCalled();
  });

  // The level is a mark on the cards now, not a word (Programme Lead,
  // 2026-09-28): the word repeated on every row, said what the nesting
  // already says, and was taking the width the goal's own name needed. So
  // the level is still named on every card, it is just not printed — the
  // assertion moves from the text to the accessible name, which is the
  // property that actually has to hold.
  it("every card names its level, as a mark", async () => {
    await mountHome();
    const marks = Array.from(document.querySelectorAll('[data-slot="level-mark"]'));
    const named = marks.map((el) => el.getAttribute("aria-label"));
    expect(named.filter((name) => name === "Pillar")).toHaveLength(2);
    expect(named.filter((name) => name === "Strategic")).toHaveLength(2);
    expect(named.filter((name) => name === "Functional")).toHaveLength(2);
    // No level carries a colour of its own any more (Programme Lead,
    // 2026-09-26: the Goals cards keep the app's own neutral surface). The
    // mark is what tells the tiers apart, so every one of them has to be
    // drawn and every one has to be readable without it.
    for (const el of marks) {
      for (const tone of ["violet", "sky", "emerald"]) {
        expect(el.className).not.toContain(tone);
        expect(el.closest('[data-slot="card"]')?.className ?? "").not.toContain(tone);
      }
      expect(el.querySelector("svg")).toBeInTheDocument();
      expect(el.getAttribute("title")).toBe(el.getAttribute("aria-label"));
    }
  });

  // The name is the whole reason the word went: at plan scale it was
  // getting about twenty characters.
  it("gives the goal name the width the level word used to take", async () => {
    await mountHome();
    expect(document.querySelectorAll('[data-slot="level-tag"]')).toHaveLength(0);
  });

  it("a functional goal listed directly under a pillar renders with the functional card and a wrong-level badge", async () => {
    await mountHome();
    const badge = screen.getByText("Wrong level: outcome under goal");
    const wrapper = badge.parentElement;
    if (!(wrapper instanceof HTMLElement)) throw new Error("no wrapper for the stray goal");
    expect(wrapper.textContent).toContain("Functional Stray");
    // A strategic card would offer to add a functional goal beneath it; the functional card does not.
    expect(wrapper.querySelector("button")?.textContent ?? "").not.toContain("Add a functional goal");
    expect(wrapper.textContent).not.toContain("Add a functional goal");
  });
});

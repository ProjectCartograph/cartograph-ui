import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Order } from "@/client/port";
import { copy } from "@/copy";
import { NewWork } from "../NewWork";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => () => {},
}));

const keys = ["purpose", "goal", "objective", "outcome", "kpi", "gap", "assumption", "portfolio", "programme", "operation", "project", "stakeholders"];
const after: Record<string, string[]> = {
  goal: ["purpose"], objective: ["goal"], outcome: ["objective"], kpi: ["outcome"], gap: ["outcome", "kpi"],
  assumption: ["kpi"], portfolio: ["objective"], programme: ["gap"], project: ["outcome"], stakeholders: ["project"],
};

/** An order with the first n stages written. */
function orderWith(n: number): Order {
  const done = new Set(keys.slice(0, n));
  let next: string | undefined;
  const stages = keys.map((key) => {
    const waiting = (after[key] ?? []).filter((a) => !done.has(a));
    const optional = ["assumption", "portfolio", "programme", "operation", "stakeholders"].includes(key);
    let state: Order["stages"][number]["state"] = done.has(key) ? "done" : waiting.length ? "waiting" : "ready";
    if (state === "ready" && !next && !optional) {
      state = "next";
      next = key;
    }
    return { key, kind: key, count: done.has(key) ? 1 : 0, state, optional, ...(waiting.length ? { waiting } : {}) };
  });
  return { stages, registers: [], ...(next ? { next } : {}) };
}

function renderNew(order: Order) {
  const client = fakeClient({
    order: async () => order,
    glossary: async () => [{ key: "purpose", kind: "Purpose", summary: "Why your organisation exists.", example: "A fair living." }],
    structureQuestions: async () => [
      { field: "ongoing", question: "Does it keep running with no end date?", then: "An Operation." },
      { field: "outputOf", question: "Is it an output another piece of work hands over?", then: "A deliverable of that piece of work." },
      { field: "changeOfItsOwn", question: "Does it bring about a change of its own that other work depends on?", then: "A Project of its own, listed as a component." },
      { field: "", question: "None of these:", then: "A Project." },
    ],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <ClientProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <NewWork />
      </QueryClientProvider>
    </ClientProvider>,
  );
  return container;
}

describe("New, in the order of work", () => {
  it("starts an empty workspace at its purpose, and lets a project start anyway", async () => {
    const container = renderNew(orderWith(0));
    const purpose = await screen.findByText("Purpose");
    const row = purpose.closest("li")!;
    expect(row.getAttribute("data-state")).toBe("next");
    // What it is, as the glossary defines it, and the "?" beside the word.
    expect(await within(row).findByText("Why your organisation exists.")).toBeTruthy();
    expect(within(row).getByRole("button", { name: copy.glossary.whatIs("Purpose") })).toBeTruthy();
    expect(row.getAttribute("aria-current")).toBe("step");
    expect(within(row).getAllByRole("link")[0].getAttribute("href")).toBe("/strategy");
    // Everything below it waits, and says on what.
    const goals = container.querySelector('[data-cartograph-stage="goal"]')!;
    expect(goals.getAttribute("data-state")).toBe("waiting");
    expect(within(goals as HTMLElement).queryByRole("link")).toBeNull();
    // The work can be started whatever the strategy holds: what it is
    // is asked right away.
    const work = container.querySelector('[data-cartograph-region="new-work"]') as HTMLElement;
    fireEvent.click(await within(work).findByRole("button", { name: /keep running with no end date/ }));
    expect(within(work).getByRole("button", { name: new RegExp(copy.whichKind.start(copy.createMenu.kinds.Operation)) })).toBeTruthy();
  });

  it("lists the strategy top-down, each stage after what it names", async () => {
    const container = renderNew(orderWith(3));
    await screen.findByText("Purpose");
    const order = [...container.querySelectorAll("[data-cartograph-stage]")].map((el) => el.getAttribute("data-cartograph-stage"));
    expect(order).toEqual(["purpose", "goal", "objective", "outcome", "kpi", "gap", "assumption"]);
    expect(container.querySelector('[data-cartograph-stage="outcome"]')!.getAttribute("data-state")).toBe("next");
  });

  // What the work is, by the engine's questions (TAXONOMY.md D56): one
  // ordered choice, the first that fits, never what a document calls it.
  it("asks what the work is by the engine's questions, and says what follows", async () => {
    const container = renderNew(orderWith(5));
    const work = container.querySelector('[data-cartograph-region="new-work"]') as HTMLElement;
    fireEvent.click(await within(work).findByRole("button", { name: /Does it bring about a change of its own/ }));
    expect(within(work).getByText("A Project of its own, listed as a component.")).toBeTruthy();
    expect(within(work).getByRole("button", { name: new RegExp(copy.whichKind.start("Project")) })).toBeTruthy();
    fireEvent.click(within(work).getByRole("button", { name: copy.whichKind.back }));
    fireEvent.click(within(work).getByRole("button", { name: /an output another piece of work hands over/ }));
    expect(within(work).getByRole("button", { name: copy.whichKind.openProjects })).toBeTruthy();
  });
});

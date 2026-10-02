import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Order } from "@/client/port";
import { NewWork } from "../NewWork";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => () => {},
}));

const keys = ["purpose", "goal", "objective", "outcome", "kpi", "gap", "assumption", "programme", "operation", "project", "stakeholders"];
const after: Record<string, string[]> = {
  goal: ["purpose"], objective: ["goal"], outcome: ["objective"], kpi: ["outcome"], gap: ["outcome", "kpi"],
  assumption: ["kpi"], programme: ["gap"], operation: ["outcome"], project: ["outcome"], stakeholders: ["project"],
};

/** An order with the first n stages written. */
function orderWith(n: number): Order {
  const done = new Set(keys.slice(0, n));
  let next: string | undefined;
  const stages = keys.map((key) => {
    const waiting = (after[key] ?? []).filter((a) => !done.has(a));
    const optional = ["assumption", "programme", "operation", "stakeholders"].includes(key);
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
  const client = fakeClient({ order: async () => order });
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
  it("starts an empty workspace at its purpose, and holds the work back", async () => {
    const container = renderNew(orderWith(0));
    const purpose = await screen.findByText("Purpose");
    const row = purpose.closest("li")!;
    expect(row.getAttribute("data-state")).toBe("next");
    expect(row.getAttribute("aria-current")).toBe("step");
    expect(within(row).getByRole("link").getAttribute("href")).toBe("/");
    // Everything below it waits, and says on what.
    const goals = container.querySelector('[data-cartograph-stage="goal"]')!;
    expect(goals.getAttribute("data-state")).toBe("waiting");
    expect(within(goals as HTMLElement).queryByRole("link")).toBeNull();
    // The work waits for the strategy: its questions cannot be answered.
    const work = container.querySelector('[data-cartograph-region="new-work"]')!;
    expect(within(work as HTMLElement).getByRole("status").textContent).toContain("Purpose");
    for (const radio of within(work as HTMLElement).getAllByRole("radio")) {
      expect((radio as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("lists the strategy top-down, each stage after what it names", async () => {
    const container = renderNew(orderWith(3));
    await screen.findByText("Purpose");
    const order = [...container.querySelectorAll("[data-cartograph-stage]")].map((el) => el.getAttribute("data-cartograph-stage"));
    expect(order).toEqual(["purpose", "goal", "objective", "outcome", "kpi", "gap", "assumption"]);
    expect(container.querySelector('[data-cartograph-stage="outcome"]')!.getAttribute("data-state")).toBe("next");
  });

  it("opens the work once there is an outcome to serve, and holds a programme to its gap", async () => {
    const container = renderNew(orderWith(5));
    await screen.findByText("Purpose");
    const work = container.querySelector('[data-cartograph-region="new-work"]') as HTMLElement;
    fireEvent.click(within(work).getAllByRole("radio")[0]);
    fireEvent.click(within(work).getAllByRole("radio")[4]);
    const verdict = container.querySelector('[data-cartograph-region="new-verdict"]') as HTMLElement;
    // A programme answers a gap, and none is written yet: it leads there.
    expect(within(verdict).getByRole("link").getAttribute("href")).toBe("/gaps/new");
    // A project needs only the outcome.
    fireEvent.click(within(work).getAllByRole("radio")[2]);
    expect((within(verdict).getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });
});

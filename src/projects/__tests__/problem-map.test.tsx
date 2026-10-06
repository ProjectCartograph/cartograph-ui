/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProblemMap } from "../ProblemMap";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const mc = copy.projects.aim.map;

// A problem and the gaps it is related to are about the same people
// (engine TAXONOMY.md D45): the map marks a group no gap affects, a gap
// that affects none of the groups, and offers the groups the gaps name.
function mount(groups: string[], onAddGroup = vi.fn()) {
  const list = vi.fn(async (kind: string) =>
    kind === "Gap"
      ? [
          { id: "g-late", name: "Faults found late", spec: { affects: ["growers", "buyers"] } },
          { id: "g-none", name: "No standard", spec: {} },
        ]
      : [
          { id: "growers", name: "Growers" },
          { id: "buyers", name: "Buyers" },
          { id: "drivers", name: "Drivers" },
        ],
  );
  render(
    <ClientProvider client={fakeClient({ list: list as never })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProblemMap
          line={{ problem: { situation: "learn of faults late" }, change: { what: "check at intake" }, groups, gaps: [{ gap: "g-late" }, { gap: "g-none" }] }}
          groupNames={new Map([["growers", "Growers"], ["drivers", "Drivers"]])}
          onAddGroup={onAddGroup}
        />
      </QueryClientProvider>
    </ClientProvider>,
  );
  return onAddGroup;
}

describe("the problem map", () => {
  it("marks a group no linked gap affects, and a gap that names nobody", async () => {
    mount(["growers", "drivers"]);
    expect(await screen.findByText(mc.groupOutside("Drivers"))).toBeInTheDocument();
    expect(screen.getByText(mc.gapUnknown("No standard"))).toBeInTheDocument();
  });

  it("offers the groups the gaps affect and the problem does not name", async () => {
    const onAddGroup = mount(["growers"]);
    fireEvent.click(await screen.findByRole("button", { name: mc.addGroup("Buyers") }));
    expect(onAddGroup).toHaveBeenCalledWith("buyers");
  });
});

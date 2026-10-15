/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProblemMap } from "../ProblemMap";

const open = vi.fn();
vi.mock("@/records/RecordDrawer", () => ({ useRecordDrawer: () => ({ open }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const mc = copy.projects.aim.map;

function mount(groups: string[], onAddGroup = vi.fn(), onChange = vi.fn()) {
  const linkCandidates = vi.fn(async (link: string) =>
    link === "problem-gap"
      ? [
          { kind: "Gap", id: "g-late", name: "Faults found late", allowed: false, linked: true },
          { kind: "Gap", id: "g-cold", name: "Produce kept warm", allowed: true },
          { kind: "Gap", id: "g-far", name: "Roads close in the rains", allowed: false, reason: "This gap affects none of the groups this problem names." },
        ]
      : [],
  );
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
    <ClientProvider client={fakeClient({ list: list as never, linkCandidates: linkCandidates as never })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProblemMap
          line={{ problem: { situation: "learn of faults late" }, change: { what: "check at intake" }, groups, gaps: [{ gap: "g-late" }, { gap: "g-none" }] }}
          groupNames={new Map([["growers", "Growers"], ["drivers", "Drivers"]])}
          onAddGroup={onAddGroup}
          onChange={onChange}
          project="p1"
          problem="problem-1"
        />
      </QueryClientProvider>
    </ClientProvider>,
  );
  return { onAddGroup, onChange };
}

// A break in the problem map is about who a gap affects: its link opens
// the gap at that field, never the whole gap (#91).
describe("a gap the problem map marks", () => {
  it("opens at who it affects, whether it names nobody or other groups", async () => {
    mount(["drivers"]);
    fireEvent.click(await screen.findByRole("button", { name: mc.sayAffects }));
    expect(open).toHaveBeenLastCalledWith("Gap", "g-none", "/spec/affects");
    fireEvent.click(screen.getByRole("button", { name: mc.changeAffects }));
    expect(open).toHaveBeenLastCalledWith("Gap", "g-late", "/spec/affects");
  });
});

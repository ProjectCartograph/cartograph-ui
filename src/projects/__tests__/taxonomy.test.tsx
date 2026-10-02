/// <reference types="@testing-library/jest-dom" />
// What the interface judges agrees with TAXONOMY.md and with the engine's
// checks (engine docs/adr/0019).

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { gapOutline } from "@/definition/outline";
import { knownBaseline } from "@/kpis/types";
import { ProjectStoreProvider } from "../store";
import { ResourcesSection } from "../sections/ResourcesSection";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

describe("the taxonomy, on screen", () => {
  it("counts a gap's source as its evidence, not its statement (D9)", () => {
    const evidence = (spec: object) => gapOutline(spec as never, "A gap").find((p) => p.key === "evidence")?.filled;
    expect(evidence({ statement: "Four in five faults are found by a buyer." })).toBe(false);
    expect(evidence({ source: "Quality review of the 2025 spring season" })).toBe(true);
  });

  it("reads a KPI's baseline as a figure only when it is known (D25)", () => {
    expect(knownBaseline({ value: 18, date: "2025-09" })).toEqual({ value: 18, date: "2025-09" });
    expect(knownBaseline({ unknownReason: "Never surveyed in the north" })).toBeUndefined();
  });

  it("asks a component for its manager alone, the sponsor being its parent's (D15)", async () => {
    const component = {
      apiVersion: "cartograph/v1",
      kind: "Project",
      metadata: { id: "p2", name: "Printing the check booklets" },
      spec: { team: "t1", alignment: { partOf: "p1" } },
    };
    const client = fakeClient({
      get: async () => ({ version: { number: 0 }, manifest: component, yaml: "" }) as never,
      list: async () => [] as never,
      saveWorking: async () => undefined,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProjectStoreProvider id="p2">
            <ResourcesSection />
          </ProjectStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    const required = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-cartograph-region="required-roles"]');
      if (!el) throw new Error("not yet");
      return el;
    });
    expect(within(required).getByText(copy.projects.resources.leadLabel)).toBeInTheDocument();
    expect(within(required).queryByText(copy.projects.resources.sponsorLabel)).toBeNull();
  });
});

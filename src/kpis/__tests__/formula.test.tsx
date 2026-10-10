/// <reference types="@testing-library/jest-dom" />
import { useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { DefinitionStoreProvider, useDefinitionStore } from "@/definition/store";
import { MetricSection } from "../sections/MetricSection";
import { blankKPISpec, type KPIDefinitionSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/records/RecordDrawer", () => ({ useRecordDrawer: () => undefined }));

const mc = copy.kpis.metric;
const seen: { spec?: KPIDefinitionSpec } = {};
function Probe() {
  const spec = useDefinitionStore<KPIDefinitionSpec>().spec;
  useEffect(() => {
    seen.spec = spec;
  });
  return null;
}

// An indicator is formulated by choice, in the definer's words, with no
// SQL or dbt to write (#55; engine TAXONOMY.md D63).
describe("an indicator's formula", () => {
  it("is built from named parts and read back as a sentence", async () => {
    const user = userEvent.setup();
    const kpi = {
      metadata: { id: "graded-alike", name: "Share graded alike" },
      spec: { sources: ["audit"], metric: { type: "ratio", numerator: { source: "audit", agg: "count" }, denominator: { source: "audit", agg: "count" } } },
    };
    render(
      <ClientProvider client={fakeClient({ get: vi.fn(async () => ({ version: { number: 1 }, manifest: kpi })) as never, list: vi.fn(async () => [{ id: "audit", name: "Annual audit" }]) as never, saveWorking: vi.fn(async () => undefined) })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DefinitionStoreProvider kind="KPI" id="graded-alike" blank={blankKPISpec}>
            <Probe />
            <MetricSection />
          </DefinitionStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    const counts = await screen.findAllByRole("textbox", { name: new RegExp(mc.countsLabel) });
    await user.type(counts[0], "crates graded alike");
    await user.type(counts[1], "crates graded twice");
    await user.click(screen.getByRole("button", { name: mc.whereAddHint }));
    await user.type(screen.getByRole("textbox", { name: mc.whereInput }), "the depot's region");
    await user.type(screen.getByRole("textbox", { name: mc.whereValue }), "north");
    await waitFor(() => expect(seen.spec?.metric?.where).toEqual([{ input: "the depot's region", op: "is", value: "north" }]));
    expect(seen.spec?.metric?.numerator?.counts).toBe("crates graded alike");
    expect(screen.getByText(/The share of crates graded alike out of crates graded twice, only where the depot's region is north/)).toBeInTheDocument();
    // Nothing a person must write in SQL or dbt is in view.
    expect(screen.queryByRole("textbox", { name: mc.filterLabel })).not.toBeVisible();
  });
});

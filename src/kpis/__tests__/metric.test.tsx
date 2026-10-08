/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { DefinitionStoreProvider, useDefinitionStore } from "@/definition/store";
import { MetricSection } from "../sections/MetricSection";
import type { KPIDefinitionSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: ReactNode }) => <span>{children}</span> }));

const mc = copy.kpis.metric;
let spec: KPIDefinitionSpec;
function Spy() {
  spec = useDefinitionStore<KPIDefinitionSpec>().spec;
  return null;
}

// A KPI's number in the dbt semantic layer's terms (engine TAXONOMY.md
// D57): the kind as a tile, each measure over one of the KPI's own sources.
describe("how a KPI is computed", () => {
  it("makes a share of two counts in the KPI's own source", async () => {
    const manifest = { metadata: { id: "pass-rate", name: "Pass rate" }, spec: { definition: "Share passing.", unit: "percent", direction: "increase", sources: ["checks"] } };
    render(
      <ClientProvider client={fakeClient({ get: async () => ({ number: 1, manifest }) as never, saveWorking: async () => undefined, list: async () => [] as never })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DefinitionStoreProvider kind="KPI" id="pass-rate" blank={() => ({})}>
            <MetricSection />
            <Spy />
          </DefinitionStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(mc.types.ratio.label) }));
    expect(spec.metric).toEqual({ type: "ratio", numerator: { source: "checks", agg: "count" }, denominator: { source: "checks", agg: "count" } });
    fireEvent.change(screen.getByLabelText(`${mc.numeratorLabel}: ${mc.exprColumnLabel}`, { selector: '[data-cartograph-field="/spec/metric/numerator/expr"]' }), { target: { value: "passed" } });
    expect(spec.metric?.numerator?.expr).toBe("passed");
    fireEvent.click(screen.getByRole("button", { name: mc.clearHint }));
    expect(spec.metric).toBeUndefined();
  });
});

/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const checks = {
  metadata: { id: "checks", name: "Check tool" },
  spec: {
    metrics: [
      { id: "checked", name: "Deliveries checked", aggregation: "COUNT(*)" },
      { id: "passed", name: "Deliveries passed", aggregation: "COUNT(*) WHERE passed = true" },
    ],
  },
};

function mount(metric?: KPIDefinitionSpec["metric"]) {
  const kpi = { metadata: { id: "pass-rate", name: "Pass rate" }, spec: { definition: "Share passing.", unit: "percent", direction: "increase", sources: ["checks"], ...(metric ? { metric } : {}) } };
  render(
    <ClientProvider client={fakeClient({ get: (async (kind: string) => ({ number: 1, manifest: kind === "DataSource" ? checks : kpi })) as never, saveWorking: async () => undefined, list: async () => [] as never })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DefinitionStoreProvider kind="KPI" id="pass-rate" blank={() => ({})}>
          <MetricSection />
          <Spy />
        </DefinitionStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

// An indicator's number is one of its data source's metrics, or one out
// of another for a share (engine TAXONOMY.md D64): chosen by name, its
// aggregation shown, read back as a sentence.
describe("how an indicator is computed", () => {
  it("makes a share of two of its source's metrics", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: new RegExp(mc.types.ratio.label) }));
    expect(spec.metric).toEqual({ type: "ratio" });
    await user.click(screen.getByRole("combobox", { name: mc.ofRatioLabel }));
    await user.click(await screen.findByRole("option", { name: /Deliveries passed/ }));
    await user.click(screen.getByRole("combobox", { name: mc.outOfLabel }));
    await user.click(await screen.findByRole("option", { name: /Deliveries checked/ }));
    expect(spec.metric).toEqual({ type: "ratio", of: { dataSource: "checks", metric: "passed" }, outOf: { dataSource: "checks", metric: "checked" } });
    expect(screen.getByText("COUNT(*) WHERE passed = true")).toBeInTheDocument();
    expect(screen.getByText(/The share of deliveries passed out of deliveries checked/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: mc.clearHint }));
    expect(spec.metric).toBeUndefined();
  });

  it("replaces a number written in the warehouse's terms once a metric is chosen", async () => {
    const user = userEvent.setup();
    mount({ type: "simple", measure: { source: "checks", agg: "count" }, where: [{ input: "grade", op: "is", value: "first" }] });
    expect(await screen.findByText(mc.legacy)).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: mc.ofLabel }));
    await user.click(await screen.findByRole("option", { name: /Deliveries checked/ }));
    expect(spec.metric).toEqual({ type: "simple", of: { dataSource: "checks", metric: "checked" } });
    expect(screen.queryByText(mc.legacy)).toBeNull();
  });
});

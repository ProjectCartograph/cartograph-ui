/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { ControlChart, DMAIC } from "@/client/port";
import { copy } from "@/copy";
import { ControlChartView } from "../ControlChartView";
import { DMAICPanel } from "../DMAICPanel";

const item = (phase: string, key: string, met: boolean) => ({ phase, key, met, says: `${key} says`, field: "/spec/x", ...(met ? {} : { lacking: `${key} lacking` }) });
const dmaic: DMAIC = {
  project: "p1",
  phases: [
    { phase: "define", met: 2, of: 2, items: [item("define", "problem", true), item("define", "goal", true)] },
    { phase: "measure", met: 0, of: 1, items: [item("measure", "ctq-limits", false)] },
    { phase: "analyze", met: 1, of: 1, items: [item("analyze", "causes", true)] },
    { phase: "improve", met: 1, of: 1, items: [item("improve", "fmea", true)] },
    { phase: "control", met: 0, of: 1, items: [item("control", "response-plan", false)] },
  ],
};

function wrap(node: ReactNode, client: Parameters<typeof fakeClient>[0]) {
  return render(
    <ClientProvider client={fakeClient(client)}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>
    </ClientProvider>,
  );
}

// A project through DMAIC's tollgates (engine TAXONOMY.md D58): the
// phases as tiles, the first with something lacking open.
describe("DMAIC", () => {
  it("opens on the first phase lacking something, and moves between phases", async () => {
    const { container } = wrap(<DMAICPanel id="p1" />, { dmaic: async () => dmaic });
    expect(await screen.findByText("ctq-limits lacking")).toBeInTheDocument();
    expect(container.querySelector('[data-dmaic-tile="define"]')?.textContent).toContain(copy.dmaic.count(2, 2));
    fireEvent.click(container.querySelector('[data-dmaic-tile="control"]')!);
    expect(screen.getByText("response-plan lacking")).toBeInTheDocument();
  });

  it("charts readings with their limits and marks a signal", async () => {
    const chart: ControlChart = {
      kpi: "k1", centre: 65, lower: 58, upper: 72, sigma: 2.4, stable: false, enough: false, specLower: 60, cpk: 0.69, sigmaLevel: 2.07,
      points: [{ period: "2026-01", value: 63 }, { period: "2026-02", value: 66 }, { period: "2026-03", value: 74, signals: ["beyond"] }],
      note: "3 readings: the limits settle at twenty or more.",
    };
    const { container } = wrap(<ControlChartView kpi="k1" />, { controlChart: async () => chart });
    expect(await screen.findByText("0.69")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-signal]")).toHaveLength(1);
    expect(screen.getByText(copy.dmaic.chart.no)).toBeInTheDocument();
  });
});

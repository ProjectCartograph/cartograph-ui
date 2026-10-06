/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { PeriodsField, type NamedPeriod } from "@/surfaces/sheet/PeriodsField";
import { CycleSignature } from "../CycleSignature";
import { ReadingsTable } from "../ReadingsTable";
import { readingSlots } from "../periods";

const year = new Date().getUTCFullYear();

// A termly cycle's periods are laid out by the engine; the interface
// reads them by name (TAXONOMY.md D40).
describe("a cycle of named periods", () => {
  it("reads each reading's row by the period's name", () => {
    const slots = readingSlots(
      [{ end: "2026-12", start: "2026-08", name: "Term I", label: "Term I 2026/27", due: "2027-01-14" }],
      [{ period: "2026-12", value: 4 }],
    );
    render(<ReadingsTable slots={slots} unit="" onChange={() => {}} />);
    expect(screen.getByLabelText(`${copy.kpis.readings.value} Term I 2026/27`)).toHaveValue(4);
  });

  it("spells out its periods where a KPI picks it", async () => {
    const get = vi.fn().mockResolvedValue({
      manifest: { metadata: { name: "Termly" }, spec: { periods: [{ name: "Term I", endMonth: 12 }, { name: "Term II", endMonth: 4 }] } },
    });
    const cyclePeriods = vi.fn().mockResolvedValue([
      { end: `${year}-04`, start: `${year}-01`, name: "Term II", label: "Term II", due: `${year}-04-30` },
      { end: `${year}-12`, start: `${year}-08`, name: "Term I", label: "Term I", due: `${year}-12-31` },
    ]);
    render(
      <ClientProvider client={fakeClient({ get, cyclePeriods })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <CycleSignature id="termly" />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText(/Term I, Term II\./)).toBeInTheDocument();
    expect(await screen.findByText(/Term II \(April\)/)).toBeInTheDocument();
    expect(cyclePeriods).toHaveBeenCalledWith("termly", `${year}-01`, `${year}-12`);
  });
});

function Periods({ start }: { start: NamedPeriod[] }) {
  const [value, setValue] = useState(start);
  return (
    <>
      <PeriodsField pointer="/spec/periods" value={value} onChange={setValue} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

describe("the named periods editor", () => {
  const pc = copy.sheets.periods;

  it("adds a yearly period by its name and the month it ends", async () => {
    render(<Periods start={[]} />);
    await userEvent.click(screen.getByRole("button", { name: pc.add }));
    await userEvent.type(screen.getByLabelText(`${pc.nameLabel} 1`), "Term I");
    expect(JSON.parse(screen.getByTestId("value").textContent ?? "")).toEqual([{ name: "Term I", endMonth: 1 }]);
  });

  it("keeps a list to one form", async () => {
    render(<Periods start={[{ name: "Baseline", end: "2026-12" }]} />);
    await userEvent.click(screen.getByRole("button", { name: pc.add }));
    expect(JSON.parse(screen.getByTestId("value").textContent ?? "")).toEqual([
      { name: "Baseline", end: "2026-12" },
      { name: "", end: "" },
    ]);
  });
});

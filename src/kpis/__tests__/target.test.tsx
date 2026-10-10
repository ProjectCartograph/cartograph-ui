/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { DefinitionStoreProvider, useDefinitionStore } from "@/definition/store";
import { DefinitionSection } from "../sections/DefinitionSection";
import { targetFigure, type KPIDefinitionSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: ReactNode }) => <span>{children}</span> }));

const tt = copy.kpis.definition.target;
let spec: KPIDefinitionSpec;
function Spy() {
  spec = useDefinitionStore<KPIDefinitionSpec>().spec;
  return null;
}

function mount(target?: unknown) {
  const manifest = { metadata: { id: "graded", name: "Produce graded" }, spec: { definition: "Crates graded.", unit: "count", ...(target ? { target } : {}) } };
  render(
    <ClientProvider client={fakeClient({ get: async () => ({ number: 1, manifest }) as never, saveWorking: async () => undefined, list: async () => [] as never })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DefinitionStoreProvider kind="KPI" id="graded" blank={() => ({})}>
          <DefinitionSection />
          <Spy />
        </DefinitionStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

// A target is a value by a month, a value due in a window, or a value set
// when something happens (engine TAXONOMY.md D47).
describe("a KPI's target", () => {
  it("is set once something happens, by the month it is expected", async () => {
    mount({ value: 400, date: "2027-03" });
    fireEvent.click(await screen.findByRole("radio", { name: tt.modes.when }));
    expect(spec.target).toEqual({ setWhen: { form: "when" } });
    fireEvent.change(document.querySelector('[data-cartograph-field="/spec/target/setWhen/event/on/external"]')!, { target: { value: "The depot survey baseline is in" } });
    fireEvent.change(document.querySelector('[data-cartograph-field="/spec/target/direction"]')!, { target: { value: "Above last season" } });
    expect(spec.target).toEqual({ setWhen: { form: "when", event: { on: { external: "The depot survey baseline is in" } } }, direction: "Above last season" });
    expect(targetFigure(spec.target)).toBeUndefined();
  });

  it("is due in a window, read as due by its last month", async () => {
    mount({ value: 400, date: "2027-03" });
    fireEvent.click(await screen.findByRole("radio", { name: tt.modes.window }));
    expect(spec.target).toEqual({ value: 400, due: { form: "window" } });
    expect(targetFigure({ value: 400, due: { form: "window", notBefore: "2027-01", notAfter: "2027-06" } })).toEqual({ value: 400, date: "2027-06" });
  });
});

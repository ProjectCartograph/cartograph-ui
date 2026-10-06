/// <reference types="@testing-library/jest-dom" />
import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { DefinitionStoreProvider, useDefinitionStore } from "@/definition/store";
import { ServiceFunding } from "../ServiceFunding";
import { blankOperationSpec, type OperationSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const oc = copy.operations;

const service = {
  metadata: { id: "checks", name: "Quality Check Service" },
  spec: {
    purpose: "Check deliveries",
    status: "planned",
    funding: [{ amount: 18000, currency: "USD", per: "year", source: "operating-budget", status: "approved" }],
  },
};

const get = vi.fn();
const list = vi.fn();
const saveWorking = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ version: { number: 1 }, manifest: service });
  list.mockResolvedValue([{ id: "operating-budget", name: "Operating budget" }]);
  saveWorking.mockResolvedValue(undefined);
});

const seen: { spec?: OperationSpec } = {};
function Probe() {
  const spec = useDefinitionStore<OperationSpec>().spec;
  useEffect(() => {
    seen.spec = spec;
  });
  return null;
}

async function mount() {
  render(
    <ClientProvider client={fakeClient({ get, list, saveWorking })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DefinitionStoreProvider kind="Operation" id="checks" blank={blankOperationSpec}>
          <Probe />
          <ServiceFunding />
        </DefinitionStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
  await screen.findByLabelText(oc.fundingAmountLabel);
}

// A service's running cost recurs, so every line says the period its
// amount is for (TAXONOMY.md D39).
describe("a service's running costs", () => {
  it("shows each line with its period", async () => {
    await mount();
    expect(screen.getByLabelText(oc.fundingAmountLabel)).toHaveValue(18000);
    expect(screen.getByLabelText(oc.fundingPerLabel)).toHaveTextContent(oc.fundingPer.year);
  });

  it("adds a line paid yearly until said otherwise, and drops the list with its last line", async () => {
    await mount();
    await userEvent.click(screen.getByRole("button", { name: oc.addFunding }));
    await waitFor(() => expect(seen.spec?.funding).toHaveLength(2));
    expect(seen.spec?.funding?.[1]).toMatchObject({ per: "year", status: "requested" });
    while (screen.queryAllByRole("button", { name: copy.projects.common.remove }).length > 0) {
      await userEvent.click(screen.getAllByRole("button", { name: copy.projects.common.remove })[0]);
    }
    await waitFor(() => expect(seen.spec?.funding).toBeUndefined());
  });
});

/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { KPIAddDialog } from "../KPIAddDialog";
import { kpiSeedOf } from "../seed";

vi.mock("@/records/RecordDrawer", () => ({ useRecordDrawer: () => undefined }));

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        again
      </button>
      <KPIAddDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// Closing the dialog by Escape keeps what was typed; only Cancel clears
// it (#85).
describe("a new indicator's dialog", () => {
  it("keeps what was typed when closed, and clears it on Cancel", async () => {
    const user = userEvent.setup();
    render(
      <ClientProvider client={fakeClient()}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Harness />
        </QueryClientProvider>
      </ClientProvider>,
    );
    await user.type(screen.getByRole("textbox", { name: copy.kpis.nameLabel }), "Unsold produce rate");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "again" }));
    expect(screen.getByRole("textbox", { name: copy.kpis.nameLabel })).toHaveValue("Unsold produce rate");
    await user.click(screen.getByRole("button", { name: copy.kpis.addCancel }));
    await user.click(screen.getByRole("button", { name: "again" }));
    expect(screen.getByRole("textbox", { name: copy.kpis.nameLabel })).toHaveValue("");
  });
});

// A key result and an indicator say a baseline and a target the same
// way; a new indicator starts from the one key result (#87).
describe("what a new indicator starts from", () => {
  const kr = { baseline: { value: 33, date: "2025-09" }, target: { value: 10, date: "2027-06" }, source: "sales-ledger" };
  it("is the key result, where there is one", () => {
    expect(kpiSeedOf([{ keyResults: [kr] }])).toEqual(kr);
  });
  it("is nothing, where there are several", () => {
    expect(kpiSeedOf([{ keyResults: [kr] }, { keyResults: [kr] }])).toBeUndefined();
  });
});

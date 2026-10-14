/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { GapAddDialog } from "../GapAddDialog";

vi.mock("@/records/RecordDrawer", () => ({ useRecordDrawer: () => undefined }));

const gd = copy.gapAdd;

// A gap is recorded in one screen, its shortfall from now to where it
// should be, under an id of its own (#31).
describe("recording a gap", () => {
  it("records the shortfall under a generated id", async () => {
    const user = userEvent.setup();
    const saveVersion = vi.fn(async () => ({ number: 1 }));
    const onAdded = vi.fn();
    render(
      <ClientProvider client={fakeClient({ saveVersion: saveVersion as never, list: vi.fn(async () => [{ kind: "BeneficiaryGroup", id: "depot-staff", name: "Depot staff", version: 1, updatedOn: "" }]) as never })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <GapAddDialog open onOpenChange={() => {}} onAdded={onAdded} preset={{ affects: ["depot-staff"] }} />
        </QueryClientProvider>
      </ClientProvider>,
    );
    await user.type(screen.getByRole("textbox", { name: new RegExp(`^${gd.name}`) }), "Faults are found after dispatch");
    await user.type(screen.getByRole("textbox", { name: gd.current }), "One fault in five is found at intake");
    await user.type(screen.getByRole("textbox", { name: gd.desired }), "Every fault is found at intake");
    expect(await screen.findByRole("button", { name: /Depot staff/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: gd.save }));
    const [kind, id, doc] = saveVersion.mock.calls[0] as unknown as [string, string, { metadata: { name: string }; spec: Record<string, unknown> }];
    expect(kind).toBe("Gap");
    expect(id).toMatch(/^gap-[0-9a-f]{8}$/);
    expect(doc.metadata.name).toBe("Faults are found after dispatch");
    expect(doc.spec).toMatchObject({ current: "One fault in five is found at intake", desired: "Every fault is found at intake", affects: ["depot-staff"] });
    expect(onAdded).toHaveBeenCalledWith(id, "Faults are found after dispatch");
  });
});

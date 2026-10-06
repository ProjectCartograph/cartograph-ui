/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { RiskList } from "../RiskList";
import type { Risk } from "../types";

const rc = copy.projects.risks;

const list = vi.fn(async (kind: string) =>
  kind === "Resource"
    ? [
        { id: "steering", name: "Steering Committee", spec: { category: "governanceBody" } },
        { id: "analyst", name: "Data analyst", spec: { category: "personRole" } },
      ]
    : [],
);

function mount(risks: Risk[], roles?: { id: string; label: string }[]) {
  render(
    <ClientProvider client={fakeClient({ list: list as never })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RiskList risks={risks} phases={[]} roles={roles} onChange={() => {}} />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

// Who manages a risk day to day (TAXONOMY.md D41): a role on the work, a
// governance body (D43), or a catalogue entry where the work names no
// roles. Not who it escalates to.
describe("a risk's owner", () => {
  it("is a role on the project, read by its name", async () => {
    mount([{ id: "r-1", description: "Depots skip training", type: "risk", impact: "high", owner: { local: "resources", id: "lead" } }], [
      { id: "lead", label: "Delivery lead" },
    ]);
    const owner = screen.getByRole("combobox", { name: rc.ownerLabel });
    expect(owner).toHaveAttribute("data-cartograph-field", "/spec/risks/{r-1}/owner");
    expect(owner).toHaveTextContent("Delivery lead");
  });

  it("may be a governance body, offered beside the roles", async () => {
    mount([{ id: "r-1", description: "Late approval", type: "risk", owner: { kind: "Resource", id: "steering" } }], [
      { id: "lead", label: "Delivery lead" },
    ]);
    await waitFor(() => expect(screen.getByRole("combobox", { name: rc.ownerLabel })).toHaveTextContent("Steering Committee"));
    expect(list).toHaveBeenCalledWith("Resource", { expand: "spec" });
  });

  it("is picked from the catalogue where the work names no roles", () => {
    mount([{ id: "r-1", description: "Partners pull out", type: "risk" }]);
    const owner = document.querySelector('[data-cartograph-field="/spec/risks/{r-1}/owner"]');
    expect(owner).not.toBeNull();
  });
});

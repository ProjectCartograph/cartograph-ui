/// <reference types="@testing-library/jest-dom" />
import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { MandateSection } from "../sections/MandateSection";
import type { ProjectSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const ac = copy.projects.aim;

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Project",
  metadata: { id: "p1", name: "Project one" },
  spec: {
    team: "t1",
    mandate: [{ kind: "decision", title: "Approve the pilot", issuer: { kind: "Resource", id: "steering" } }],
  },
};

const get = vi.fn();
const list = vi.fn();
const saveWorking = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ version: { number: 0 }, manifest, yaml: "" });
  list.mockResolvedValue([{ id: "steering", name: "Steering Committee", spec: { category: "governanceBody" } }]);
  saveWorking.mockResolvedValue(undefined);
});

const seen: { spec?: ProjectSpec } = {};
function Spy() {
  const spec = useProjectStore().spec;
  useEffect(() => {
    seen.spec = spec;
  });
  return null;
}

// A mandate names its issuer by reference, a governance body or a role,
// or as text for one outside the workspace: one or the other (TAXONOMY.md
// D43).
describe("a mandate's issuer", () => {
  it("shows the body it references, and gives way to a typed issuer", async () => {
    render(
      <ClientProvider client={fakeClient({ get, list, saveWorking })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProjectStoreProvider id="p1">
            <Spy />
            <MandateSection />
          </ProjectStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    const issuer = await screen.findByRole("combobox", { name: ac.mandateIssuerLabel });
    await waitFor(() => expect(issuer).toHaveTextContent("Steering Committee"));
    await userEvent.type(screen.getByLabelText(ac.mandateIssuedByLabel), "The regulator");
    await waitFor(() => expect(seen.spec?.mandate?.[0]).toMatchObject({ issuedBy: "The regulator" }));
    expect(seen.spec?.mandate?.[0].issuer).toBeUndefined();
  });
});

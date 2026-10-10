/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider } from "../store";
import { ResourcesSection } from "../sections/ResourcesSection";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const pc = copy.projects.resources;
const get = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({
    version: { number: 0 },
    manifest: { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "One" }, spec: { resources: [{ role: "sponsor", resource: "director" }] } },
    yaml: "",
  });
});

// A project has one sponsor (engine TAXONOMY.md D61): once a row holds it,
// neither the add nor another row offers it again (#58).
describe("a project's single roles", () => {
  it("offers the sponsor only while no row holds it", async () => {
    render(
      <ClientProvider client={fakeClient({ get, list: vi.fn(async () => []), saveWorking: vi.fn(async () => undefined) })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProjectStoreProvider id="p1">
            <ResourcesSection />
          </ProjectStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    const triggers = await screen.findAllByRole("combobox", { name: pc.roleLabel });
    const add = triggers[triggers.length - 1];
    expect(add).toHaveTextContent(pc.roleKind.manager);
    await userEvent.click(add);
    const options = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
    expect(options).not.toContain(pc.roleKind.sponsor);
    expect(options).toContain(pc.roleKind.manager);
  });
});

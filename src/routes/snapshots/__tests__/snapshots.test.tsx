/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, type ComponentType } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { Route } from "../index";

// The route's own component, rendered over a fake Client. The build splits
// it out of the route file, so it arrives lazily, behind Suspense.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createFileRoute: () => (options: object) => ({ options }),
}));

const vault = { apiVersion: "cartograph/v1" as const, kind: "Vault" as const, metadata: { id: "v" }, spec: {} };
const recover = vi.fn();
const apply = vi.fn();

const Page = (Route as unknown as { options: { component: ComponentType & { preload?: () => Promise<void> } } })
  .options.component;

function mount() {
  const client = fakeClient({
    vault: async () => vault,
    excluded: async () => [{ kind: "Gap", id: "late-detection", name: "Late detection", on: "2026-09-01T00:00:00Z", reason: "duplicate" }],
    unapplied: async () => [{ kind: "Resource", id: "depot-staff", name: "Depot staff" }],
    snapshots: async () => ({ snapshots: [], cursor: null }),
    recover,
    apply,
  });
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Suspense>
          <Page />
        </Suspense>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe("Snapshots page: vault operations", () => {
  beforeAll(async () => {
    await Page.preload?.();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    recover.mockResolvedValue(vault);
    apply.mockResolvedValue(vault);
  });

  it("recovers a removed file by its Kind/id reference", async () => {
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Recover" }));
    await waitFor(() => expect(recover).toHaveBeenCalledWith("Gap/late-detection"));
  });

  it("applies a held-back file by its Kind/id reference", async () => {
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Apply" }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(["Resource/depot-staff"]));
  });
});

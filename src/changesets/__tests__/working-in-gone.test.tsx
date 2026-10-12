/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { activeChangeSet } from "@/client/active";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { NotFound } from "@/client/port";
import { WorkingIn } from "../WorkingIn";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="#">{children}</a>,
  useNavigate: () => () => {},
}));

// A change set kept from before the workspace was made fresh is not one
// to work in: every read through it would fail, so it is left.
describe("working in a change set the workspace does not have", () => {
  it("leaves it", async () => {
    activeChangeSet.set("gone");
    const client = fakeClient({
      changeSet: async () => {
        throw new NotFound([{ path: "", message: "not found: change set gone" }]);
      },
      changeSets: async () => [],
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <WorkingIn />
        </QueryClientProvider>
      </ClientProvider>,
    );
    await waitFor(() => expect(activeChangeSet.get()).toBeUndefined());
  });
});

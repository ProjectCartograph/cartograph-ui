/// <reference types="@testing-library/jest-dom" />
// Every sheet says what it holds, in the engine's words.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { SheetsIndex } from "@/surfaces/sheet/SheetsIndex";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="#">{children}</a>,
}));

describe("the sheets", () => {
  it("define each kind beside its name, with how many there are", async () => {
    const client = fakeClient({
      kinds: async () => [{ kind: "Segment", count: 4, summary: "A way of slicing up what the organisation serves." }],
      unapplied: async () => [],
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <SheetsIndex />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText("A way of slicing up what the organisation serves.")).toBeInTheDocument();
    expect(screen.getByText("4 records")).toBeInTheDocument();
  });
});

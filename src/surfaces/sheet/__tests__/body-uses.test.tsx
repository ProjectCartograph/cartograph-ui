/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { BodyUses } from "../BodyUses";

const c = copy.sheets.bodyUses;

// A governance body's dialog lists what it confirms, receives and decided,
// as the engine names each place that references it (TAXONOMY.md D43).
describe("what a governance body decides", () => {
  it("groups the places that name it", async () => {
    const references = vi.fn().mockResolvedValue({
      outgoing: [],
      incoming: [],
      uses: [
        { kind: "Project", id: "rollout", name: "Rollout", path: "/spec/mandate/0/issuer/id", as: "decided" },
        { kind: "Project", id: "rollout", name: "Rollout", path: "/spec/successCriteria/0/confirmedBy/id", as: "confirms" },
        { kind: "Project", id: "survey", name: "Survey", path: "/spec/risks/1/escalate/to/id", as: "receives" },
        { kind: "Project", id: "survey", name: "Survey", path: "/spec/team", as: undefined },
      ],
    });
    render(
      <ClientProvider client={fakeClient({ references })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <BodyUses id="steering" />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText(c.decided)).toBeInTheDocument();
    expect(document.querySelector('[data-slot="body-confirms"]')).toHaveTextContent(`${c.confirms}Rollout`);
    expect(document.querySelector('[data-slot="body-receives"]')).toHaveTextContent(`${c.receives}Survey`);
    expect(references).toHaveBeenCalledWith("Resource", "steering");
  });

  it("says so when nothing names it", async () => {
    const references = vi.fn().mockResolvedValue({ outgoing: [], incoming: [] });
    render(
      <ClientProvider client={fakeClient({ references })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <BodyUses id="steering" />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText(c.none)).toBeInTheDocument();
  });
});

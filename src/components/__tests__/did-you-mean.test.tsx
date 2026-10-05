/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Match } from "@/client/port";
import { copy } from "@/copy";
import { DidYouMean } from "../DidYouMean";

const dc = copy.didYouMean;

function mount(name: string, found: Match[]) {
  const onUse = vi.fn();
  const match = vi.fn(async () => found);
  render(
    <ClientProvider client={fakeClient({ match })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DidYouMean kind="BeneficiaryGroup" name={name} onUse={onUse} />
      </QueryClientProvider>
    </ClientProvider>,
  );
  return { onUse, match };
}

// What is already there under another spelling or form is offered before
// it is named twice: used, or declined, and only when the matcher is sure.
describe("did you mean", () => {
  it("offers the one already there, spelt otherwise, to use", async () => {
    const customers: Match = { kind: "BeneficiaryGroup", id: "depot-customers", name: "Depot Customers", likelihood: 1, by: "words" };
    const { onUse, match } = mount("Depot customers", [customers]);
    expect(await screen.findByText("Depot Customers")).toBeInTheDocument();
    expect(match).toHaveBeenCalledWith("BeneficiaryGroup", "Depot customers", undefined);
    fireEvent.click(screen.getByRole("button", { name: dc.use }));
    expect(onUse).toHaveBeenCalledWith(customers);
  });

  it("goes when declined", async () => {
    mount("SMS", [{ kind: "BeneficiaryGroup", id: "sms", name: "Student Management System", likelihood: 1, by: "words" }]);
    fireEvent.click(await screen.findByRole("button", { name: dc.keep }));
    expect(screen.queryByText(dc.ask, { exact: false })).toBeNull();
  });

  it("asks nothing when the matcher is not sure", async () => {
    const { match } = mount("Depot", [{ kind: "BeneficiaryGroup", id: "depot-staff", name: "Depot staff", likelihood: 0.5, by: "words" }]);
    await waitFor(() => expect(match).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });
});

/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { Refused } from "@/client/port";
import { copy } from "@/copy";
import { UnappliedBar } from "../Unapplied";

const uc = copy.sheets.unapplied;

const unapplied = vi.fn();
const apply = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  unapplied.mockResolvedValue([
    { kind: "Gap", id: "g1", name: "One" },
    { kind: "Gap", id: "g2", name: "Two" },
    { kind: "Resource", id: "r1", name: "Elsewhere" },
  ]);
  apply.mockResolvedValue({ apiVersion: "cartograph/v1", kind: "Vault", metadata: { id: "v" }, spec: {} });
});

function mount(kind: string) {
  return render(
    <ClientProvider client={fakeClient({ unapplied, apply })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <UnappliedBar kind={kind} />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe("what a vault is withholding", () => {
  it("counts only this directory's files", async () => {
    mount("Gap");
    // Two gaps, not the resource sitting beside them.
    expect(await screen.findByText(uc.count(2))).toBeInTheDocument();
  });

  it("says nothing when a directory is withholding nothing", async () => {
    const { container } = mount("Team");
    await waitFor(() => expect(unapplied).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("applies every one of them, and only them, in one request", async () => {
    mount("Gap");
    await userEvent.click(await screen.findByRole("button", { name: uc.applyAll(2) }));
    // One call for the batch. One per ref made the server rewrite the
    // vault and reindex it once each, which is what made it slow.
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply).toHaveBeenCalledWith(["Gap/g1", "Gap/g2"]);
  });

  it("says so when one is refused, rather than looking like it worked", async () => {
    apply.mockRejectedValue(new Refused([]));
    mount("Gap");
    await userEvent.click(await screen.findByRole("button", { name: uc.applyAll(2) }));
    expect(await screen.findByText(uc.failed)).toBeInTheDocument();
  });
});

/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { client } from "@/api/client";
import { copy } from "@/copy";
import { UnappliedBar } from "../Unapplied";

vi.mock("@/api/client");
const mocked = vi.mocked(client);
const uc = copy.sheets.unapplied;

const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocked.GET.mockImplementation((async () =>
    ok([
      { kind: "Gap", id: "g1", name: "One" },
      { kind: "Gap", id: "g2", name: "Two" },
      { kind: "Resource", id: "r1", name: "Elsewhere" },
    ])) as never);
  mocked.POST.mockImplementation((async () => ok(undefined)) as never);
});

function mount(kind: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UnappliedBar kind={kind} />
    </QueryClientProvider>,
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
    await waitFor(() => expect(mocked.GET).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("applies every one of them, and only them, in one request", async () => {
    mount("Gap");
    await userEvent.click(await screen.findByRole("button", { name: uc.applyAll(2) }));
    // One call for the batch. One per ref made the server rewrite the
    // vault and reindex it once each, which is what made it slow.
    await waitFor(() => expect(mocked.POST).toHaveBeenCalledTimes(1));
    const body = (mocked.POST.mock.calls[0][1] as unknown as { body: { refs: string[] } }).body;
    expect(body.refs).toEqual(["Gap/g1", "Gap/g2"]);
  });

  it("says so when one is refused, rather than looking like it worked", async () => {
    mocked.POST.mockImplementation((async () => ({
      data: undefined,
      error: { problems: [] },
      response: new Response(null, { status: 422 }),
    })) as never);
    mount("Gap");
    await userEvent.click(await screen.findByRole("button", { name: uc.applyAll(2) }));
    expect(await screen.findByText(uc.failed)).toBeInTheDocument();
  });
});

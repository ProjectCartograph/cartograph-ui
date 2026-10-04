/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Relevance } from "@/client/port";
import { copy } from "@/copy";
import { Suggested, WorkTextProvider } from "../relevance";

function mount(text: string, answer: Relevance, selected: string[] = []) {
  const relevant = vi.fn(async () => answer);
  const onPick = vi.fn();
  render(
    <ClientProvider client={fakeClient({ relevant })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <WorkTextProvider text={text}>
          <Suggested kind="Goal" level="outcome" selected={selected} onPick={onPick} />
        </WorkTextProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
  return { relevant, onPick };
}

const outcome = (id: string, name: string) => ({ kind: "Goal", id, name, level: "outcome", likelihood: 0.8, by: "model" });

// What the workspace holds that is relevant to the work is put first, and
// picking one does what picking it in the list would (engine
// docs/adr/0023). It ranks; it never chooses.
describe("suggestions from what was written", () => {
  it("asks for the kind against the work's own words, and offers what comes back", async () => {
    const { relevant, onPick } = mount("Train depot staff to apply one checklist", {
      available: true,
      matches: [outcome("staff-alike", "Depot staff apply the standard alike"), outcome("faults", "Faults are found before dispatch")],
    }, ["faults"]);
    expect(await screen.findByText(copy.common.suggested)).toBeInTheDocument();
    expect(relevant).toHaveBeenCalledWith("Train depot staff to apply one checklist", ["Goal"], "outcome");
    // What is already picked shows as picked.
    expect(screen.getByRole("button", { name: /Faults are found/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Depot staff apply/ }));
    expect(onPick).toHaveBeenCalledWith("staff-alike");
  });

  it("says when the ranking is by shared words", async () => {
    mount("Train depot staff to apply one checklist", { available: false, matches: [{ ...outcome("staff-alike", "Depot staff apply the standard alike"), by: "words" }] });
    expect(await screen.findByText(copy.common.suggestedByWords)).toBeInTheDocument();
  });

  it("asks nothing until there is enough written to rank against", async () => {
    const { relevant } = mount("Depots", { available: true, matches: [outcome("x", "X")] });
    await new Promise((r) => setTimeout(r, 50));
    expect(relevant).not.toHaveBeenCalled();
    expect(screen.queryByText(copy.common.suggested)).toBeNull();
  });
});

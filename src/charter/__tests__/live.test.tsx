/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { CharterPart } from "@/client/port";
import { copy } from "@/copy";
import { LiveCharter } from "../LiveCharter";

const lc = copy.charter.live;

// The parts the engine renders: the problem, written, and the
// stakeholders, still to say (engine TAXONOMY.md D55).
const parts: CharterPart[] = [
  {
    title: "Problem statement",
    step: "aim",
    anchor: "s2",
    html: '<dl>\n<dt>Problem</dt><dd data-field="/spec/summary/problems/0/problem/situation">Depots grade produce differently</dd>\n</dl>',
    fields: ["/spec/summary/problems/0/problem/situation"],
    empty: false,
  },
  { title: "Stakeholders", step: "stakeholders", html: "", fields: [], empty: true },
];

function mount(over: Partial<Parameters<typeof LiveCharter>[0]> = {}) {
  const onField = vi.fn();
  const onStep = vi.fn();
  render(
    <ClientProvider client={fakeClient({ charterParts: async () => parts })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LiveCharter
          id="p1"
          version={1}
          onStep={onStep}
          onField={onField}
          valueOf={() => "Depots grade produce differently"}
          checksOf={(step) => (step === "aim" ? ["Say why it matters"] : [])}
          {...over}
        />
      </QueryClientProvider>
    </ClientProvider>,
  );
  return { onField, onStep };
}

describe("the live charter", () => {
  it("draws each part, and a placeholder where nothing is said yet", async () => {
    mount();
    expect(await screen.findByText("Depots grade produce differently")).toBeInTheDocument();
    const empty = screen.getByRole("article", { name: "Stakeholders" });
    expect(within(empty).getByText(lc.placeholder)).toBeInTheDocument();
  });

  it("opens a part's menu from the keyboard, and edits a field in place", async () => {
    const { onField, onStep } = mount();
    const part = await screen.findByRole("article", { name: "Problem statement" });
    part.focus();
    fireEvent.keyDown(part, { key: "F10", shiftKey: true });
    const edit = await screen.findByRole("menuitem", { name: lc.edit("Problem") });
    expect(screen.getByRole("menuitem", { name: lc.openStep })).toBeInTheDocument();
    await userEvent.click(edit);
    const panel = await screen.findByRole("group", { name: lc.panel("Problem") });
    expect(within(panel).getByText("Say why it matters")).toBeInTheDocument();
    const box = within(panel).getByRole("textbox");
    await userEvent.clear(box);
    await userEvent.type(box, "Depots grade produce three ways{Enter}");
    expect(onField).toHaveBeenCalledWith("/spec/summary/problems/0/problem/situation", "Depots grade produce three ways");
    // A right click opens the same menu; its step opens the walk there.
    fireEvent.contextMenu(part);
    await userEvent.click(await screen.findByRole("menuitem", { name: lc.openStep }));
    expect(onStep).toHaveBeenCalledWith("aim");
  });

  it("opens a field clicked in the text, and follows the walk", async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    mount({ step: "stakeholders" });
    fireEvent.click(await screen.findByText("Depots grade produce differently"));
    expect(await screen.findByRole("group", { name: lc.panel("Problem") })).toBeInTheDocument();
    await waitFor(() => expect(scrolled).toHaveBeenCalled());
  });
});

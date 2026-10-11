/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { CharterPart } from "@/client/port";
import { copy } from "@/copy";
import { CharterDocument } from "../CharterDocument";

const dc = copy.charter.doc;

// What the engine renders for the parts, every value marked by its field
// (engine render/editable.go).
const parts: CharterPart[] = [
  {
    title: "At a glance",
    anchor: "s1",
    html: '<dl class="facts"><div><dt>Start</dt><dd><span data-source="/spec/milestones">September 2025</span></dd></div></dl>',
    fields: [],
    empty: false,
  },
  {
    title: "Problem statement",
    step: "aim",
    anchor: "s2",
    html:
      '<dl>\n<dt>Problem</dt><dd><span data-field="/spec/summary/problems/0/problem/situation">Depots grade produce differently</span></dd>\n' +
      '<dt>Cause</dt><dd><span data-field="/spec/summary/problems/0/problem/cause" data-empty=""></span></dd>\n</dl>\n' +
      '<p data-add="/spec/summary/problems" data-add-label="Problem"></p>',
    fields: ["/spec/summary/problems/0/problem/situation", "/spec/summary/problems/0/problem/cause"],
    empty: false,
  },
  {
    title: "Key risks",
    step: "risks",
    anchor: "s3",
    html: '<table><tr><th>Risk</th><th>Impact</th></tr><tr><td><span data-field="/spec/risks/0/description">Graders leave</span></td><td><span data-field="/spec/risks/0/impact">high</span></td></tr></table>',
    fields: ["/spec/risks/0/description", "/spec/risks/0/impact"],
    empty: false,
  },
];

const schema = {
  properties: {
    spec: {
      properties: {
        summary: { properties: { problems: { type: "array", items: { properties: { problem: { properties: { situation: { type: "string" }, cause: { type: "string" } } } } } } } },
        risks: { type: "array", items: { properties: { description: { type: "string" }, impact: { type: "string", enum: ["low", "medium", "high"] } } } },
        milestones: { type: "array", items: { properties: { id: { type: "string" }, name: { type: "string" }, note: { type: "string" } } } },
      },
    },
  },
};

let latest: Record<string, unknown> = {};
function Harness() {
  const [spec, setSpec] = useState<Record<string, unknown>>({
    summary: { problems: [{ problem: { situation: "Depots grade produce differently" } }] },
    risks: [{ description: "Graders leave", impact: "high" }],
    milestones: [{ id: "m1", name: "Pilot starts" }],
  });
  latest = spec;
  return <CharterDocument id="p1" spec={spec} update={(fn) => setSpec((s) => fn(s))} schema={schema} renderParty={() => null} />;
}

function mount() {
  render(
    <ClientProvider client={fakeClient({ charterParts: (async () => parts) as never })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Harness />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

// The charter is edited where it is read, as a shared document is: no
// step to open, no panel to fill (#75).
describe("the charter as a document", () => {
  it("takes the cursor in its text and keeps what is typed", async () => {
    mount();
    const cause = await screen.findByRole("textbox", { name: "Cause" });
    expect(cause).toHaveAttribute("contenteditable", "plaintext-only");
    expect(cause).toHaveAttribute("data-placeholder", dc.write);
    // jsdom has no editable text to type into: the text goes in as a
    // browser puts it, then Enter ends it (Chromium checks the typing).
    cause.focus();
    cause.textContent = "Each depot keeps its own checklist";
    fireEvent.input(cause);
    fireEvent.keyDown(cause, { key: "Enter" });
    fireEvent.blur(cause);
    await waitFor(() => expect((latest.summary as { problems: { problem: { cause?: string } }[] }).problems[0].problem.cause).toBe("Each depot keeps its own checklist"));
  });

  it("opens a choice at the value, and keeps the one chosen", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: dc.change("Impact") }));
    await user.click(within(screen.getByRole("radiogroup", { name: "Impact" })).getByRole("radio", { name: "Medium" }));
    expect((latest.risks as { impact: string }[])[0].impact).toBe("medium");
  });

  it("opens what a worked-out value comes from, in place", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: dc.source("Start") }));
    const panel = screen.getByRole("group", { name: "Start" });
    expect(within(panel).getByText(dc.from("Start", "milestones"))).toBeInTheDocument();
    const name = within(panel).getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Pilot begins");
    fireEvent.blur(name);
    expect((latest.milestones as { name: string }[])[0].name).toBe("Pilot begins");
  });

  it("adds a list's next item under it, and takes a row away", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: dc.add("Problem") }));
    expect((latest.summary as { problems: unknown[] }).problems).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: dc.remove })[0]);
    expect(latest.risks).toEqual([]);
  });
});

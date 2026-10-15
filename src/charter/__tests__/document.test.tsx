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
    title: "Problem, as a sentence",
    step: "aim",
    anchor: "s4",
    html: '<p class="problem-statement"><span data-field="/spec/summary/problems/0/groups" data-part="" data-hint="who it affects"><span class="mention">Depot staff</span></span> <span data-field="/spec/summary/problems/0/problem/situation" data-part="" data-hint="what goes wrong for them">depots grade produce differently</span>.</p>',
    fields: ["/spec/summary/problems/0/groups", "/spec/summary/problems/0/problem/situation"],
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
    const name = within(panel).getByRole("textbox", { name: copy.charter.doc.fields["milestones.name"] });
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

// An item just added can be taken back: Escape, or leaving it with
// nothing written, as if Add had not been pressed; once something in it
// is kept it stays (cartograph-ui#125). The engine would draw the new
// item's fields after Add; here they are drawn from the start.
describe("an item just added", () => {
  const withNew: CharterPart[] = parts.map((p) =>
    p.title !== "Problem statement"
      ? p
      : {
          ...p,
          html: p.html.replace(
            "<p data-add",
            '<dl><dt>Problem</dt><dd><span data-field="/spec/summary/problems/1/problem/situation" data-empty=""></span></dd>\n' +
              '<dt>Cause</dt><dd><span data-field="/spec/summary/problems/1/problem/cause" data-empty=""></span></dd></dl>\n<p data-add',
          ),
        },
  );
  function mountNew() {
    render(
      <ClientProvider client={fakeClient({ charterParts: (async () => withNew) as never })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Harness />
        </QueryClientProvider>
      </ClientProvider>,
    );
  }
  const problems = () => (latest.summary as { problems: unknown[] }).problems;
  const newField = () => document.querySelector<HTMLElement>('[data-field="/spec/summary/problems/1/problem/situation"]')!;

  it("is taken back by Escape", async () => {
    const user = userEvent.setup();
    mountNew();
    await user.click(await screen.findByRole("button", { name: dc.add("Problem") }));
    expect(problems()).toHaveLength(2);
    newField().focus();
    fireEvent.keyDown(newField(), { key: "Escape" });
    fireEvent.blur(newField());
    await waitFor(() => expect(problems()).toHaveLength(1));
  });

  it("is taken back when left with nothing written", async () => {
    const user = userEvent.setup();
    mountNew();
    await user.click(await screen.findByRole("button", { name: dc.add("Problem") }));
    newField().focus();
    fireEvent.blur(newField());
    await waitFor(() => expect(problems()).toHaveLength(1));
  });

  it("stays while the cursor moves between its own fields", async () => {
    const user = userEvent.setup();
    mountNew();
    await user.click(await screen.findByRole("button", { name: dc.add("Problem") }));
    newField().focus();
    const cause = document.querySelector<HTMLElement>('[data-field="/spec/summary/problems/1/problem/cause"]')!;
    fireEvent.blur(newField(), { relatedTarget: cause });
    expect(problems()).toHaveLength(2);
  });

  it("stays once something in it is kept, and Escape then only restores the field", async () => {
    const user = userEvent.setup();
    mountNew();
    await user.click(await screen.findByRole("button", { name: dc.add("Problem") }));
    newField().focus();
    newField().textContent = "Buyers find bruising a week late";
    fireEvent.input(newField());
    fireEvent.blur(newField());
    await waitFor(() => expect((problems()[1] as { problem: { situation?: string } }).problem.situation).toBe("Buyers find bruising a week late"));
    newField().focus();
    newField().textContent = "Something else";
    fireEvent.keyDown(newField(), { key: "Escape" });
    fireEvent.blur(newField());
    expect(problems()).toHaveLength(2);
    expect((problems()[1] as { problem: { situation?: string } }).problem.situation).toBe("Buyers find bruising a week late");
  });
});

// A problem reads as a sentence; each part opens beside it, never typed
// into (cartograph-engine#79).
describe("a problem as a sentence", () => {
  it("opens a part to change it, and keeps the sentence untyped", async () => {
    const user = userEvent.setup();
    mount();
    const part = await screen.findByRole("button", { name: dc.change("What goes wrong for them") });
    expect(part).not.toHaveAttribute("contenteditable");
    await user.click(part);
    const box = within(screen.getByRole("group", { name: "What goes wrong for them" })).getByRole("textbox");
    await user.clear(box);
    await user.type(box, "Depots grade alike{Enter}");
    expect((latest.summary as { problems: { problem: { situation: string } }[] }).problems[0].problem.situation).toBe("Depots grade alike");
  });
});

// A source panel names each item and says what to write; a measured
// target is built as its step builds it (#78, #79).
describe("the charter's editors", () => {
  it("names what a field is for, KPI in capitals, codes as written", async () => {
    const { wordsOf } = await import("../words");
    expect(wordsOf("kpi")).toBe("KPI");
    expect(wordsOf("USD")).toBe("USD");
    expect(wordsOf("atClosing")).toBe("At closing");
    expect(copy.charter.doc.fields["kpis.reason"]).not.toBe("Reason");
  });

  it("builds a success criterion's target", async () => {
    const { editorAt } = await import("../schemaAt");
    expect(editorAt(undefined, "/spec/successCriteria/0/standard")).toEqual({ kind: "standard" });
  });
});

/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Client } from "@/client/port";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { DataSection } from "../sections/DataSection";
import { ClosingSection } from "../sections/ClosingSection";
import { LandingSection } from "../sections/LandingSection";
import type { ProjectSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const dc = copy.projects.data;
const cl = copy.projects.closing;
const lc = copy.projects.landingCriteria;
const sk = copy.projects.success;

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Project",
  metadata: { id: "p1", name: "Project one" },
  spec: {
    summary: { problems: [{ problem: "A gap", change: "No gap" }] },
    team: "t1",
    data: {
      consumes: [{ source: "member-register", purpose: "Finding who is due a delivery" }],
      produces: [
        {
          output: "documentsOrFiles",
          sink: "evidence-library",
          purpose: "Holding the signed check sheets",
          personalData: "none",
        },
      ],
    },
    deliverables: [
      { id: "dv-1", name: "Training pack", acceptance: [{ by: { local: "resources", id: "quality-reviewer" }, outcome: "signs it off" }] },
      { id: "dv-2", name: "Check standard" },
    ],
    resources: [
      { id: "quality-reviewer", role: "teamMember", resource: "quality-reviewer" },
      { id: "sponsor", role: "sponsor", resource: "depot-network" },
    ],
    successCriteria: [
      {
        id: "sc-1",
        statement: "The review is complete with no open actions",
        metric: "compliance",
        owner: { local: "resources", id: "quality-reviewer" },
        confirmedBy: { local: "resources", id: "sponsor" },
        when: "atClosing",
      },
      {
        id: "sc-2",
        statement: "Faults are found at intake",
        metric: "business",
        standard: "at least 85 percent",
        source: "member-register",
        cycle: "seasonal",
        owner: { local: "resources", id: "quality-reviewer" },
        confirmedBy: { local: "resources", id: "sponsor" },
        when: "atLanding",
      },
    ],
  },
};

const sources = [
  { id: "member-register", name: "Member Register" },
  { id: "evidence-library", name: "Evidence Library" },
];

const get = vi.fn();
const list = vi.fn();
const saveWorking = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  asked = [];
  get.mockResolvedValue({ version: { number: 0 }, manifest, yaml: "" });
  // A role reads as the catalogue entry it names, so the directory has to
  // answer for a name to appear at all.
  list.mockImplementation(async (kind: string) =>
    kind === "Resource"
      ? [
          { id: "quality-reviewer", name: "Quality reviewer" },
          { id: "depot-network", name: "Depot network" },
        ]
      : sources,
  );
  saveWorking.mockResolvedValue(undefined);
});

/** Every method of the Client the step called, in order. */
let asked: string[] = [];
function watched(client: Client): Client {
  const seen = { ...client } as Record<string, (...a: unknown[]) => unknown>;
  for (const [name, fn] of Object.entries(seen)) {
    seen[name] = (...a: unknown[]) => {
      asked.push(name);
      return fn(...a);
    };
  }
  return seen as unknown as Client;
}

let spec: ProjectSpec;

function Spy() {
  spec = useProjectStore().spec;
  return null;
}

async function mount(section: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ClientProvider client={watched(fakeClient({ get, list, saveWorking }))}>
      <QueryClientProvider client={queryClient}>
        <ProjectStoreProvider id="p1">
          <Spy />
          {section}
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe("the data step says what the project does to data", () => {
  it("asks each half its own question, so no box is a mystery", async () => {
    await mount(<DataSection />);
    await screen.findByText(dc.usesTitle);

    // The middle box was a bare input with a placeholder; both sides now
    // carry a heading in their own words (Programme Lead, 2026-09-27).
    // Both halves ask for a purpose, one under each heading.
    const purposes = screen.getAllByLabelText(dc.usePurposeLabel);
    expect(purposes[0]).toHaveValue("Finding who is due a delivery");
    expect(screen.getByText(dc.usesTitle)).toBeInTheDocument();
    expect(screen.getByText(dc.producesTitle)).toBeInTheDocument();
  });

  // Radix's Select only renders its selected text once its content has
  // mounted, which never happens in jsdom, so the shape is asserted on
  // the control and on the store; the rendered word is covered by the
  // headless-Chromium sweep instead.
  it("every output says what it is and where it lands", async () => {
    await mount(<DataSection />);
    // Wait for the register to arrive: until it does the picker shows the
    // raw id rather than the source's name.
    await screen.findByText("Evidence Library");

    expect(screen.getByRole("combobox", { name: dc.outputLabel })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: dc.sinkLabel })).toHaveTextContent("Evidence Library");
    expect(spec.data?.produces?.[0]).toMatchObject({
      output: "documentsOrFiles",
      sink: "evidence-library",
    });
    // The old shape is gone: an output names a sink, never a source.
    expect(spec.data?.produces?.[0]).not.toHaveProperty("source");
  });

  // A new output that lands nowhere is the thing the contract now
  // refuses, so the row starts with a sink to fill in, never without one.
  it("a new output starts with a shape and an empty sink, not a source", async () => {
    const user = userEvent.setup();
    await mount(<DataSection />);
    await screen.findByText(dc.producesTitle);

    await user.click(screen.getByRole("button", { name: dc.addOutput }));

    expect(spec.data?.produces).toHaveLength(2);
    expect(spec.data?.produces?.[1]).toEqual({
      output: "recordsInExistingSource",
      sink: "",
      purpose: "",
      personalData: "none",
    });
  });

  it("picks a sink from the register", async () => {
    const user = userEvent.setup();
    await mount(<DataSection />);
    await screen.findByText(dc.producesTitle);

    await user.click(screen.getByRole("combobox", { name: dc.sinkLabel }));
    await user.click(await screen.findByRole("option", { name: /Member Register/ }));

    expect(spec.data?.produces?.[0].sink).toBe("member-register");
  });
});

describe("closing shows what the deliverables already promise", () => {
  // What the deliverables promise is read here as Scope wrote it, and
  // edited only there: one fact, one place.
  it("shows every deliverable's acceptance criteria, read-only", async () => {
    await mount(<ClosingSection id="p1" />);
    await screen.findByText(cl.deliverablesTitle);

    const cards = document.querySelectorAll('[data-slot="closing-deliverable"]');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Training pack");
    expect(cards[0]).toHaveTextContent("signs it off");
    expect(screen.queryByDisplayValue("signs it off")).toBeNull();
  });

  it("marks a deliverable that has no test", async () => {
    await mount(<ClosingSection id="p1" />);
    await screen.findByText(cl.deliverablesTitle);

    const cards = document.querySelectorAll('[data-slot="closing-deliverable"]');
    expect(within(cards[0] as HTMLElement).queryByLabelText(cl.noTest)).toBeNull();
    expect(within(cards[1] as HTMLElement).getByLabelText(cl.noTest)).toBeInTheDocument();
  });

  // The criteria themselves are written on the Success step now, so
  // Closing shows its own slice read-only and links back.
  it("shows the slice due on the day, read-only", async () => {
    await mount(<ClosingSection id="p1" />);
    await screen.findByText(cl.criteriaTitle);

    const cards = document.querySelectorAll('[data-slot="criterion-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("The review is complete with no open actions");
    // Nothing on this screen edits a criterion.
    expect(within(cards[0] as HTMLElement).queryByRole("textbox")).toBeNull();
    expect(screen.getByText(cl.editOnSuccess)).toBeInTheDocument();
  });

  it("asks for no threshold and no when of its own", async () => {
    await mount(<ClosingSection id="p1" />);
    await screen.findByText(cl.criteriaTitle);

    expect(screen.queryByPlaceholderText("95%")).toBeNull();
    expect(screen.queryByRole("combobox", { name: /when/i })).toBeNull();
  });

  it("says nothing in paragraphs", async () => {
    await mount(<ClosingSection id="p1" />);
    await screen.findByText(cl.deliverablesTitle);

    const longest = Array.from(document.querySelectorAll("p"))
      .map((el) => (el.textContent ?? "").trim().length)
      .reduce((a, b) => Math.max(a, b), 0);
    expect(longest).toBeLessThan(60);
  });

  it("derives nothing from an endpoint", async () => {
    await mount(<ClosingSection id="p1" />);
    await screen.findByText(cl.deliverablesTitle);

    // Only manifests are read (as files, or as their shared drafts):
    // nothing the engine derives.
    expect(asked.every((m) => m === "get" || m === "list" || m === "openDraft")).toBe(true);
  });
});

describe("landing reads its own slice of the standard", () => {
  it("shows what falls due once it is in use, and nothing else", async () => {
    await mount(<LandingSection id="p1" />);
    await screen.findByText(lc.title);

    const cards = document.querySelectorAll('[data-slot="criterion-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("Faults are found at intake");
    // The closing line is not shown here.
    expect(document.body.textContent).not.toContain("The review is complete");
    expect(screen.getByText(lc.editOnSuccess)).toBeInTheDocument();
  });

  // A measured line reads as one sentence: the outcome, the bar it
  // clears, where it is read from and how often.
  it("reads the measurement into the sentence", async () => {
    await mount(<LandingSection id="p1" />);
    await screen.findByText(/Faults are found at intake/);

    const card = document.querySelector('[data-slot="criterion-card"]') as HTMLElement;
    expect(card).toHaveTextContent("at least 85 percent");
    // A role reads as the catalogue entry it names, which is fetched, so
    // the name arrives a tick after the sentence it sits in.
    await waitFor(() => {
      expect(card).toHaveTextContent(`${sk.tracked} Quality reviewer`);
      expect(card).toHaveTextContent(`${sk.confirmed} Depot network`);
    });
  });
});

describe("the data section keeps the consume side read-only in shape", () => {
  it("a new consumed source has a source and a purpose and nothing else", async () => {
    const user = userEvent.setup();
    await mount(<DataSection />);
    await screen.findByText(dc.usesTitle);

    await user.click(screen.getByRole("button", { name: dc.addUse }));
    expect(spec.data?.consumes?.[1]).toEqual({ source: "", purpose: "" });
  });

  it("names within(the produces column) only the produce controls", async () => {
    await mount(<DataSection />);
    const heading = await screen.findByText(dc.producesTitle);
    const column = heading.closest("div")?.parentElement as HTMLElement;
    expect(within(column).getByRole("combobox", { name: dc.outputLabel })).toBeInTheDocument();
    expect(within(column).queryByRole("combobox", { name: dc.sourceLabel })).toBeNull();
  });
});

// A criterion judged at closing records its result there, as an event
// (engine TAXONOMY.md D52), and closing signs only its own lines.
describe("results and sign-off at closing", () => {
  it("records a criterion's result and shows it", async () => {
    const rc = copy.projects.criterionResult;
    await mount(<ClosingSection id="p1" />);
    const result = await screen.findByRole("group", { name: rc.label("The review is complete with no open actions") });
    await userEvent.click(within(result).getByRole("radio", { name: copy.projects.approval.happenedWords.met }));
    await userEvent.type(within(result).getByLabelText(rc.value), "12");
    await userEvent.type(within(result).getByLabelText(copy.projects.approval.evidence), "the closure review");
    await userEvent.click(within(result).getByRole("button", { name: rc.record("The review is complete with no open actions") }));
    await waitFor(() => expect(spec.events).toHaveLength(1));
    expect(spec.events?.[0]).toMatchObject({ on: { local: "successCriteria", id: "sc-1" }, happened: "met", value: 12, evidence: "the closure review" });
    expect(await screen.findByText("(the closure review)")).toBeInTheDocument();
  });

  it("offers a sign-off line for closing, and only closing's", async () => {
    const ac = copy.projects.approval;
    await mount(<ClosingSection id="p1" />);
    await userEvent.click(await screen.findByRole("button", { name: ac.addSignOff }));
    await waitFor(() => expect(spec.signOffs).toHaveLength(1));
    expect(spec.signOffs?.[0].stage).toBe("closing");
  });
});

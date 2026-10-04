/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { SuccessSection } from "../sections/SuccessSection";
import { composeStandard, parseStandard } from "../StandardPicker";
import type { ProjectSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const sk = copy.projects.success;
const dlg = sk.dialog;

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Project",
  metadata: { id: "p1", name: "Project one" },
  spec: {
    summary: { problems: [{ problem: "A gap", change: "No gap" }] },
    team: "t1",
    resources: [
      { id: "sponsor", role: "sponsor", resource: "depot-network" },
      { id: "quality-reviewer", role: "manager", resource: "quality-reviewer" },
    ],
    successCriteria: [
      {
        id: "sc-1",
        statement: "The review is closed with no open actions",
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
        source: "quality-check-tool",
        cycle: "seasonal-cycle",
        owner: { local: "resources", id: "quality-reviewer" },
        confirmedBy: { local: "resources", id: "sponsor" },
        when: "atLanding",
      },
    ],
  },
};

const sources = [{ id: "quality-check-tool", name: "Quality Check Tool" }];
// A role reads as the catalogue entry it names, looked up rather than
// copied, so the directory has to answer for these tests to see a name.
const catalogue = [
  { id: "depot-network", name: "Depot network" },
  { id: "quality-reviewer", name: "Quality reviewer" },
  { id: "programme-board", name: "Programme board" },
];
const cycles = [{ id: "seasonal-cycle", name: "Seasonal cycle" }];

const get = vi.fn();
const list = vi.fn();
const saveWorking = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ version: { number: 0 }, manifest, yaml: "" });
  list.mockImplementation(async (kind: string) =>
    kind === "ReportingCycle" ? cycles : kind === "Resource" ? catalogue : sources,
  );
  saveWorking.mockResolvedValue(undefined);
});

let spec: ProjectSpec;

function Spy() {
  spec = useProjectStore().spec;
  return null;
}

async function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ClientProvider client={fakeClient({ get, list, saveWorking })}>
      <QueryClientProvider client={queryClient}>
        <ProjectStoreProvider id="p1">
          <Spy />
          <SuccessSection />
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe("the standard lives on one step", () => {
  it("groups every criterion by when it falls due", async () => {
    await mount();
    await screen.findByText(/Faults are found at intake/);

    for (const when of ["atClosing", "atLanding", "postClosingCycle"] as const) {
      expect(screen.getByRole("heading", { name: sk.when[when] })).toBeInTheDocument();
    }
    const closing = document.querySelector('[data-slot="success-atClosing"]') as HTMLElement;
    const landing = document.querySelector('[data-slot="success-atLanding"]') as HTMLElement;
    expect(within(closing).getByText(/The review is closed/)).toBeInTheDocument();
    expect(within(landing).getByText(/Faults are found at intake/)).toBeInTheDocument();
  });

  // The method and the frequency are register entries, so a card reads
  // their names rather than two ids or two more free-text boxes.
  it("shows a measured line's parts under their own labels", async () => {
    await mount();
    await screen.findByText("Faults are found at intake");
    const parts = document.querySelector('[data-slot="criterion-parts"]') as HTMLElement;
    expect(parts).toHaveTextContent(`${sk.standard}at least 85 percent`);
    expect(parts).toHaveTextContent(`${sk.readFrom}Quality Check Tool`);
    expect(parts).toHaveTextContent(`${sk.each}Seasonal cycle`);
  });

  // Compliance is satisfied rather than measured, so it shows no
  // measurement parts at all.
  it("leaves a compliance line unmeasured", async () => {
    await mount();
    expect(await screen.findByText("The review is closed with no open actions")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="criterion-parts"]')).toHaveLength(1);
  });

  it("shows who tracks and who confirms, as two different roles", async () => {
    await mount();
    await screen.findByText(/Faults are found at intake/);
    const card = document.querySelector('[data-slot="criterion-card"]') as HTMLElement;
    expect(card).toHaveTextContent(`${sk.tracked} Quality reviewer`);
    expect(card).toHaveTextContent(`${sk.confirmed} Depot network`);
  });

  it("removes a criterion", async () => {
    const user = userEvent.setup();
    await mount();
    await screen.findByText(/Faults are found at intake/);

    await user.click(screen.getAllByRole("button", { name: copy.projects.common.remove })[0]);
    expect(spec.successCriteria).toHaveLength(1);
  });
});

describe("the add dialog asks the five questions", () => {
  async function openAdd() {
    const user = userEvent.setup();
    await mount();
    await screen.findByText(/Faults are found at intake/);
    await user.click(screen.getAllByRole("button", { name: sk.add })[0]);
    await screen.findByText(dlg.addTitle);
    return user;
  }

  it("walks the outcome, the measure, the method, the tracker and the confirmer", async () => {
    await openAdd();
    // Read inside the dialog: the add button behind it is named by a noun
    // too ("+ Criterion").
    const dialog = screen.getByRole("dialog");
    for (const step of [dlg.step1, dlg.step2, dlg.step4, dlg.step5]) {
      expect(within(dialog).getByText(step)).toBeInTheDocument();
    }
    // Step three only applies once something is being measured.
    expect(screen.queryByText(dlg.step3)).toBeNull();
  });

  it("asks where and how often only for a measured criterion", async () => {
    const user = await openAdd();
    await user.click(screen.getByRole("radio", { name: new RegExp(sk.metric.business) }));
    expect(screen.getByText(dlg.step3)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: dlg.sourceLabel })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: dlg.cycleLabel })).toBeInTheDocument();
  });

  // Compliance is satisfied, not measured: a question that cannot apply
  // is not asked rather than shown greyed out.
  it("asks a compliance criterion nothing about measurement", async () => {
    const user = await openAdd();
    await user.click(screen.getByRole("radio", { name: new RegExp(sk.metric.compliance) }));
    expect(screen.queryByText(dlg.step3)).toBeNull();
    expect(screen.queryByLabelText(dlg.standardLabel)).toBeNull();
  });

  it("offers the project's own roles for both role questions", async () => {
    const user = await openAdd();
    await user.click(screen.getByRole("combobox", { name: dlg.confirmedByLabel }));
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    // Resources comes before this step, so the list is already filled;
    // naming one stays for the role nobody thought of until now.
    expect(options).toEqual(["Depot network", "Quality reviewer", copy.projects.common.nameRole]);
  });

  // The ordering fix on its own is not enough: a role thought of while
  // writing a criterion must not cost the criterion (Programme Lead,
  // 2026-09-27).
  it("names a role without leaving the criterion", async () => {
    const user = await openAdd();
    await user.type(screen.getByLabelText(dlg.step1), "The audit is signed off");
    await user.click(screen.getByRole("radio", { name: new RegExp(sk.metric.compliance) }));

    await user.click(screen.getByRole("combobox", { name: dlg.confirmedByLabel }));
    await user.click(await screen.findByRole("option", { name: copy.projects.common.nameRole }));
    // One field: which catalogue entry. Typing a name beside it was the
    // second way of saying the same thing, and it is gone.
    await user.click(screen.getByRole("combobox", { name: copy.projects.roleDialog.resourceLabel }));
    await user.click(await screen.findByRole("option", { name: "Programme board" }));
    await user.click(screen.getByRole("button", { name: copy.projects.common.add }));

    // Filed in Resources as a position, never a RACI letter.
    expect(spec.resources).toContainEqual({
      id: "programme-board",
      role: "teamMember",
      resource: "programme-board",
    });
    // And selected on the question that asked for it, with the
    // criterion still being written.
    expect(screen.getByRole("combobox", { name: dlg.confirmedByLabel })).toHaveTextContent("Programme board");
    expect(screen.getByDisplayValue("The audit is signed off")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: dlg.save }));
    expect(spec.successCriteria?.[2]).toMatchObject({
      confirmedBy: { local: "resources", id: "programme-board" },
    });
  });

  it("refuses a save that has no outcome, no metric or no confirmer", async () => {
    const user = await openAdd();
    await user.click(screen.getByRole("button", { name: dlg.save }));
    expect(spec.successCriteria).toHaveLength(2);
    expect(screen.getByText(dlg.addTitle)).toBeInTheDocument();
  });

  it("saves a compliance criterion from the three questions that apply", async () => {
    const user = await openAdd();
    await user.type(screen.getByLabelText(dlg.step1), "The audit is signed off");
    await user.click(screen.getByRole("radio", { name: new RegExp(sk.metric.compliance) }));
    await user.click(screen.getByRole("combobox", { name: dlg.confirmedByLabel }));
    await user.click(await screen.findByRole("option", { name: "Depot network" }));
    await user.click(screen.getByRole("button", { name: dlg.save }));

    expect(spec.successCriteria).toHaveLength(3);
    expect(spec.successCriteria?.[2]).toMatchObject({
      statement: "The audit is signed off",
      metric: "compliance",
      confirmedBy: { local: "resources", id: "sponsor" },
      when: "atClosing",
    });
    // Nothing measurement-shaped is stored on a line that is not measured.
    expect(spec.successCriteria?.[2]).not.toHaveProperty("standard");
    expect(spec.successCriteria?.[2]).not.toHaveProperty("source");
  });
});

describe("the standard picker", () => {
  // A standard is picked, not written: fixed words around a comparison, a
  // number and a unit, so there is no grammar for Cartograph to guess.
  it("reads a stored standard back into its parts", () => {
    expect(parseStandard("at least 85 percent")).toEqual({ comparison: "atLeast", value: "85", unit: "percent", words: "" });
    expect(parseStandard("Within 30 days")).toEqual({ comparison: "within", value: "30", unit: "days", words: "" });
    expect(parseStandard("in every cluster review")).toEqual({
      comparison: "words",
      value: "",
      unit: "",
      words: "in every cluster review",
    });
  });

  it("writes back exactly what was picked", () => {
    expect(composeStandard({ comparison: "atMost", value: "5", unit: "%", words: "" })).toBe("at most 5 %");
    expect(composeStandard({ comparison: "within", value: "", unit: "days", words: "" })).toBe("");
    expect(composeStandard({ comparison: "words", value: "", unit: "", words: " for every referral " })).toBe(
      "for every referral",
    );
    for (const stored of ["at least 85 percent", "exactly 3 assessments", "a median of one year earlier"]) {
      expect(composeStandard(parseStandard(stored))).toBe(stored);
    }
  });
});

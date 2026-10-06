/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parse } from "yaml";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { FinishDetails } from "../../FinishDetails";
import { StartProject } from "../StartProject";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useBlocker: () => undefined,
  Link: ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => <a {...(rest as object)}>{children}</a>,
}));

const sc = copy.start;
const outcome = { id: "faults", name: "Faults are found before dispatch", level: "outcome", children: [], keyResults: 0, aligned: {}, smart: {} };
const tree = { levels: ["Goal", "Objective", "Outcome"], nodes: [{ id: "g", name: "Raise quality", level: "goal", keyResults: 0, aligned: {}, smart: {}, children: [{ id: "o", name: "One standard", level: "objective", keyResults: 0, aligned: {}, smart: {}, children: [outcome] }] }] };

// A project starts in four questions on one page, each thing it names
// picked or named in place, and the graph stays a DAG: the project names
// what it chose, and nothing chosen names it.
describe("starting a project", () => {
  it("walks the questions and starts the project with what was chosen", async () => {
    const saveVersion = vi.fn(async () => ({ number: 1 }) as never);
    const saveWorking = vi.fn(async () => {});
    const client = fakeClient({
      list: async (kind: string) => (kind === "Project" ? [{ id: "train-depot-staff-on-one-checklist", name: "Taken" }] : []) as never,
      goalTree: async () => tree as never,
      relevant: async () => ({ available: false, matches: [] }),
      saveVersion,
      saveWorking,
      get: async (kind: string, id: string) => ({ version: { number: 1 }, manifest: { apiVersion: "cartograph/v1", kind, metadata: { id, name: id }, spec: {} } }) as never,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <StartProject />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(screen.getByText(sc.lead)).toBeInTheDocument();
    const next = () => screen.getByRole("button", { name: new RegExp(`${sc.next}|${sc.skip}`) });
    expect(next()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(sc.aboutQuestion), { target: { value: "Train depot staff on one checklist. So every depot checks alike." } });
    fireEvent.click(next());

    // A gap named in place, and chosen.
    expect(await screen.findByRole("heading", { name: sc.gapsQuestion })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(sc.nameNew(sc.words.gap)), { target: { value: "Depots check differently" } });
    fireEvent.click(screen.getByRole("button", { name: sc.add }));
    await waitFor(() => expect(saveVersion).toHaveBeenCalledTimes(1));
    expect(saveVersion.mock.calls[0].slice(0, 2)).toEqual(["Gap", "depots-check-differently"]);
    fireEvent.click(next());

    // An outcome from the tree.
    expect(await screen.findByRole("heading", { name: sc.goalsQuestion })).toBeInTheDocument();
    fireEvent.click(await screen.findByText("Faults are found before dispatch"));
    fireEvent.click(next());

    // Nobody chosen: skipped.
    expect(await screen.findByRole("heading", { name: sc.groupsQuestion })).toBeInTheDocument();
    expect(next()).toHaveTextContent(sc.skip);
    fireEvent.click(next());

    // The team is asked, not left for later; skipped here too.
    expect(await screen.findByRole("heading", { name: sc.teamQuestion })).toBeInTheDocument();
    fireEvent.click(next());

    // Details, before the name: the gap named in passing is filled in,
    // and closes the outcome chosen for the project.
    expect(await screen.findByText(sc.fillTitle)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Depots check differently" })).toBeInTheDocument();
    const done = screen.getByRole("button", { name: new RegExp(sc.fillDone) });
    expect(done).toBeDisabled();
    // A typo seen now is put right where it is seen.
    fireEvent.click(screen.getByRole("button", { name: /Depots check differently/ }));
    fireEvent.change(screen.getByLabelText(sc.editName), { target: { value: "Depots check differently from one another" } });
    fireEvent.keyDown(screen.getByLabelText(sc.editName), { key: "Enter" });
    fireEvent.change(screen.getByLabelText(sc.gapCurrent), { target: { value: "Each depot keeps its own checklist" } });
    fireEvent.change(screen.getByLabelText(sc.gapDesired), { target: { value: "Every depot checks against one standard" } });
    fireEvent.click(done);
    await waitFor(() => expect(saveVersion).toHaveBeenCalledTimes(2));
    const [gk, gid, gm] = saveVersion.mock.calls[1] as unknown as [string, string, { metadata: { name: string }; spec: Record<string, unknown> }];
    expect([gk, gid]).toEqual(["Gap", "depots-check-differently"]);
    expect(gm.metadata.name).toBe("Depots check differently from one another");
    expect(gm.spec).toMatchObject({ current: "Each depot keeps its own checklist", desired: "Every depot checks against one standard", outcomes: ["faults"] });

    // Then the name, which is the commit.
    expect(await screen.findByRole("heading", { name: sc.readyQuestion })).toBeInTheDocument();
    expect(saveWorking).not.toHaveBeenCalled();
    // What was named here reads apart from what was chosen: the gap named
    // in place is marked new, the outcome picked from the tree is not.
    expect(document.querySelector("[data-new]")?.textContent).toContain("depots-check-differently");
    expect(document.querySelectorAll("[data-new]")).toHaveLength(1);
    // The name is suggested from what it is about, written in as a value
    // to change: a hint inside the box read as filled when it was not.
    const nameField = screen.getByLabelText(sc.nameLabel);
    expect(nameField).toHaveValue("Train depot staff on one checklist");
    expect(nameField).not.toHaveAttribute("placeholder");
    expect(screen.getByRole("button", { name: new RegExp(sc.start) })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(sc.start) }));
    await waitFor(() => expect(saveWorking).toHaveBeenCalledTimes(1));
    const [kind, id, yaml] = saveWorking.mock.calls[0] as unknown as [string, string, string];
    expect([kind, id]).toEqual(["Project", "train-depot-staff-on-one-checklist-2"]);
    const doc = parse(yaml);
    expect(doc.spec.summary.about).toBe("Train depot staff on one checklist. So every depot checks alike.");
    expect(doc.spec.summary.problems[0].gaps).toEqual([{ gap: "depots-check-differently" }]);
    expect(doc.spec.alignment.goals).toEqual(["faults"]);
    expect(doc.spec.summary.beneficiaries).toEqual([]);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/projects/$id/initiation/goals", params: { id: "train-depot-staff-on-one-checklist-2" } }));
  });
});

// Where a record named in passing is first met in the walk, a friendly
// prompt asks for its details; a finished one is not mentioned.
describe("finishing what was named in passing", () => {
  // A new outcome is placed in the page, on the tree, and may go under an
  // objective not placed yet; what is not placed yet is listed to choose
  // from, so nothing named disappears (TAXONOMY.md D35).
  it("places a new outcome on the tree in the page, and lists what is not placed", async () => {
    const saveVersion = vi.fn(async () => ({ number: 1 }) as never);
    const loose = { id: "cut-loss", name: "Cut loss after picking", level: "objective", keyResults: 0, aligned: {}, smart: {}, children: [] };
    const kept = { id: "kept-cool", name: "Produce is kept cool", level: "outcome", keyResults: 0, aligned: {}, smart: {}, children: [] };
    const client = fakeClient({
      list: async () => [] as never,
      goalTree: async () => ({ ...tree, unplaced: [loose, kept] }) as never,
      relevant: async () => ({ available: false, matches: [] }),
      saveVersion,
      get: async (kind: string, id: string) => ({ version: { number: 1 }, manifest: { apiVersion: "cartograph/v1", kind, metadata: { id, name: id }, spec: {} } }) as never,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <StartProject />
        </QueryClientProvider>
      </ClientProvider>,
    );
    fireEvent.change(screen.getByLabelText(sc.aboutQuestion), { target: { value: "Keep produce cool from field to depot." } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`${sc.next}|${sc.skip}`) }));
    await screen.findByRole("heading", { name: sc.gapsQuestion });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`${sc.next}|${sc.skip}`) }));
    await screen.findByRole("heading", { name: sc.goalsQuestion });

    // The unplaced outcome is there to choose.
    expect(await screen.findByText("Produce is kept cool")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(sc.nameNew(sc.words.goal)), { target: { value: "Produce reaches a depot cold" } });
    fireEvent.click(screen.getByRole("button", { name: sc.add }));
    // In the page, not a dialog over it.
    expect(screen.queryByRole("dialog")).toBeNull();
    const picker = await screen.findByRole("tree");
    fireEvent.click(within(picker).getByRole("treeitem", { name: /Cut loss after picking/ }));
    fireEvent.click(screen.getByRole("button", { name: copy.goals.home.place.add }));
    await waitFor(() => expect(saveVersion).toHaveBeenCalledTimes(1));
    const m = saveVersion.mock.calls[0][2] as { spec: { level: string; parent?: string } };
    expect(m.spec).toMatchObject({ level: "outcome", parent: "cut-loss" });
  });

  // Walked again from its draft: every answer is filled in from it, and
  // leaving for the full page saves into the same draft, keeping all the
  // rest of it.
  it("walks a project again from its draft, and keeps the rest of it", async () => {
    const saveWorking = vi.fn(async () => {});
    const draft = {
      apiVersion: "cartograph/v1",
      kind: "Project",
      metadata: { id: "depot-checks", name: "Depot checks", alias: "depot-checks" },
      spec: {
        team: "quality",
        summary: { about: "One checklist in every depot.", beneficiaries: [{ group: "depot-staff", note: "kept" }], problems: [{ problem: { situation: "kept" }, change: {}, gaps: [{ gap: "checks-differ" }] }] },
        alignment: { goals: ["faults"] },
        timeline: { start: "2027-01" },
      },
    };
    const client = fakeClient({
      list: async () => [] as never,
      goalTree: async () => tree as never,
      relevant: async () => ({ available: false, matches: [] }),
      saveWorking,
      get: async () => ({ version: { number: 1 }, manifest: draft }) as never,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <StartProject from="depot-checks" />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText(sc.again)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(sc.aboutQuestion)).toHaveValue("One checklist in every depot."));
    fireEvent.change(screen.getByLabelText(sc.aboutQuestion), { target: { value: "One checklist, checked alike in every depot." } });
    fireEvent.click(screen.getByRole("button", { name: sc.toPage }));
    await waitFor(() => expect(saveWorking).toHaveBeenCalledTimes(1));
    const [kind, id, text] = saveWorking.mock.calls[0] as unknown as [string, string, string];
    expect([kind, id]).toEqual(["Project", "depot-checks"]);
    const saved = parse(text);
    expect(saved.metadata.name).toBe("Depot checks");
    expect(saved.spec.summary.about).toBe("One checklist, checked alike in every depot.");
    expect(saved.spec.summary.beneficiaries).toEqual([{ group: "depot-staff", note: "kept" }]);
    expect(saved.spec.summary.problems[0].problem).toEqual({ situation: "kept" });
    expect(saved.spec.summary.problems[0].gaps).toEqual([{ gap: "checks-differ" }]);
    expect(saved.spec.alignment.goals).toEqual(["faults"]);
    expect(saved.spec.timeline).toEqual({ start: "2027-01" });
    expect(navigate).toHaveBeenCalledWith({ to: "/projects/$id/initiation/goals", params: { id: "depot-checks" } });
  });

  it("asks only of the records still lacking what defines them", async () => {
    const client = fakeClient({
      get: async (_kind: string, id: string) =>
        ({ version: { number: 1 }, manifest: { metadata: { name: id === "bare" ? "Bare gap" : "Full gap" }, spec: id === "bare" ? { statement: "One fault in five is found" } : { current: "One fault in five is found", desired: "Most faults are found at intake" } } }) as never,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient()}>
          <FinishDetails kind="Gap" ids={["bare", "full"]} />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText(sc.finish("Bare gap"))).toBeInTheDocument();
    expect(screen.queryByText(sc.finish("Full gap"))).toBeNull();
  });
});

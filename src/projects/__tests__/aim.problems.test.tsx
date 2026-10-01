/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { AimSection } from "../sections/AimSection";
import { BeneficiariesSection } from "../sections/BeneficiariesSection";
import type { ProjectSpec } from "../types";

// A project may answer more than one problem, and one change may land
// differently on different groups (Programme Lead, 2026-09-27). These
// drive the real store with the API client faked at the module boundary.
vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const ac = copy.projects.aim;

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Project",
  metadata: { id: "p1", name: "Project one" },
  spec: {
    summary: {
      problems: [
        {
          problem: { situation: "wait a season", cause: "checks happen after dispatch" },
          change: { what: "checks run at intake", gain: "learn the same day" },
          groups: ["depot-staff"],
        },
        {
          problem: { situation: "Retail partners cannot trace a crate" },
          change: { what: "every crate carries one label" },
        },
      ],
      beneficiaries: [{ group: "depot-staff" }, { group: "retail-partners" }],
    },
    team: "t1",
  },
};

const groups = [
  { id: "depot-staff", name: "Depot staff" },
  { id: "retail-partners", name: "Retail partners" },
];

const get = vi.fn();
const list = vi.fn();
const saveWorking = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // The store loads the project through the generic manifest route
  // ("/manifests/{kind}/{id}"), not a Project-specific one.
  get.mockResolvedValue({ version: { number: 0 }, manifest, yaml: "" });
  list.mockResolvedValue(groups);
  saveWorking.mockResolvedValue(undefined);
});

let spec: ProjectSpec;

function Spy() {
  spec = useProjectStore().spec;
  return null;
}

async function mount(section: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ClientProvider client={fakeClient({ get, list, saveWorking, goalTree: async () => ({ levels: [], nodes: [] }) })}>
      <QueryClientProvider client={queryClient}>
        <ProjectStoreProvider id="p1">
          <Spy />
          {section}
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

function cards() {
  return Array.from(document.querySelectorAll('[data-slot="problem-card"]'));
}

describe("the aim step holds every problem the project answers", () => {
  it("shows one card per problem, each part as it was written", async () => {
    await mount(<AimSection />);
    await screen.findByText(/Retail partners cannot trace a crate/);

    expect(cards()).toHaveLength(2);
    expect(cards()[0]).toHaveTextContent("wait a season");
    expect(cards()[0]).toHaveTextContent("checks run at intake");
    // Parts are never glued into a sentence (TAXONOMY.md D19).
    expect(cards()[0]).not.toHaveTextContent(/because/);
    expect(cards()[1]).toHaveTextContent("Retail partners cannot trace a crate");
  });

  it("names the groups a problem is felt by, and says so when none is named", async () => {
    await mount(<AimSection />);
    await screen.findByText(/Retail partners cannot trace a crate/);

    expect(cards()[0]).toHaveTextContent("Depot staff");
    expect(cards()[1]).toHaveTextContent(ac.problemGroupsEmpty);
  });

  // Shut, a card is three lines; the eight-field editor only exists for
  // the one card being worked on, which is what keeps the step a screen.
  it("opens one card at a time", async () => {
    const user = userEvent.setup();
    await mount(<AimSection />);
    await screen.findByText(/Retail partners cannot trace a crate/);

    expect(within(cards()[0] as HTMLElement).getByRole("combobox", { name: ac.problemGroupsLabel })).toBeInTheDocument();
    expect(within(cards()[1] as HTMLElement).queryByRole("combobox", { name: ac.problemGroupsLabel })).toBeNull();

    await user.click(within(cards()[1] as HTMLElement).getByRole("button", { name: ac.expand }));

    expect(within(cards()[0] as HTMLElement).queryByRole("combobox", { name: ac.problemGroupsLabel })).toBeNull();
    expect(within(cards()[1] as HTMLElement).getByRole("combobox", { name: ac.problemGroupsLabel })).toBeInTheDocument();
  });

  it("adds and removes a pair", async () => {
    const user = userEvent.setup();
    await mount(<AimSection />);
    await screen.findByText(/Retail partners cannot trace a crate/);

    await user.click(screen.getByRole("button", { name: ac.addProblem }));
    expect(spec.summary.problems).toHaveLength(3);
    expect(spec.summary.problems[2]).toEqual({ problem: {}, change: {} });

    await user.click(screen.getAllByRole("button", { name: ac.removeProblem })[2]);
    expect(spec.summary.problems).toHaveLength(2);
  });

  // The subject of both sentences is the group list, so changing the list
  // has to rewrite them. Without this the statement keeps naming whoever
  // was picked first, which is how a problem ends up stated about the
  // wrong people.
  it("names the groups on the card without rewriting any part", async () => {
    const user = userEvent.setup();
    await mount(<AimSection />);
    await screen.findByText(/Retail partners cannot trace a crate/);

    const picker = within(cards()[0] as HTMLElement).getByRole("combobox", { name: ac.problemGroupsLabel });
    await user.click(picker);
    await user.click(await screen.findByRole("option", { name: /Retail partners/ }));

    expect(spec.summary.problems[0].groups).toEqual(["depot-staff", "retail-partners"]);
    // Nothing anybody wrote is rewritten: the subject is composed from
    // the groups when the sentence is read, so changing them changes only
    // what the card shows.
    expect(spec.summary.problems[0].problem).toEqual({
      situation: "wait a season",
      cause: "checks happen after dispatch",
    });
    expect(cards()[0]).toHaveTextContent("Depot staff, Retail partners");
  });

  // Only groups the project already named are offered: a problem felt by
  // somebody nobody listed is a beneficiary nobody listed.
  it("offers only the project's own beneficiary groups", async () => {
    const user = userEvent.setup();
    await mount(<AimSection />);
    await screen.findByText(/Retail partners cannot trace a crate/);

    await user.click(within(cards()[0] as HTMLElement).getByRole("combobox", { name: ac.problemGroupsLabel }));
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(options).toEqual(["Depot staff", "Retail partners"]);
  });
});

describe("the beneficiaries step says what the word means", () => {
  it("leads with the definition, before the register", async () => {
    await mount(<BeneficiariesSection />);
    // The hint is now behind the Help button (card L1, 2026-09-29).
    // It still exists in the copy and contains the word "indirectly".
    // Indirect gain is the half the word kept losing.
    expect(copy.projects.beneficiaries.hint).toMatch(/indirectly/);
    // A definition, not a paragraph.
    expect(copy.projects.beneficiaries.hint.length).toBeLessThan(80);
  });
});

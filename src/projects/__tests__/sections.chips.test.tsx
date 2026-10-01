/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { client } from "@/api/client";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { AlignmentSection, MeasuresSection } from "../sections/GoalsSection";
import { BeneficiariesSection } from "../sections/BeneficiariesSection";

// The two steps the Programme Lead rewrote on 2026-09-26: Align picks
// goals as chips (no tree, no drop zone), Beneficiaries picks groups as
// chips (no counts at all). Both are driven against the real store with
// the API client faked at the module boundary.
vi.mock("@/api/client");
vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Project",
  metadata: { id: "p1", name: "Project one" },
  spec: { summary: { problem: "A problem", change: "A change" }, team: "t1" },
};

const tree = {
  levels: ["Pillar", "Strategic", "Functional"],
  nodes: [
    {
      id: "pillar-1",
      name: "Service Quality",
      level: "goal",
      keyResults: 0,
      children: [
        {
          id: "strategic-1",
          name: "Operational efficiency",
          level: "objective",
          keyResults: 0,
          children: [
            { id: "functional-1", name: "Implement process automation", level: "outcome", keyResults: 2, children: [] },
          ],
        },
        {
          id: "strategic-2",
          name: "Stakeholder engagement",
          level: "objective",
          keyResults: 0,
          children: [
            { id: "functional-2", name: "Establish feedback mechanisms", level: "outcome", keyResults: 0, children: [] },
          ],
        },
      ],
    },
  ],
};

const kpis = [{ id: "quality-pass-rate", name: "Quality pass rate" }];

const groups = [
  { id: "delivering-members", name: "Delivering members" },
  { id: "depot-staff", name: "Depot staff" },
];

const mocked = vi.mocked(client);

function route(url: string, kind?: string) {
  if (url === "/manifests/Project/{id}") {
    return { data: { version: { number: 0 }, manifest, yaml: "" } };
  }
  if (url === "/goals/tree") return { data: tree };
  if (url === "/manifests/{kind}") return { data: { items: kind === "KPI" ? kpis : groups } };
  return { data: { items: [] } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.GET.mockImplementation((async (url: string, init?: { params?: { path?: { kind?: string } } }) => ({
    ...route(url, init?.params?.path?.kind),
    error: undefined,
    response: new Response(null, { status: 200 }),
  })) as never);
  mocked.PUT.mockResolvedValue({
    data: undefined,
    error: undefined,
    response: new Response(null, { status: 204 }),
  } as never);
});

let spec: Record<string, unknown> = {};

function Spy() {
  spec = useProjectStore().spec as unknown as Record<string, unknown>;
  return null;
}

async function mount(section: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ProjectStoreProvider id="p1">
        <Spy />
        {section}
      </ProjectStoreProvider>
    </QueryClientProvider>,
  );
}

describe("Alignment picks goals as chips", () => {
  it("offers one chip per functional goal, carrying its own name only", async () => {
    await mount(<AlignmentSection />);
    const chip = await screen.findByRole("button", { name: /Implement process automation/ });
    expect(chip).toHaveAttribute("data-chip-id", "functional-1");
    // The ancestry is a heading above the chip, not a word repeated on it.
    expect(chip).not.toHaveTextContent("Operational efficiency");
    expect(await screen.findByRole("button", { name: /Establish feedback mechanisms/ })).toBeInTheDocument();
  });

  it("groups the chips under their pillar and their strategic area", async () => {
    await mount(<AlignmentSection />);
    await screen.findByRole("button", { name: /Implement process automation/ });

    const pillar = screen.getByRole("heading", { name: "Service Quality" });
    const group = pillar.closest('[data-slot="chip-group"]');
    expect(group).toBeInTheDocument();

    const areas = Array.from(group!.querySelectorAll('[data-slot="chip-area"]'));
    expect(areas.map((a) => a.querySelector("p")?.textContent)).toEqual([
      "Operational efficiency",
      "Stakeholder engagement",
    ]);
    // Each goal sits inside the area it belongs to, not beside it.
    expect(areas[0]).toHaveTextContent("Implement process automation");
    expect(areas[1]).toHaveTextContent("Establish feedback mechanisms");
  });

  it("neither pillar nor area is pickable, only the goals under them", async () => {
    await mount(<AlignmentSection />);
    await screen.findByRole("button", { name: /Implement process automation/ });
    expect(screen.queryByRole("button", { name: "Service Quality" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Operational efficiency" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").filter((b) => b.hasAttribute("data-chip-id"))).toHaveLength(2);
  });

  it("writes the goal to the spec on a click, and takes it back on a second", async () => {
    const user = userEvent.setup();
    await mount(<AlignmentSection />);
    const chip = await screen.findByRole("button", { name: /Implement process automation/ });

    await user.click(chip);
    expect((spec.alignment as { goals: string[] }).goals).toEqual(["functional-1"]);

    await user.click(screen.getByRole("button", { name: /Implement process automation/ }));
    expect((spec.alignment as { goals: string[] }).goals).toEqual([]);
  });
});

describe("Beneficiaries picks groups as chips, and counts nothing", () => {
  it("offers one chip per group in the register", async () => {
    await mount(<BeneficiariesSection />);
    expect(await screen.findByRole("button", { name: /Delivering members/ })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Depot staff/ })).toBeInTheDocument();
  });

  it("stores a line holding a group and nothing else", async () => {
    const user = userEvent.setup();
    await mount(<BeneficiariesSection />);
    await user.click(await screen.findByRole("button", { name: /Depot staff/ }));

    const lines = (spec.summary as { beneficiaries: Record<string, unknown>[] }).beneficiaries;
    expect(lines).toEqual([{ group: "depot-staff" }]);
  });

  it("shows no count, basis or reason control", async () => {
    await mount(<BeneficiariesSection />);
    await screen.findByRole("button", { name: /Depot staff/ });
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    for (const word of ["How many", "Basis", "Not known yet"]) {
      expect(screen.queryByText(word)).not.toBeInTheDocument();
    }
  });
});

// The KPI half of Measures had no test at all, and a KPI can only attach
// to a key result: with none named, its search and every Add button beside
// it were rendered and disabled, which is what "cannot apply a key result"
// looks like from the outside.
describe("Measures does not render dead controls", () => {
  it("offers no KPI search or Add while no key result is named", async () => {
    await mount(<MeasuresSection />);
    await screen.findByText(copy.projects.goals.kpiTitle);
    expect(screen.queryByPlaceholderText(copy.projects.goals.kpiSearchPlaceholder)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.projects.goals.browseAll })).not.toBeInTheDocument();
    // What is missing is named once, where the KPIs would be.
    expect(screen.getAllByText(copy.projects.goals.keyResultsEmpty).length).toBeGreaterThan(0);
  });

  it("has no disabled button anywhere on the step", async () => {
    await mount(<MeasuresSection />);
    await screen.findByText(copy.projects.goals.kpiTitle);
    const dead = screen.getAllByRole("button").filter((b) => (b as HTMLButtonElement).disabled);
    expect(dead).toEqual([]);
  });
});

// A goal is what a whole project aligns to, so it is a row with its own
// mark, not a chip in a wrap (Programme Lead, 2026-09-26).
describe("Alignment gives a goal the weight of a commitment", () => {
  it("renders each goal as a full-width row carrying its own mark", async () => {
    await mount(<AlignmentSection />);
    const row = await screen.findByRole("button", { name: /Implement process automation/ });
    expect(row.className).toContain("w-full");
    expect(row.querySelector("span[aria-hidden]")).toBeInTheDocument();
  });

  it("counts the goals picked in a branch, beside that branch's name", async () => {
    const user = userEvent.setup();
    await mount(<AlignmentSection />);
    const row = await screen.findByRole("button", { name: /Implement process automation/ });

    expect(document.querySelector('[data-slot="chip-group-count"]')).not.toBeInTheDocument();
    await user.click(row);
    expect(document.querySelector('[data-slot="chip-group-count"]')?.textContent).toBe("1");
  });
});

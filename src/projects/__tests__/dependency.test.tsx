/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { RisksSection } from "../sections/RisksSection";
import { retypeRisk, type ProjectSpec, type Risk } from "../types";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const rc = copy.projects.risks;

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Project",
  metadata: { id: "p1", name: "Project one" },
  spec: {
    summary: { problems: [{ problem: "A gap", change: "No gap" }] },
    team: "t1",
    timeline: {
      start: "2026-01",
      phases: [
        { id: "design", name: "Design", months: 3 },
        { id: "rollout", name: "Rollout", months: 6 },
      ],
    },
    risks: [
      {
        id: "r-1",
        description: "The feed must carry the new field",
        type: "dependency",
        depends: { direction: "needs", on: { kind: "DataSource", id: "emis" } },
      },
      { id: "r-2", description: "The vendor may be late", type: "risk" },
    ],
  },
};

const get = vi.fn();
const list = vi.fn();
const saveWorking = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Radix marks the rest of the document while a Select is open and
  // clears it on close. A test that ends with one just closed leaves the
  // marks behind on the shared jsdom document, and the next test's picker
  // is then invisible to the accessibility tree.
  document.body.style.pointerEvents = "";
  for (const el of document.querySelectorAll("[aria-hidden='true']")) {
    el.removeAttribute("aria-hidden");
  }
  get.mockResolvedValue({ version: { number: 0 }, manifest, yaml: "" });
  list.mockResolvedValue([{ id: "emis", name: "EMIS" }]);
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
        <TooltipProvider>
          <ProjectStoreProvider id="p1">
            <Spy />
            <RisksSection />
          </ProjectStoreProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
  return userEvent.setup();
}

// A dependency is the one risk type that points at something, and the
// pointing is the whole reason the type exists: without it every
// dependency in both vaults was a risk sentence filed under the wrong
// word. The editor is what makes the shape reachable.
describe("only a dependency carries an edge", () => {
  it("offers the edge on a dependency and nowhere else", async () => {
    await mount();
    await screen.findByDisplayValue("The feed must carry the new field");
    // One edge editor, for the one dependency row.
    // Note: Help components may appear alongside the controls, so we check for at least 1
    const kindControls = screen.queryAllByLabelText(rc.dependsKindLabel);
    const directionControls = screen.queryAllByLabelText(rc.dependsDirectionLabel);
    // Filter to only form controls, not Help buttons
    const kindFormControls = kindControls.filter((el) => !el.classList.contains("text-muted-foreground"));
    const directionFormControls = directionControls.filter((el) => !el.classList.contains("text-muted-foreground"));
    expect(kindFormControls.length).toBeGreaterThan(0);
    expect(directionFormControls.length).toBeGreaterThan(0);
  });




  // Direction is declared at one end only, so the far end can show
  // "waiting on you" without anyone writing the other half.
  it("keeps the direction the declaring end chose", async () => {
    const user = await mount();
    await screen.findByDisplayValue("The feed must carry the new field");

    await user.click(screen.getByRole("radio", { name: rc.direction["neededBy"] }));
    expect(spec.risks?.[0].depends?.direction).toBe("neededBy");
  });
});

// The rules a jsdom Select cannot be driven through, tested where they
// live. Radix's Select opens on the first one a file touches and stays
// shut for every one after; the rules themselves are not UI, so they do
// not need one.
describe("retyping a row takes its edge with it", () => {
  const dependency: Risk = {
    id: "r-1",
    description: "The feed must carry the new field",
    type: "dependency",
    depends: { direction: "needs", on: { kind: "DataSource", id: "emis" } },
  };

  it("drops the edge when the row is no longer a dependency", () => {
    const next = retypeRisk(dependency, "risk");
    expect(next.type).toBe("risk");
    expect(next.depends).toBeUndefined();
    expect("depends" in next).toBe(false);
  });

  it("keeps the edge while it is still a dependency", () => {
    expect(retypeRisk(dependency, "dependency").depends).toEqual(dependency.depends);
  });

  it("leaves everything else alone", () => {
    const next = retypeRisk(dependency, "constraint");
    expect(next.id).toBe("r-1");
    expect(next.description).toBe("The feed must carry the new field");
  });
});

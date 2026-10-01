/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parse as parseYAML } from "yaml";

import { client } from "@/api/client";
import { copy } from "@/copy";
import { DefinitionStoreProvider, useDefinitionStore } from "@/definition/store";
import { ComponentsSection } from "../sections/ComponentsSection";
import { blankProgrammeSpec, type ProgrammeSpec } from "../types";

vi.mock("@/api/client");
vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const pc = copy.programmes;
const mocked = vi.mocked(client);

const programme = {
  metadata: { id: "prog-1", name: "A programme" },
  spec: { name: "A programme", aim: "Better things", goals: ["g-shared"] },
};

/** Two projects and an operation: one names this programme and shares a
 * goal, one names it and shares nothing, one shares a goal without naming
 * it, and the operation names it. */
const work: Record<string, { id: string; spec: Record<string, unknown> }[]> = {
  Project: [
    { id: "p-inside", spec: { alignment: { programmes: ["prog-1"], goals: ["g-shared"] } } },
    { id: "p-unserved", spec: { alignment: { programmes: ["prog-1"], goals: ["g-other"] } } },
    { id: "p-candidate", spec: { alignment: { programmes: [], goals: ["g-shared"] } } },
  ],
  Operation: [{ id: "o-inside", spec: { programmes: ["prog-1"] } }],
};
const names: Record<string, string> = {
  "p-inside": "Inside project",
  "p-unserved": "Unserved project",
  "p-candidate": "Candidate project",
  "o-inside": "Inside operation",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.GET.mockImplementation((async (
    url: string,
    init?: { params?: { path?: { kind?: string; id?: string } } },
  ) => {
    const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });
    const kind = init?.params?.path?.kind;
    const id = init?.params?.path?.id;
    if (url === "/manifests/{kind}" && kind) {
      return ok((work[kind] ?? []).map((w) => ({ id: w.id, name: names[w.id] })));
    }
    if (url === "/manifests/{kind}/{id}") {
      if (kind === "Programme") return ok({ version: { number: 1 }, manifest: programme });
      const row = (work[kind ?? ""] ?? []).find((w) => w.id === id);
      return row ? ok({ version: { number: 1 }, manifest: { spec: row.spec } }) : ok({});
    }
    return ok({ items: [] });
  }) as never);
  mocked.PUT.mockResolvedValue({
    data: undefined,
    error: undefined,
    response: new Response(null, { status: 204 }),
  } as never);
});

let api: ReturnType<typeof useDefinitionStore<ProgrammeSpec>> | null = null;
function Probe() {
  api = useDefinitionStore<ProgrammeSpec>();
  return null;
}

async function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DefinitionStoreProvider kind="Programme" id="prog-1" blank={blankProgrammeSpec}>
        <Probe />
        <ComponentsSection />
      </DefinitionStoreProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("Inside project");
}

// A programme coordinates the work inside it, and the work is what declares
// that: membership is read back, never stored on the programme, so there is
// one place to change it (TAXONOMY.md D1).
describe("a programme reads its members back from the work", () => {
  it("lists the projects and operations that name it", async () => {
    await mount();
    expect(await screen.findByText("Inside project")).toBeInTheDocument();
    expect(await screen.findByText("Inside operation")).toBeInTheDocument();
    // Named it, but shares no goal: shown under its own heading rather
    // than refused, because an enabling component legitimately can.
    expect(await screen.findByText("Unserved project")).toBeInTheDocument();
  });

  it("offers the work that shares a goal without naming it", async () => {
    await mount();
    expect(await screen.findByText("Candidate project")).toBeInTheDocument();
  });

  // The whole point of reading it back: nothing on the programme says who
  // is inside it, so nothing here may write that.
  it("never writes members onto the programme", async () => {
    await mount();
    await screen.findByText("Inside project");
    await act(async () => {
      await api?.flushNow();
    });
    for (const call of mocked.PUT.mock.calls as unknown as [string, { body: { yaml: string } }][]) {
      const written = parseYAML(call[1].body.yaml) as { spec?: Record<string, unknown> };
      expect(written.spec).not.toHaveProperty("projects");
      expect(written.spec).not.toHaveProperty("operations");
    }
  });

  // Adopting is the one write this screen makes, and it writes goals.
  it("adopts a member's goals onto the programme, and nothing else", async () => {
    await mount();
    await screen.findByText("Unserved project");
    act(() => {
      api?.updateSpec((s) => ({ ...s, goals: [...(s.goals ?? []), "g-other"] }));
    });
    expect(api?.spec.goals).toEqual(["g-shared", "g-other"]);
  });
});

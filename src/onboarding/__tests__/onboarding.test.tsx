/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { Onboarding } from "../Onboarding";
import { onboarded } from "../firstRun";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const oc = copy.onboarding;

const guide = (kind: string, level?: string) =>
  ({
    kind,
    locale: "en",
    definition: `${kind} is defined here.`,
    levelIs: level ? `A ${level} is defined here.` : undefined,
    existing: [],
    template: {},
    steps: [{ key: "s", title: "s", fields: [{ path: "/spec/vision", control: "sentence", guide: "The future it works towards." }] }],
  }) as never;

beforeEach(() => {
  navigate.mockReset();
  localStorage.clear();
});

// A new workspace is opened one question at a time, top-down: the
// organisation, its vision and mission read back to change or keep, then
// goals, one refined into objectives and outcomes, each saved as it is
// given, and a map of it all with the way in (engine TAXONOMY.md D37).
describe("opening a new workspace", () => {
  it("walks from the organisation's name to its first outcomes, and ends on the map", async () => {
    const saveVersion = vi.fn(async () => ({ number: 1 }) as never);
    const client = fakeClient({
      settings: async () => ({ goalLevels: ["Goal", "Objective", "Outcome"] }) as never,
      get: async () => {
        throw new Error("not found");
      },
      getGuide: async (kind: string, opts?: { level?: string }) => guide(kind, opts?.level),
      saveVersion,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Onboarding />
        </QueryClientProvider>
      </ClientProvider>,
    );
    const next = () => screen.getByRole("button", { name: oc.next });

    expect(screen.getByRole("heading", { name: oc.nameQuestion })).toBeInTheDocument();
    expect(next()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(oc.nameLabel), { target: { value: "Riverside Growers" } });
    fireEvent.click(next());

    // Named from here on, and each thing asked for is defined beside it.
    expect(await screen.findByRole("heading", { name: oc.visionQuestion("Riverside Growers") })).toBeInTheDocument();
    expect(await screen.findByText("The future it works towards.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(oc.terms.vision), { target: { value: "Every member earns a fair living." } });
    fireEvent.click(next());
    await screen.findByRole("heading", { name: oc.missionQuestion("Riverside Growers") });
    fireEvent.click(next());

    // Read back, each open to change; the mission was skipped.
    await screen.findByRole("heading", { name: oc.reviewQuestion("Riverside Growers") });
    expect(screen.getByText(oc.notYet)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: oc.change })).toHaveLength(3);
    fireEvent.click(next());
    await waitFor(() => expect(saveVersion).toHaveBeenCalledTimes(1));
    expect(saveVersion.mock.calls[0].slice(0, 2)).toEqual(["Purpose", "default"]);
    expect((saveVersion.mock.calls[0][2] as { spec: object }).spec).toEqual({ organisation: "Riverside Growers", vision: "Every member earns a fair living." });

    // How it gets there: two goals, one refined.
    expect(await screen.findByRole("heading", { name: oc.goalsQuestion })).toBeInTheDocument();
    expect(screen.getByText("Every member earns a fair living.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(oc.goalLabel(1)), { target: { value: "Raise produce quality" } });
    fireEvent.click(screen.getByRole("button", { name: oc.addGoal }));
    fireEvent.change(screen.getByLabelText(oc.goalLabel(2)), { target: { value: "Widen members' access to buyers" } });
    fireEvent.click(next());
    await screen.findByRole("heading", { name: oc.pickQuestion(2) });
    // Each goal under an id of its own, never its name's.
    expect(saveVersion.mock.calls.slice(1).map((c) => [c[0], c[1]])).toEqual([
      ["Goal", expect.stringMatching(/^goal-[0-9a-f]{8}$/)],
      ["Goal", expect.stringMatching(/^goal-[0-9a-f]{8}$/)],
    ]);
    fireEvent.click(screen.getByRole("radio", { name: "Widen members' access to buyers" }));
    fireEvent.click(next());

    await screen.findByRole("heading", { name: oc.aimQuestion("Widen members' access to buyers") });
    fireEvent.click(next());
    await screen.findByRole("heading", { name: oc.objectivesQuestion("Widen members' access to buyers") });
    fireEvent.change(screen.getByLabelText(oc.objectiveLabel(1)), { target: { value: "Sell through two new buyers" } });
    fireEvent.click(next());
    await screen.findByRole("heading", { name: oc.outcomesQuestion("Sell through two new buyers") });
    const objectiveSaved = saveVersion.mock.calls.at(-1)?.[2] as { spec: { level: string; parent: string } };
    // Under the goal chosen: the second goal named, by the id it was given.
    const widen = saveVersion.mock.calls[2][1] as unknown as string;
    expect(objectiveSaved.spec).toMatchObject({ level: "objective", parent: widen });
    fireEvent.change(screen.getByLabelText(oc.outcomeLabel(1)), { target: { value: "Members have a second buyer" } });
    fireEvent.click(next());

    // The map, and the way in.
    expect(await screen.findByRole("heading", { name: oc.mapTitle("Riverside Growers") })).toBeInTheDocument();
    expect(screen.getByText("Members have a second buyer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: oc.begin }));
    expect(onboarded()).toBe(true);
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});

// A workspace already set up has no walk to open: /welcome goes Home
// (#127).
describe("the welcome walk on a set-up workspace", () => {
  it("sends the person Home", async () => {
    const client = fakeClient({
      settings: async () => ({ goalLevels: ["Goal", "Objective", "Outcome"], purpose: { organisation: "Riverside Growers" } }) as never,
      goalTree: async () => ({ levels: [], nodes: [{ id: "g1", name: "Goal", level: "goal", children: [] }], unplaced: [] }) as never,
      get: async () => {
        throw new Error("not found");
      },
      getGuide: async (kind: string, opts?: { level?: string }) => guide(kind, opts?.level),
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Onboarding />
        </QueryClientProvider>
      </ClientProvider>,
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/", replace: true }));
  });
});

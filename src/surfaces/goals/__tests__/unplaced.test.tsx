/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { GoalTree } from "@/client/port";
import { copy } from "@/copy";
import { moveGoal } from "../mutations";
import { Unplaced } from "../Unplaced";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a> }));

const node = (id: string, name: string, level: string, children: GoalTree["nodes"] = []) =>
  ({ id, name, level, children, keyResults: 0, aligned: {}, smart: {} }) as unknown as GoalTree["nodes"][number];

// What was defined before what it sits under is listed apart, with a way
// to place it; placing it ends the placeholder (TAXONOMY.md D35).
describe("unplaced goals", () => {
  it("are listed apart, with where they could go", () => {
    const tree = { levels: ["Goal", "Objective", "Outcome"], nodes: [node("g", "Raise quality", "goal", [node("o", "One standard", "objective")])], unplaced: [node("cool", "Produce is kept cool", "outcome")] };
    render(
      <ClientProvider client={fakeClient({})}>
        <QueryClientProvider client={new QueryClient()}>
          <Unplaced tree={tree as GoalTree} />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(screen.getByRole("heading", { name: copy.goals.home.unplaced.title })).toBeInTheDocument();
    expect(screen.getByText("Produce is kept cool")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: copy.goals.home.unplaced.place("Objective") })).toBeInTheDocument();
  });

  it("placing one saves its parent and drops the placeholder", async () => {
    const saveVersion = vi.fn(async () => ({ number: 2 }) as never);
    const client = fakeClient({
      get: async () =>
        ({ version: { number: 1 }, manifest: { apiVersion: "cartograph/v1", kind: "Goal", metadata: { id: "cool", name: "Produce is kept cool", pending: [{ path: "/spec/parent", kind: "Goal", name: "Not placed yet" }] }, spec: { level: "outcome" } } }) as never,
      saveVersion,
    });
    expect((await moveGoal(client, "cool", "o")).ok).toBe(true);
    await waitFor(() => expect(saveVersion).toHaveBeenCalledTimes(1));
    const m = saveVersion.mock.calls[0][2] as { metadata: { pending?: unknown }; spec: { parent: string } };
    expect(m.spec.parent).toBe("o");
    expect(m.metadata.pending).toBeUndefined();
  });
});

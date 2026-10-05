import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { GoalTree } from "@/client/port";
import { copy } from "@/copy";
import { PlaceGoal } from "../PlaceGoal";

const pc = copy.goals.home.place;

function node(id: string, name: string, level: string, children: GoalTree["nodes"] = []): GoalTree["nodes"][number] {
  return {
    id,
    name,
    level,
    keyResults: 0,
    children,
    aligned: {} as GoalTree["nodes"][number]["aligned"],
    smart: { specific: false, measurable: false, attainable: false, relevant: false, timeBound: false },
  };
}

function mount(level: "goal" | "objective" | "outcome", name: string, tree: GoalTree) {
  const saveVersion = vi.fn(async () => ({}) as never);
  const onDone = vi.fn();
  render(
    <ClientProvider client={fakeClient({ saveVersion })}>
      <QueryClientProvider client={new QueryClient()}>
        <PlaceGoal level={level} name={name} tree={tree} onDone={onDone} />
      </QueryClientProvider>
    </ClientProvider>,
  );
  return { saveVersion, onDone };
}

const saved = (call: unknown[]) => {
  const m = call[2] as { metadata: { id: string; name: string }; spec: { level: string; parent?: string } };
  return { id: m.metadata.id, name: m.metadata.name, level: m.spec.level, parent: m.spec.parent };
};

// A goal arriving from the home page is placed where the tree needs it,
// and where its parent does not exist yet, the parent comes first, in the
// order of work (TAXONOMY.md D28).
describe("placing a goal from the home page", () => {
  it("adds the parent first when there is none, then the one typed under it", async () => {
    const { saveVersion, onDone } = mount("outcome", "Depot staff apply the standard alike", {
      levels: ["Goal", "Objective", "Outcome"],
      nodes: [node("raise-produce-quality", "Raise produce quality", "goal")],
    });
    expect(screen.getByText(pc.none("Outcome", "Objective"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: pc.first("Objective") }));
    expect(screen.getByText(pc.then("Depot staff apply the standard alike", "Objective"))).toBeTruthy();

    fireEvent.change(screen.getByLabelText(pc.name), { target: { value: "Hold every depot to one standard" } });
    fireEvent.click(screen.getByRole("button", { name: pc.add }));
    await waitFor(() => expect(saveVersion).toHaveBeenCalledTimes(1));
    // The only goal there is: the objective goes under it.
    expect(saved(saveVersion.mock.calls[0])).toEqual({ id: "hold-every-depot-to-one-standard", name: "Hold every depot to one standard", level: "objective", parent: "raise-produce-quality" });

    // Then the outcome the person came with, under the new objective.
    await screen.findByText(pc.title("Outcome"));
    expect((screen.getByLabelText(pc.name) as HTMLInputElement).value).toBe("Depot staff apply the standard alike");
    fireEvent.click(screen.getByRole("button", { name: pc.add }));
    await waitFor(() => expect(saveVersion).toHaveBeenCalledTimes(2));
    expect(saved(saveVersion.mock.calls[1])).toEqual({ id: "depot-staff-apply-the-standard-alike", name: "Depot staff apply the standard alike", level: "outcome", parent: "hold-every-depot-to-one-standard" });
    expect(onDone).toHaveBeenCalledWith("depot-staff-apply-the-standard-alike");
  });

  it("lets the person change the level the model offered", async () => {
    const { saveVersion } = mount("objective", "Raise produce quality", { levels: ["Goal", "Objective", "Outcome"], nodes: [] });
    fireEvent.click(screen.getByRole("radio", { name: "Goal" }));
    expect(screen.getByText(pc.title("Goal"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: pc.add }));
    await waitFor(() => expect(saveVersion).toHaveBeenCalledTimes(1));
    expect(saved(saveVersion.mock.calls[0]).level).toBe("goal");
  });

  it("adds a goal at the top, with nothing to choose", async () => {
    const { saveVersion, onDone } = mount("goal", "Raise produce quality", { levels: ["Goal", "Objective", "Outcome"], nodes: [] });
    fireEvent.click(screen.getByRole("button", { name: pc.add }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("raise-produce-quality"));
    expect(saved(saveVersion.mock.calls[0]).parent).toBeUndefined();
  });

  it("leaves an outcome unplaced, its parent's place held, when nothing fits yet", async () => {
    const { saveVersion, onDone } = mount("outcome", "Produce is kept cool", { levels: ["Goal", "Objective", "Outcome"], nodes: [] });
    fireEvent.click(screen.getByRole("button", { name: pc.leaveUnplaced }));
    fireEvent.change(screen.getByLabelText(pc.unplacedUnder("Objective")), { target: { value: "Cut loss after picking" } });
    fireEvent.click(screen.getByRole("button", { name: pc.add }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("produce-is-kept-cool"));
    const m = saveVersion.mock.calls[0][2] as { metadata: { pending?: unknown[] }; spec: { parent?: string } };
    expect(m.spec.parent).toBeUndefined();
    expect(m.metadata.pending).toEqual([{ path: "/spec/parent", kind: "Goal", name: "Cut loss after picking" }]);
  });
});

/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider } from "../store";
import { TimingField } from "../TimingField";
import type { Timing } from "../types";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));

const tc = copy.projects.timing;
let timing: Timing | undefined;

function Field({ start }: { start: Timing }) {
  const [value, setValue] = useState<Timing | undefined>(start);
  timing = value;
  return <TimingField value={value} onChange={setValue} field="/spec/deliverables/0/due" label="Due" />;
}

function mount(start: Timing) {
  const project = {
    apiVersion: "cartograph/v1",
    kind: "Project",
    metadata: { id: "p1", name: "Depot checks" },
    spec: {
      team: "t1",
      summary: {},
      milestones: [{ id: "m1", name: "Pilot starts", timing: { form: "date", date: "2026-10" } }],
      risks: [
        { id: "r1", description: "Graders are not trained in time", type: "risk" },
        { id: "r2", description: "The scales arrive late", type: "risk" },
      ],
    },
  };
  render(
    <ClientProvider client={fakeClient({ get: async () => ({ version: { number: 0 }, manifest: project, yaml: "" }) as never, list: async () => [] as never, saveWorking: async () => undefined, schedule: async () => [] as never })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProjectStoreProvider id="p1">
          <Field start={start} />
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

// A timing names the risks that could move it, recorded and never
// simulated, with days of lag and a note (engine TAXONOMY.md D47).
describe("what could move a timing", () => {
  it("names the project's risks, a lag in days and a note", async () => {
    mount({ form: "after", event: { on: { local: "milestones", id: "m1" } }, lagMonths: 1 });
    fireEvent.click(await screen.findByRole("checkbox", { name: "The scales arrive late" }));
    expect(timing?.risks).toEqual(["r2"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Graders are not trained in time" }));
    expect(timing?.risks).toEqual(["r1", "r2"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "The scales arrive late" }));
    expect(timing?.risks).toEqual(["r1"]);
    fireEvent.change(screen.getByLabelText(tc.lagDaysLabel), { target: { value: "10" } });
    expect(timing?.lagDays).toBe(10);
    fireEvent.change(screen.getByLabelText(tc.noteLabel), { target: { value: "Training dates are not fixed" } });
    expect(timing).toMatchObject({ form: "after", lagMonths: 1, lagDays: 10, risks: ["r1"], note: "Training dates are not fixed" });
  });
});

// A deliverable due after a milestone the plan has not made yet makes it
// here, named in place, so nothing waits for a later step (#39).
describe("a milestone made from a deliverable", () => {
  it("makes the milestone in the plan and waits on it", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    mount({ form: "after" });
    await user.click(await screen.findByRole("combobox", { name: tc.waitsOn }));
    await user.click(await screen.findByRole("option", { name: tc.newMilestone }));
    expect(timing?.event?.on).toEqual({ local: "milestones", id: "m2" });
    const name = await screen.findByRole("textbox", { name: tc.newMilestoneName });
    await user.type(name, "Training done");
    expect(name).toHaveValue("Training done");
  });
});

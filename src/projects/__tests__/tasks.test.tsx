/// <reference types="@testing-library/jest-dom" />
import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { DeliverablesSection } from "../sections/DeliverablesSection";
import type { ProjectSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const dc = copy.projects.deliverables;

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Project",
  metadata: { id: "p1", name: "Project one" },
  spec: {
    team: "t1",
    resources: [{ id: "facilitator", role: "teamMember", resource: "training-facilitator" }],
    deliverables: [
      {
        id: "dv-pack",
        name: "Training pack",
        tasks: [{ id: "t-guide", name: "Prepare the facilitator guide", role: { local: "resources", id: "facilitator" } }],
      },
    ],
  },
};

const get = vi.fn();
const list = vi.fn();
const saveWorking = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ version: { number: 0 }, manifest, yaml: "" });
  list.mockResolvedValue([{ id: "training-facilitator", name: "Training facilitator" }]);
  saveWorking.mockResolvedValue(undefined);
});

// What the store holds, read after each render.
const seen: { spec?: ProjectSpec } = {};

function Spy() {
  const spec = useProjectStore().spec;
  useEffect(() => {
    seen.spec = spec;
  });
  return null;
}

async function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ClientProvider client={fakeClient({ get, list, saveWorking })}>
      <QueryClientProvider client={queryClient}>
        <ProjectStoreProvider id="p1">
          <Spy />
          <DeliverablesSection />
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe("a deliverable's tasks", () => {
  it("lists them under the deliverable, numbered as the work breakdown", async () => {
    await mount();
    const field = await screen.findByLabelText(`${dc.taskNameLabel} D1.1`);
    expect(field).toHaveValue("Prepare the facilitator guide");
    expect(field).toHaveAttribute("data-cartograph-field", "/spec/deliverables/{dv-pack}/tasks/{t-guide}/name");
  });

  it("adds a task in place, with no date and no role until one is picked", async () => {
    await mount();
    await screen.findByLabelText(`${dc.taskNameLabel} D1.1`);
    await userEvent.click(screen.getByRole("button", { name: dc.addTask }));
    await userEvent.type(screen.getByLabelText(`${dc.taskNameLabel} D1.2`), "Record attendance");
    await waitFor(() => expect(seen.spec?.deliverables?.[0].tasks?.[1]).toMatchObject({ name: "Record attendance" }));
    expect(seen.spec?.deliverables?.[0].tasks?.[1].role).toBeUndefined();
    expect(seen.spec?.deliverables?.[0].tasks?.[1].id).toMatch(/^t-/);
  });

  it("drops the list once its last task is removed", async () => {
    await mount();
    await screen.findByLabelText(`${dc.taskNameLabel} D1.1`);
    const region = document.querySelector('[data-cartograph-region="tasks-0"]') as HTMLElement;
    await userEvent.click(region.querySelector(`[aria-label="${copy.projects.common.remove}"]`) as HTMLElement);
    await waitFor(() => expect(seen.spec?.deliverables?.[0].tasks).toBeUndefined());
  });
});

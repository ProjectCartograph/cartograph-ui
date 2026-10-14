/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider } from "../store";
import { NextToDecide } from "../NextToDecide";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, useNavigate: () => navigate, Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a> }));

const nd = copy.projects.nextToDecide;

// The walk shows what can be decided now, the round an agent is given,
// each going to the step that answers it (#60; engine docs/adr/0032).
describe("what can be decided now", () => {
  it("lists the project's round and goes to its step", async () => {
    const user = userEvent.setup();
    const round = vi.fn(async () => ({
      settle: [],
      ask: [
        { kind: "Project", id: "p1", check: "risks-mitigation", state: "warn", message: "No mitigation", do: "Give every risk a mitigation.", step: "risks", question: "q-1" },
        { kind: "Goal", id: "g1", check: "owner", state: "warn", message: "No owner" },
      ],
      write: [],
      waiting: 4,
    }));
    const manifest = { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Depot checks" }, spec: {} };
    render(
      <ClientProvider client={fakeClient({ round: round as never, get: async () => ({ version: { number: 0 }, manifest, yaml: "" }) as never, list: async () => [] as never, saveWorking: async () => undefined })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProjectStoreProvider id="p1">
            <NextToDecide id="p1" section="goals" />
          </ProjectStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    await user.click(await screen.findByRole("button", { name: new RegExp(nd.title(1)) }));
    expect(screen.getByText(nd.waiting(4))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Give every risk a mitigation/ }));
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/projects/$id/initiation/risks" }));
  });
});

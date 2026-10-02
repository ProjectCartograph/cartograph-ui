/// <reference types="@testing-library/jest-dom" />
// Following an agent (engine docs/adr/0018): its steps arrive as presence
// on its person's feed, each shown once in its own lane; following a lane
// moves the view with it; the viewer chooses what to see.

import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Peer, PresenceAgent, PresenceChannel } from "@/client/port";
import { isPresenceMessage } from "@/client/presence";
import { copy } from "@/copy";
import { FollowFeed, FollowProvider, mergeLanes, useFollow, type AgentLane } from "@/collab/follow";
import { FollowPanel } from "@/collab/FollowPanel";
import { PresenceProvider } from "@/collab/presence";
import { usePresence } from "@/collab/presenceContext";

const fc = copy.follow;

function agentPeer(session: string, agent: PresenceAgent, name = "Ada's agent (Claude)"): Peer {
  return { session, actor: "ada@example.org via Claude", name, color: "#7c3aed", focus: null, caret: null, pointer: null, heard: 0, agent };
}

describe("lanes", () => {
  it("take each step once, and keep a sub-agent apart", () => {
    const lanes = new Map<string, AgentLane>();
    const guide = agentPeer("agent-1", { for: "ada@example.org", seq: 1, step: "guide", kind: "Goal" });
    expect(mergeLanes(lanes, [guide], 1000)).toBe(true);
    expect(mergeLanes(lanes, [guide], 1500)).toBe(false);
    const draft = agentPeer("agent-1", { for: "ada@example.org", seq: 2, step: "draft", kind: "Goal", id: "g1", fields: ["/spec/objective"], met: 3, open: 2 });
    const sub = agentPeer("agent-2", { for: "ada@example.org", seq: 5, step: "read", kind: "Gap", id: "gap1" }, "Ada's agent (Claude › researcher)");
    mergeLanes(lanes, [draft, sub], 2000);
    expect(lanes.get("agent-1")?.steps.map((s) => s.step)).toEqual(["guide", "draft"]);
    expect(lanes.get("agent-2")?.label).toBe("Ada's agent (Claude › researcher)");
    // Silent past the time presence lasts, a lane goes idle and keeps its steps.
    mergeLanes(lanes, [], 20_000);
    expect(lanes.get("agent-1")?.active).toBe(false);
    expect(lanes.get("agent-1")?.steps).toHaveLength(2);
  });

  it("refuse an agent block the schema does not allow", () => {
    const base = { v: 1, session: "agent-12345678", actor: "a", at: 1 };
    expect(isPresenceMessage({ ...base, agent: { for: "", seq: 1, step: "draft", met: 2 } })).toBe(true);
    expect(isPresenceMessage({ ...base, agent: { for: "", seq: 1, step: "sing" } })).toBe(false);
    expect(isPresenceMessage({ ...base, agent: { for: "", seq: 1, step: "draft", extra: 1 } })).toBe(false);
  });
});

/** A feed the test speaks on, as the engine would for the agent. */
function feed() {
  let listener: ((peers: Peer[]) => void) | undefined;
  const channel: PresenceChannel = {
    publish: () => {},
    subscribe: (l) => {
      listener = l;
      l([]);
      return () => {};
    },
    close: () => {},
  };
  return { channel, say: (peers: Peer[]) => act(() => listener?.(peers)) };
}

/** Mounts ui in the root layout, as the app does, so it stays across
 * the navigations it makes. */
function mount(ui: ReactNode, client = fakeClient()) {
  const root = createRootRoute({
    component: () => (
      <>
        {ui}
        <Outlet />
      </>
    ),
  });
  const home = createRoute({ getParentRoute: () => root, path: "/", component: () => null });
  const goal = createRoute({ getParentRoute: () => root, path: "/goals/$id", component: () => <p data-cartograph-field="/spec/objective">objective</p> });
  const review = createRoute({ getParentRoute: () => root, path: "/proposals/$id", component: () => null });
  const goals = createRoute({ getParentRoute: () => root, path: "/goals", component: () => null });
  const router = createRouter({ routeTree: root.addChildren([home, goal, review, goals]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>
    </ClientProvider>,
  );
  return router;
}

function Opener() {
  const f = useFollow();
  return (
    <button type="button" onClick={() => f.setPanelOpen(true)}>
      open
    </button>
  );
}

describe("following", () => {
  it("moves the view with the agent, to the draft and then to its proposal", async () => {
    const { channel, say } = feed();
    const followAgents = vi.fn(async () => channel);
    const session = vi.fn(async () => ({ actor: "ada@example.org", email: "ada@example.org", canWrite: true }));
    const router = mount(
      <FollowProvider>
        <Opener />
        <FollowPanel />
      </FollowProvider>,
      fakeClient({ followAgents, session }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "open" }));
    expect(await screen.findByText(fc.none)).toBeInTheDocument();
    say([agentPeer("agent-1", { for: "ada@example.org", seq: 1, step: "guide", kind: "Goal" })]);
    await userEvent.click(await screen.findByRole("button", { name: fc.follow }));

    say([agentPeer("agent-1", { for: "ada@example.org", seq: 2, step: "draft", kind: "Goal", id: "g1", name: "Cut loss after picking", fields: ["/spec/objective"], met: 4, open: 1 })]);
    await waitFor(() => expect(router.state.location.pathname).toBe("/goals/g1"));
    expect(await screen.findByText(fc.steps.draft("Cut loss after picking"))).toBeInTheDocument();
    expect(screen.getByText(fc.checksMet(4, 5))).toBeInTheDocument();

    say([agentPeer("agent-1", { for: "ada@example.org", seq: 3, step: "propose", kind: "Goal", id: "g1", name: "Cut loss after picking", proposal: "p9", parts: 1 })]);
    await waitFor(() => expect(router.state.location.pathname).toBe("/proposals/p9"));
    expect(document.querySelector('[data-cartograph-step="propose"] .cartograph-burst')).not.toBeNull();
  });

  it("goes to where the agent is at once, even when it has only read a guide", async () => {
    const { channel, say } = feed();
    const router = mount(
      <FollowProvider>
        <Opener />
        <FollowPanel />
      </FollowProvider>,
      fakeClient({ followAgents: async () => channel }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "open" }));
    // It read a goal, then the guide, and is now asking its person.
    say([agentPeer("agent-1", { for: "", seq: 1, step: "read", kind: "Goal", id: "g1", name: "Cut loss after picking" })]);
    say([agentPeer("agent-1", { for: "", seq: 2, step: "guide", kind: "Goal" })]);
    await userEvent.click(await screen.findByRole("button", { name: fc.follow }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/goals"));

    // Any step it took is a place to go.
    await userEvent.click(screen.getByRole("button", { name: fc.steps.read("Cut loss after picking") }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/goals/g1"));
  });

  it("hands the view back on the viewer's own input", async () => {
    const { channel, say } = feed();
    const router = mount(
      <FollowProvider>
        <Opener />
        <FollowPanel />
        <p>page</p>
      </FollowProvider>,
      fakeClient({ followAgents: async () => channel }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "open" }));
    say([agentPeer("agent-1", { for: "", seq: 1, step: "guide", kind: "Goal" })]);
    await userEvent.click(await screen.findByRole("button", { name: fc.follow }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/goals"));
    await userEvent.click(screen.getByText("page"));
    say([agentPeer("agent-1", { for: "", seq: 2, step: "draft", kind: "Goal", id: "g1" })]);
    await new Promise((r) => setTimeout(r, 50));
    expect(router.state.location.pathname).toBe("/goals");
  });
});

describe("what the viewer sees", () => {
  it("hides a lane, and other people's agents on drafts when asked", async () => {
    const toggleLane = vi.fn();
    const lane: AgentLane = { session: "agent-2", label: "Sam's agent (Claude)", color: "#7c3aed", actor: "sam via Claude", steps: [], active: true };
    mount(
      <FollowFeed value={{ panelOpen: true, lanes: [lane], toggleLane }}>
        <FollowPanel />
      </FollowFeed>,
    );
    await userEvent.click(await screen.findByRole("button", { name: fc.hide(lane.label) }));
    expect(toggleLane).toHaveBeenCalledWith("agent-2");
  });

  it("keeps the viewer's own agents on a draft and drops others' when they choose", async () => {
    function Peers() {
      const { peers } = usePresence();
      return <p data-testid="peers">{peers.map((p) => p.session).join(",")}</p>;
    }
    const mine = agentPeer("agent-1", { for: "ada@example.org", seq: 1, step: "draft" });
    const theirs = agentPeer("agent-2", { for: "sam@example.org", seq: 1, step: "draft" });
    const person: Peer = { session: "s-sam", actor: "sam", color: "#2563eb", route: "/", focus: null, caret: null, pointer: null, heard: 0 };
    const channel: PresenceChannel = {
      publish: () => {},
      subscribe: (l) => {
        l([mine, theirs, person]);
        return () => {};
      },
      close: () => {},
    };
    const client = fakeClient({ joinPresence: async () => channel });
    const { rerender } = render(
      <ClientProvider client={client}>
        <FollowFeed value={{ othersOnDrafts: false, me: "ada@example.org" }}>
          <PresenceProvider screen={null} route="/">
            <Peers />
          </PresenceProvider>
        </FollowFeed>
      </ClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("peers")).toHaveTextContent("agent-1,s-sam"));
    rerender(
      <ClientProvider client={client}>
        <FollowFeed value={{ othersOnDrafts: true, me: "ada@example.org" }}>
          <PresenceProvider screen={null} route="/">
            <Peers />
          </PresenceProvider>
        </FollowFeed>
      </ClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("peers")).toHaveTextContent("agent-1,agent-2,s-sam"));
  });
});

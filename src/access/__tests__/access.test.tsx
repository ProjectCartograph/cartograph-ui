/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Client, Session } from "@/client/port";
import { copy } from "@/copy";

import { mayWrite } from "../access";
import { WriteGate } from "../WriteGate";

// The running example's teams: early grades sits under the curriculum
// division, assessment beside it.
const contributor: Session = {
  actor: "sub-lee",
  name: "Lee Okafor",
  email: "lee@example.org",
  canWrite: true,
  access: {
    listed: true,
    roles: ["contributor"],
    teams: ["curriculum"],
    reach: ["curriculum", "early-grades"],
    scopes: { Project: "teams", Gap: "all", Goal: "none" },
  },
};

function mount(client: Client, ui: ReactNode) {
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
    </ClientProvider>,
  );
}

function project(team: string) {
  return {
    version: { kind: "Project", id: "p", number: 1, actor: "a", reason: "r", on: "2026-10-01T00:00:00Z" },
    manifest: { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p", name: "p" }, spec: { team } },
    yaml: "",
  } as never;
}

describe("what a session may change", () => {
  it("follows the scope for the kind, and the team for a team's work", () => {
    expect(mayWrite(contributor, "Gap")).toBe(true);
    expect(mayWrite(contributor, "Goal")).toBe(false);
    expect(mayWrite(contributor, "Project", "early-grades")).toBe(true);
    expect(mayWrite(contributor, "Project", "assessment")).toBe(false);
    expect(mayWrite(contributor, "Project")).toBe(true); // a new one, no team yet
    expect(mayWrite(contributor, "Settings")).toBe(false); // a kind not named
  });

  it("falls back to canWrite where the deployment keeps no access list", () => {
    expect(mayWrite({ actor: "local", canWrite: true }, "Goal")).toBe(true);
    expect(mayWrite({ actor: "local", canWrite: false }, "Goal")).toBe(false);
  });
});

describe("WriteGate", () => {
  it("disables another team's project and says why", async () => {
    const client = fakeClient({ session: async () => contributor, get: async () => project("assessment") });
    mount(
      client,
      <WriteGate kind="Project" id="p">
        <input aria-label="Name" />
      </WriteGate>,
    );
    await waitFor(() => expect(document.querySelector('[data-cartograph-region="read-only"]')).toHaveTextContent(copy.access.notYourTeam));
    expect(screen.getByLabelText("Name")).toBeDisabled();
  });

  it("leaves a project of a team beneath theirs editable", async () => {
    const get = vi.fn(async () => project("early-grades"));
    mount(
      fakeClient({ session: async () => contributor, get }),
      <WriteGate kind="Project" id="p">
        <input aria-label="Name" />
      </WriteGate>,
    );
    // The session arrives, then the team is read; neither disables it.
    await waitFor(() => expect(get).toHaveBeenCalledWith("Project", "p"));
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());
    expect(document.querySelector('[data-cartograph-region="read-only"]')).toBeNull();
  });

  it("makes a kind the session may not change read-only", async () => {
    mount(
      fakeClient({ session: async () => contributor }),
      <WriteGate kind="Goal" id="g">
        <button>Save</button>
      </WriteGate>,
    );
    await waitFor(() => expect(document.querySelector('[data-cartograph-region="read-only"]')).toHaveTextContent(copy.access.readOnly));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

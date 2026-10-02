/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Client, Person, Session } from "@/client/port";
import { copy } from "@/copy";

import { mayWrite } from "../access";
import { AccessPage } from "../AccessPage";
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

/** The control at a field path, inside root. */
function field(root: HTMLElement, path: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(`[data-cartograph-field="${path}"]`);
  if (!el) throw new Error(`no field ${path}`);
  return el;
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

describe("the Access page", () => {
  const admin: Session = { ...contributor, email: "admin@example.org", access: { ...contributor.access!, roles: ["administrator"] } };
  const people: Person[] = [
    {
      email: "admin@example.org", name: "Ada Admin", roles: ["administrator"], teams: [],
      directoryRoles: [], directoryTeams: [], addedBy: "command line", addedOn: "2026-10-01T00:00:00Z", lastSignedIn: "2026-10-01T09:00:00Z",
    },
    {
      email: "lee@example.org", name: "Lee Okafor", roles: [], teams: [],
      directoryRoles: ["contributor"], directoryTeams: ["curriculum"], addedBy: "directory", addedOn: "2026-10-01T00:00:00Z",
    },
  ];
  const teams = [
    { kind: "Team", id: "curriculum", name: "Curriculum division", version: 1, updatedOn: "2026-10-01T00:00:00Z" },
    { kind: "Team", id: "assessment", name: "Assessment", version: 1, updatedOn: "2026-10-01T00:00:00Z" },
  ];

  it("lists people with their roles, teams and last sign-in, and marks you", async () => {
    mount(fakeClient({ session: async () => admin, people: async () => people, list: async () => teams as never }), <AccessPage />);
    const row = (await waitFor(() => {
      const r = document.querySelector<HTMLElement>('[data-cartograph-region="person:lee@example.org"]');
      expect(r).not.toBeNull();
      return r;
    }))!;
    expect(row).toHaveTextContent(copy.access.role.contributor.name);
    expect(row).toHaveTextContent("Curriculum division"); // the team's name, not its id
    expect(row).toHaveTextContent(copy.access.never);
    const adminRow = document.querySelector<HTMLElement>('[data-cartograph-region="person:admin@example.org"]')!;
    expect(adminRow).toHaveTextContent(copy.access.you);
    expect(adminRow).toHaveTextContent("1 Oct 2026");
    // Nobody removes themselves.
    expect(within(adminRow).queryByRole("button", { name: copy.access.remove("Ada Admin") })).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: copy.access.remove("Lee Okafor") })).toBeInTheDocument();
  });

  it("adds a person by address with roles and teams", async () => {
    const grantPerson = vi.fn(async (email: string) => ({ ...people[1], email }));
    mount(fakeClient({ session: async () => admin, people: async () => people, list: async () => teams as never, grantPerson }), <AccessPage />);
    await userEvent.click(await screen.findByRole("button", { name: copy.access.add }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(field(dialog, "/email"), "sam@example.org");
    await userEvent.click(field(dialog, "/roles/reader"));
    await userEvent.click(await waitFor(() => field(dialog, "/teams/assessment")));
    await userEvent.click(within(dialog).getByRole("button", { name: copy.access.save }));
    await waitFor(() => expect(grantPerson).toHaveBeenCalledWith("sam@example.org", { roles: ["reader"], teams: ["assessment"], agentsOff: false }));
  });

  it("turns one person's agents off", async () => {
    const grantPerson = vi.fn(async () => people[1]);
    mount(fakeClient({ session: async () => admin, people: async () => people, list: async () => teams as never, grantPerson }), <AccessPage />);
    await userEvent.click(await screen.findByRole("button", { name: copy.access.edit("Lee Okafor") }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(field(dialog, "/agentsOff")).getByRole("checkbox"));
    await userEvent.click(within(dialog).getByRole("button", { name: copy.access.save }));
    await waitFor(() => expect(grantPerson).toHaveBeenCalledWith("lee@example.org", { roles: [], teams: [], agentsOff: true }));
  });

  it("shows what the directory gives as given, and changes only the rest", async () => {
    const grantPerson = vi.fn(async () => people[1]);
    mount(fakeClient({ session: async () => admin, people: async () => people, list: async () => teams as never, grantPerson }), <AccessPage />);
    await userEvent.click(await screen.findByRole("button", { name: copy.access.edit("Lee Okafor") }));
    const dialog = screen.getByRole("dialog");
    // What the directory gives is shown as given and cannot be unticked.
    expect(within(field(dialog, "/roles/contributor")).getByRole("checkbox")).toBeDisabled();
    expect(within(await waitFor(() => field(dialog, "/teams/curriculum"))).getByRole("checkbox")).toBeDisabled();
    await userEvent.click(field(dialog, "/roles/strategyEditor"));
    await userEvent.click(within(dialog).getByRole("button", { name: copy.access.save }));
    await waitFor(() => expect(grantPerson).toHaveBeenCalledWith("lee@example.org", { roles: ["strategyEditor"], teams: [], agentsOff: false }));
  });
});

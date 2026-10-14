/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { StakeholderGrid } from "../StakeholderGrid";
import { groupsOf, type StakeholderEntry } from "../types";

const pc = copy.projects.resources;

const list = vi.fn(async (kind: string) =>
  kind === "BeneficiaryGroup"
    ? [{ id: "depot-staff", name: "Depot staff" }]
    : [
        { id: "transport", name: "Transport contractor" },
        { id: "operations-lead", name: "Operations lead" },
      ],
);

function Harness({ start }: { start: StakeholderEntry[] }) {
  const [entries, setEntries] = useState(start);
  return (
    <>
      <StakeholderGrid entries={entries} groups={["depot-staff"]} onChange={setEntries} />
      <output data-testid="entries">{JSON.stringify(entries)}</output>
    </>
  );
}

function mount(start: StakeholderEntry[]) {
  render(
    <ClientProvider client={fakeClient({ list: list as never })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Harness start={start} />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

const entries = () => JSON.parse(screen.getByTestId("entries").textContent ?? "[]") as StakeholderEntry[];

// A stakeholder entry says what the party cares about here and who owns
// the relationship, and may be a beneficiary group (TAXONOMY.md D42).
describe("a stakeholder entry", () => {
  it("names a beneficiary group as readily as a resource", async () => {
    mount([{ group: "depot-staff" }, { resource: "transport" }]);
    expect(await screen.findByLabelText(`${pc.stakeLabel} Depot staff`)).toBeInTheDocument();
    expect(await screen.findByLabelText(`${pc.stakeLabel} Transport contractor`)).toBeInTheDocument();
  });

  it("writes its stake, and drops it when cleared", async () => {
    mount([{ group: "depot-staff" }]);
    const stake = await screen.findByLabelText(`${pc.stakeLabel} Depot staff`);
    expect(stake).toHaveAttribute("data-cartograph-field", "/spec/entries/0/stake");
    await userEvent.type(stake, "Wants intake no slower");
    await waitFor(() => expect(entries()[0].stake).toBe("Wants intake no slower"));
    await userEvent.clear(stake);
    await waitFor(() => expect(entries()[0].stake).toBeUndefined());
  });

  it("asks who owns the relationship, from the catalogue", async () => {
    mount([{ group: "depot-staff", owner: { kind: "Resource", id: "operations-lead" } }]);
    await screen.findByLabelText(`${pc.stakeLabel} Depot staff`);
    expect(document.querySelector('[data-cartograph-field="/spec/entries/0/owner"]')).not.toBeNull();
  });
});

describe("the work's own groups", () => {
  it("are those its beneficiaries and its problems name, once each", () => {
    expect(
      groupsOf({
        summary: {
          beneficiaries: [{ group: "depot-staff" }],
          problems: [{ groups: ["depot-staff", "members"] } as never],
        },
      }),
    ).toEqual(["depot-staff", "members"]);
    expect(groupsOf({ problems: [{ groups: ["growers"] } as never] })).toEqual(["growers"]);
  });
});

// A party is placed in words, on its own row, and the grid names it where
// it sits, with no codes to decode (#40).
describe("placing a stakeholder", () => {
  it("places a party by its influence and interest in words", async () => {
    mount([{ resource: "transport" }]);
    expect(await screen.findByText("Transport contractor")).toBeInTheDocument();
    expect(screen.getByText(pc.unplaced)).toBeInTheDocument();
    const influence = screen.getByRole("radiogroup", { name: `${pc.influenceLabel} Transport contractor` });
    await userEvent.click(within(influence).getByRole("radio", { name: pc.levels[3] }));
    const interest = screen.getByRole("radiogroup", { name: `${pc.interestLabel} Transport contractor` });
    await userEvent.click(within(interest).getByRole("radio", { name: pc.levels[3] }));
    expect(entries()[0]).toMatchObject({ influence: 3, interest: 3 });
    expect(screen.getAllByText(pc.gridQuadrant.manageClosely).length).toBeGreaterThan(0);
    const cell = screen.getByLabelText(`${pc.influenceLabel} ${pc.levels[3]}, ${pc.interestLabel} ${pc.levels[3]}`);
    expect(within(cell).getByText("Transport contractor")).toBeInTheDocument();
    expect(screen.queryByText("3/3")).toBeNull();
  });
});

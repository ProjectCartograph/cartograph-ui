/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { EscalationRoute } from "../EscalationRoute";

type Step = { kind?: string; id?: string; external?: string };

function Harness({ start }: { start: Step[] }) {
  const [route, setRoute] = useState<Step[] | undefined>(start);
  return (
    <>
      <EscalationRoute value={route ?? []} onChange={setRoute} />
      <output data-testid="route">{JSON.stringify(route ?? null)}</output>
    </>
  );
}

// The escalation route is written in Cartograph's reference shape, a body
// outside the workspace by name, nearest first (TAXONOMY.md D44).
describe("an escalation route", () => {
  it("names a body outside the workspace as external, and drops the route with its last step", async () => {
    const list = vi.fn().mockResolvedValue([{ id: "steering", name: "Steering Committee" }]);
    render(
      <ClientProvider client={fakeClient({ list })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Harness start={[{ kind: "Resource", id: "steering" }]} />
        </QueryClientProvider>
      </ClientProvider>,
    );
    const c = copy.escalationRoute;
    await userEvent.click(screen.getByRole("button", { name: c.add }));
    const outside = screen.getAllByRole("radio", { name: copy.sheets.refObject.outside })[1];
    await userEvent.click(outside);
    await userEvent.type(screen.getByLabelText(copy.sheets.refObject.outsideName), "The national government");
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId("route").textContent ?? "")).toEqual([
        { kind: "Resource", id: "steering" },
        { external: "The national government" },
      ]),
    );
    for (const remove of screen.getAllByRole("button", { name: copy.projects.common.remove }).reverse()) {
      await userEvent.click(remove);
    }
    expect(screen.getByTestId("route")).toHaveTextContent("null");
  });
});

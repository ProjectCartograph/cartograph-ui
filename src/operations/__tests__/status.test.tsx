import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { useOperationRows } from "@/components/explorer/registers";
import { copy } from "@/copy";
import { statusOf } from "../status";

const oc = copy.operations.status;

function Rows() {
  const { rows } = useOperationRows();
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.id} data-row={r.id}>
          {r.marks}
        </li>
      ))}
    </ul>
  );
}

// Where a service is in its life (TAXONOMY.md D30), on every row of the
// operations list; a service saved before 2.7 says nothing and is running.
describe("a service's status", () => {
  it("is running unless it says otherwise", () => {
    expect(statusOf(undefined)).toBe("running");
    expect(statusOf({})).toBe("running");
    expect(statusOf({ status: "planned" })).toBe("planned");
    expect(statusOf({ status: "retired" })).toBe("retired");
    expect(statusOf({ status: "nonsense" })).toBe("running");
  });

  it("marks each row of the operations list", async () => {
    const client = fakeClient({
      list: (async (kind: string) =>
        kind === "Operation"
          ? [
              { kind, id: "checks", name: "Quality Check Service", spec: { purpose: "Check", team: "t1", status: "planned" } },
              { kind, id: "collection", name: "Collection Service", spec: { purpose: "Collect", team: "t1" } },
            ]
          : []) as never,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Rows />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByRole("img", { name: `${oc.label}: ${oc.planned}` })).toBeTruthy();
    expect(screen.getByRole("img", { name: `${oc.label}: ${oc.running}` })).toBeTruthy();
  });
});

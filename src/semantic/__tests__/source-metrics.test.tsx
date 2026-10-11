/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { SourceMetricsEditor, type SourceMetric } from "../SourceMetricsEditor";

const mc = copy.sourceMetrics;
let latest: SourceMetric[] | undefined;

function Harness({ initial }: { initial: SourceMetric[] }) {
  const [v, setV] = useState<SourceMetric[] | "">(initial);
  return (
    <SourceMetricsEditor
      value={v}
      onChange={(next) => {
        latest = next;
        setV(next ?? "");
      }}
    />
  );
}

// A data source's metrics are written as aggregations, with the words and
// the source's own names offered as they are typed, and what the engine
// reads said beneath (engine TAXONOMY.md D64).
describe("a data source's metrics", () => {
  it("offers words and names while typing, and says what the engine reads", async () => {
    const user = userEvent.setup();
    const readAggregation = vi.fn(async (text: string) =>
      text.includes("JOIN")
        ? { names: [], problem: "JOIN is not part of a metric." }
        : { names: text.includes("passed") ? ["passed"] : [], reading: `Read: ${text}.` },
    );
    render(
      <ClientProvider client={fakeClient({ readAggregation: readAggregation as never })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Harness initial={[{ id: "metric-1", name: "Passed", aggregation: "COUNT(*) WHERE passed = true" }]} />
        </QueryClientProvider>
      </ClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: mc.addHint }));
    expect(latest?.[1]).toEqual({ id: "metric-2", name: "", aggregation: "" });
    const box = screen.getAllByRole("combobox")[1];
    await user.type(box, "SU");
    await user.keyboard("{Enter}");
    expect(latest?.[1].aggregation).toBe("SUM(");
    // The name another metric of this source uses is offered too.
    await user.type(box, "pa");
    expect(await screen.findByRole("option", { name: "passed" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.clear(box);
    await user.type(box, "COUNT(*) JOIN depots");
    expect(await screen.findByText("JOIN is not part of a metric.")).toBeInTheDocument();
  });
});

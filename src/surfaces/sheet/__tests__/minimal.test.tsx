/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import schema from "../../../../contract/schemas/datasource.schema.json";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { SheetAddDialog } from "../InlineSheetAdd";

// Added in passing, a record asks only what it requires: the name and the
// required fields, the id from the name, the reason given (TAXONOMY.md D34).
describe("a minimal add", () => {
  it("asks a data source for its name and team, and nothing else", async () => {
    const saveVersion = vi.fn(async () => ({ number: 1 }) as never);
    render(
      <ClientProvider client={fakeClient({ schema: async () => schema as never, saveVersion, list: async () => [{ id: "t1", name: "Team One" }] as never })}>
        <QueryClientProvider client={new QueryClient()}>
          <SheetAddDialog kind="DataSource" open onOpenChange={() => {}} minimal={{ reason: "Prepared" }} />
        </QueryClientProvider>
      </ClientProvider>,
    );
    await waitFor(() => expect(document.querySelector('[data-cartograph-field="/spec/team"]')).not.toBeNull());
    expect(document.querySelector('[data-cartograph-field="/metadata/id"]')).toBeNull();
    expect(document.querySelector('[data-cartograph-field="/spec/category"]')).toBeNull();
    expect(screen.queryByText(copy.sheets.dialog.reasonLabel)).toBeNull();
  });
});

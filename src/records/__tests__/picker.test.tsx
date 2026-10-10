/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { PickerDialog } from "../PickerDialog";
import { textsAt } from "../texts";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a> }));

const pk = copy.recordPicker;
const gaps = [
  { kind: "Gap", id: "late", name: "Faults are found after dispatch", version: 1, updatedOn: "" },
  { kind: "Gap", id: "standard", name: "No single standard", version: 1, updatedOn: "" },
];
const manifests: Record<string, unknown> = {
  late: { kind: "Gap", metadata: { id: "late", name: "Faults are found after dispatch" }, spec: { statement: "Checks happen after the produce leaves" } },
  standard: { kind: "Gap", metadata: { id: "standard", name: "No single standard" }, spec: { statement: "Each depot grades its own way" } },
};

function mount(onChange: (ids: string[]) => void) {
  render(
    <ClientProvider
      client={fakeClient({
        list: vi.fn(async () => gaps) as never,
        get: vi.fn(async (_k: string, id: string) => ({ version: { number: 1 }, manifest: manifests[id], yaml: "" })) as never,
        getGuide: vi.fn(async () => ({ kind: "Gap", locale: "en", definition: "", steps: [{ key: "shortfall", title: "The shortfall", fields: [{ path: "/spec/statement", control: "text" }] }] })) as never,
      })}
    >
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PickerDialog kind="Gap" title="Related gaps" multiple selected={[]} onChange={onChange} open onOpenChange={() => {}} />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

// A record is read before it is chosen: the list beside the preview of the
// one under the pointer (#28).
describe("choosing records with a preview", () => {
  it("previews the record under the pointer and chooses several", async () => {
    const onChange = vi.fn();
    mount(onChange);
    expect(await screen.findByText("Checks happen after the produce leaves")).toBeInTheDocument();
    expect(screen.getByText("The shortfall")).toBeInTheDocument();
    const second = screen.getByRole("option", { name: /No single standard/ });
    await userEvent.hover(second);
    expect(await screen.findByText("Each depot grades its own way")).toBeInTheDocument();
    await userEvent.click(second);
    await userEvent.click(screen.getByRole("option", { name: /Faults are found/ }));
    await userEvent.click(screen.getByRole("button", { name: pk.done }));
    expect(onChange).toHaveBeenCalledWith(["standard", "late"]);
  });

  it("reads every text a pointer reaches, list items one by one, ids left out", () => {
    expect(textsAt({ spec: { lines: [{ what: "A first line" }, { what: "A second" }] } }, "/spec/lines/-/what")).toEqual(["A first line", "A second"]);
    expect(textsAt({ spec: { about: { situation: "Late checks", change: { what: "Checks at intake" }, group: "depot-staff" } } }, "/spec/about")).toEqual([
      "Late checks",
      "Checks at intake",
    ]);
  });
});

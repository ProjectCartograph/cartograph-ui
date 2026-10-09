/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parse as parseYAML } from "yaml";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ChangeControl } from "../ChangeControl";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const words = copy.access.changeControl;

describe("the change-control policy", () => {
  it("shows what is in force and saves a change to the policy in the change set", async () => {
    const get = vi.fn().mockResolvedValue({
      number: 1,
      manifest: { metadata: { id: "default", name: "Settings" }, spec: { changeControl: { changeSetsRequired: true } } },
    });
    const saveWorking = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      render(
        <ClientProvider client={fakeClient({ get, saveWorking })}>
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <ChangeControl />
          </QueryClientProvider>
        </ClientProvider>,
      );
    });
    const required = await screen.findByRole("checkbox", { name: words.policy.changeSetsRequired.name });
    await waitFor(() => expect(required).toBeChecked());
    const reviewer = screen.getByRole("checkbox", { name: words.policy.secondReviewer.name });
    expect(reviewer).not.toBeChecked();
    expect(reviewer).toHaveAccessibleDescription(words.policy.secondReviewer.does);

    await userEvent.click(reviewer);
    expect(reviewer).toBeChecked();
    await waitFor(() => expect(saveWorking).toHaveBeenCalled(), { timeout: 3000 });
    const [kind, id, yaml] = saveWorking.mock.calls.at(-1) as [string, string, string];
    expect([kind, id]).toEqual(["Settings", "default"]);
    expect(parseYAML(yaml).spec.changeControl).toEqual({ changeSetsRequired: true, rollIn: { secondReviewer: true } });
  });
});

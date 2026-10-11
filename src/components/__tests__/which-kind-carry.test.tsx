/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { WhichKindChoice } from "../WhichKind";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

// What was typed before choosing a kind goes into the kind started, so it
// is never typed twice.
describe("choosing a kind after typing", () => {
  it("starts a project with what was typed as what it is about", async () => {
    const user = userEvent.setup();
    const structureQuestions = vi.fn(async () => [{ field: "", question: "None", then: "A Project.", person: "None of these." }]);
    render(
      <ClientProvider client={fakeClient({ structureQuestions: structureQuestions as never })}>
        <QueryClientProvider client={new QueryClient()}>
          <WhichKindChoice text="Check every delivery at intake." />
        </QueryClientProvider>
      </ClientProvider>,
    );
    await user.click(await screen.findByText("None of these."));
    await user.click(screen.getByRole("button", { name: copy.whichKind.start(copy.createMenu.kinds.Project) }));
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/projects/start", search: expect.objectContaining({ about: "Check every delivery at intake." }) }));
  });
});

/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { RequiredMarks } from "../RequiredMarks";
import { pointerMatches } from "../pointer";

// What a definition cannot leave out is marked the same way in every flow,
// from the engine's guide: a control carries data-required and
// aria-required when its field is required, matched by its pointer.
describe("required fields", () => {
  it("match a list item by id or index", () => {
    expect(pointerMatches("/spec/deliverables/{d-1}/name", "/spec/deliverables/-/name")).toBe(true);
    expect(pointerMatches("/spec/deliverables/0/name", "/spec/deliverables/-/name")).toBe(true);
    expect(pointerMatches("/spec/deliverables/0/description", "/spec/deliverables/-/name")).toBe(false);
    expect(pointerMatches("/spec/deliverables", "/spec/deliverables/-/name")).toBe(false);
  });

  it("are marked where they are, and nothing else is", async () => {
    const getGuide = vi.fn().mockResolvedValue({
      steps: [
        {
          key: "deliverables",
          fields: [
            { path: "/spec/deliverables/-/name", control: "text", required: true },
            { path: "/spec/deliverables/-/description", control: "sentence" },
          ],
        },
      ],
    });
    render(
      <ClientProvider client={fakeClient({ getGuide })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RequiredMarks kind="Project" />
          <input aria-label="name" data-cartograph-field="/spec/deliverables/{d-1}/name" />
          <input aria-label="description" data-cartograph-field="/spec/deliverables/{d-1}/description" />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText(copy.required.legend)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("name")).toHaveAttribute("aria-required", "true"));
    expect(screen.getByLabelText("name")).toHaveAttribute("data-required");
    expect(screen.getByLabelText("description")).not.toHaveAttribute("data-required");
  });
});

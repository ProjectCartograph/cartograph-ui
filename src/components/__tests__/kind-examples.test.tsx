/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { KindExamples } from "../KindExamples";

// A kind says what is one and what is not where it is listed, before
// anyone adds one, from the engine's guide.
describe("what is and is not a kind", () => {
  it("lists good names, and poor ones with why each is something else", async () => {
    const getGuide = vi.fn().mockResolvedValue({
      steps: [
        {
          key: "segment",
          fields: [
            {
              path: "/metadata/name",
              control: "text",
              good: ["Region", "Northern region"],
              poor: [{ text: "Depot supervisor", why: "A role, which is a resource." }],
            },
          ],
        },
      ],
    });
    render(
      <ClientProvider client={fakeClient({ getGuide })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <KindExamples kind="Segment" />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText("Region, Northern region")).toBeInTheDocument();
    expect(screen.getByText(copy.kindExamples.isNot)).toBeInTheDocument();
    expect(screen.getByText("Depot supervisor")).toBeInTheDocument();
    expect(screen.getByText(/A role, which is a resource/)).toBeInTheDocument();
    expect(getGuide).toHaveBeenCalledWith("Segment", { level: undefined });
  });
});

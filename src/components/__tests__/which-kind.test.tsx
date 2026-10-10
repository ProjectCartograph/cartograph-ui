/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { WhichKindChoice } from "../WhichKind";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

// A person is asked which kind a piece of work is in plain words, never in
// the wording agents are given (#54).
describe("which kind it is", () => {
  it("asks each question as a person is asked it", async () => {
    const structureQuestions = vi.fn(async () => [
      {
        field: "changeOfItsOwn",
        question: "Where the document has a deliverable register, give deliverable, the code of the row (D4).",
        then: "A Project of its own.",
        person: "Does it make a change of its own that other work relies on?",
      },
      { field: "", question: "None of these (answer none: true):", then: "A Project.", person: "None of these. It is work with a start and an end." },
    ]);
    render(
      <ClientProvider client={fakeClient({ structureQuestions: structureQuestions as never })}>
        <QueryClientProvider client={new QueryClient()}>
          <WhichKindChoice />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText("Does it make a change of its own that other work relies on?")).toBeInTheDocument();
    expect(screen.getByText("None of these. It is work with a start and an end.")).toBeInTheDocument();
    expect(screen.queryByText(/\(D4\)|answer none/)).toBeNull();
  });
});

/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { VocabularyChoice } from "../Vocabulary";

const settings = async () =>
  ({
    goalLevels: ["Goal", "Objective", "Outcome"],
    projectLevelName: "Project",
    operator: "local",
    vocabularies: { classification: [{ value: "official", label: "Official", description: "Ordinary business." }, { value: "secret", label: "Secret" }] },
  }) as never;

// A field whose choices are the workspace's own offers its words, each
// with what it means, and keeps a value its list does not have
// (engine TAXONOMY.md D71).
describe("a choice from the workspace's own words", () => {
  it("offers the workspace's terms and keeps a value outside them", async () => {
    const user = userEvent.setup();
    render(
      <ClientProvider client={fakeClient({ settings })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <VocabularyChoice vocabulary="classification" value="restricted" onChange={() => {}} label="Classification" />
        </QueryClientProvider>
      </ClientProvider>,
    );
    await user.click(screen.getByRole("combobox", { name: "Classification" }));
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["restricted", "OfficialOrdinary business.", "Secret"]);
  });
});

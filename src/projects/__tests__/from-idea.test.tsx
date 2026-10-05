import { useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { NotFound } from "@/client/port";
import { FromIdeaProvider } from "@/components/FromIdea";
import { copy } from "@/copy";
import { AimSection } from "@/projects/sections/AimSection";
import { ProjectStoreProvider, useProjectStore } from "@/projects/store";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a> }));

let api: ReturnType<typeof useProjectStore> | null = null;
function Probe() {
  const store = useProjectStore();
  useEffect(() => {
    api = store;
  });
  return <span>{store.loaded ? "loaded" : "loading"}</span>;
}

const IDEA = "It is for the members who deliver to the northern depots. Today half the produce waits a day in the field.";

// A step starts from the person's own idea: the sentence that answers its
// question is shown, and used only when they say so (engine ADR 0023).
describe("a step from the idea", () => {
  it("offers the sentence that answers it, and fills the first empty problem on use", async () => {
    const fromIdea = vi.fn(async () => ({
      available: true,
      answers: [{ key: "problem", question: "What is wrong today?", field: "/spec/summary/problems/-/problem/situation", sentence: "Today half the produce waits a day in the field", likelihood: 0.8 }],
    }));
    const client = fakeClient({
      get: async (kind) => {
        if (kind !== "Project") throw new NotFound();
        return { version: { number: 1 }, manifest: { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Rollout" }, spec: { team: "t1", summary: { idea: IDEA, problems: [{ problem: {}, change: {} }] } } }, yaml: "" } as never;
      },
      saveWorking: async () => {},
      list: async () => [],
      fromIdea,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProjectStoreProvider id="p1">
            <Probe />
            <FromIdeaProvider kind="Project" idea={IDEA}>
              <AimSection />
            </FromIdeaProvider>
          </ProjectStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    await screen.findByText("loaded");
    expect(await screen.findByText("Today half the produce waits a day in the field")).toBeTruthy();
    expect(fromIdea).toHaveBeenCalledWith("Project", IDEA);
    expect(api!.spec.summary.problems[0].problem.situation).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: copy.common.useIt }));
    expect(api!.spec.summary.problems[0].problem.situation).toBe("Today half the produce waits a day in the field");
  });
});

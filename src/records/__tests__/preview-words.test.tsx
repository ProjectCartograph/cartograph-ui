/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { RecordPreview } from "../RecordPreview";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: ReactNode }) => <a href="#">{children}</a> }));

// A preview prints what a person reads: prose as written, a choice as its
// words, a reference not at all (#97: a data source previewed
// "paperRecord").
describe("a record's preview", () => {
  it("prints a fixed choice as its words, a vocabulary term in the workspace's", async () => {
    const client = fakeClient({
      get: async () =>
        ({
          version: { number: 1 },
          manifest: { apiVersion: "cartograph/v1", kind: "DataSource", metadata: { id: "d1", name: "Check sheets" }, spec: { category: "paperRecord", provenance: "internal", classification: "official", team: "quality-team", access: "Ask the depot office" } },
          yaml: "",
        }) as never,
      getGuide: async () =>
        ({
          kind: "DataSource",
          steps: [{ key: "about", title: "About it", fields: [{ path: "/spec/category", control: "select" }, { path: "/spec/provenance", control: "select" }, { path: "/spec/classification", control: "select" }, { path: "/spec/team", control: "ref" }] }, { key: "access", title: "Access", fields: [{ path: "/spec/access", control: "text" }] }],
        }) as never,
      schema: async () =>
        ({
          properties: {
            spec: {
              properties: {
                category: { type: "string", "x-cartograph-vocabulary": "dataSourceCategory" },
                provenance: { type: "string", enum: ["internal", "thirdParty"] },
                classification: { type: "string", "x-cartograph-vocabulary": "classification" },
                team: { $ref: "#/$defs/Slug", "x-cartograph-ref": "Team" },
                access: { type: "string" },
              },
            },
          },
          $defs: { Slug: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{1,63}$" } },
        }) as never,
      settings: async () =>
        ({
          goalLevels: [],
          projectLevelName: "Project",
          operator: "local",
          vocabularies: { dataSourceCategory: [{ value: "paperRecord", label: "Paper record" }], classification: [{ value: "official", label: "Official" }] },
        }) as never,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RecordPreview kind="DataSource" id="d1" />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText("Paper record")).toBeInTheDocument();
    expect(await screen.findByText("Official")).toBeInTheDocument();
    expect(screen.getByText("Ask the depot office")).toBeInTheDocument();
    expect(screen.queryByText("paperRecord")).toBeNull();
    expect(screen.queryByText("quality-team")).toBeNull();
  });
});

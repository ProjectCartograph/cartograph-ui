/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { copy } from "@/copy";
import { InitiationBackNext } from "../InitiationShell";
import { SECTION_VIEW } from "../sections/registry";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params }: { children?: ReactNode; to: string; params?: { id: string } }) => <a href={to.replace("$id", params?.id ?? "")}>{children}</a>,
  useBlocker: () => undefined,
}));

const pc = copy.projects;

// The plan is walked one step at a time (milestones, data, risks), so data
// and risks are never a long scroll below the milestones.
describe("the plan stage", () => {
  it("moves step by step inside the stage, then on to the next stage", () => {
    const { rerender } = render(<InitiationBackNext id="p1" stage="plan" section="timeline" />);
    expect(screen.getByRole("link", { name: new RegExp(pc.nextTo(SECTION_VIEW.data.heading)) })).toHaveAttribute("href", "/projects/p1/initiation/data");
    rerender(<InitiationBackNext id="p1" stage="plan" section="risks" />);
    expect(screen.getByRole("link", { name: new RegExp(pc.nextTo(pc.stages.handover)) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(pc.back) })).toHaveAttribute("href", "/projects/p1/initiation/data");
  });
});

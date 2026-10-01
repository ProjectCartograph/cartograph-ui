import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { span } from "../GoalEditor";
import { SmartMarks } from "../SmartMarks";
import * as mutations from "../mutations";
import * as client from "@/api/client";

vi.mock("@/api/client");

describe("aim context", () => {
  it("reads a horizon the way people say it", () => {
    expect(span({ start: "2025-01", end: "2030-12" })).toBe("2025 to 2030");
    expect(span({ start: "2025-09", end: "2027-07" })).toBe("2025-09 to 2027-07");
  });

  it("names the A test Attainable", () => {
    render(<SmartMarks smart={{ specific: true, measurable: true, attainable: false, relevant: true, timeBound: true }} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Attainable not met");
  });

  it("keeps owner and horizon through a save", async () => {
    vi.mocked(client.client).PUT.mockResolvedValueOnce({ error: null, response: { status: 200 } as any, data: null } as any);
    await mutations.saveGoalFields("g1", "Goal", {
      level: "goal", objective: "Raise attainment", owner: "chief-education-officer", horizon: { start: "2025", end: "2030" },
    }, "edit");
    const spec = (vi.mocked(client.client).PUT.mock.calls[0][1].body as any).manifest.spec;
    expect(spec.owner).toBe("chief-education-officer");
    expect(spec.horizon).toEqual({ start: "2025", end: "2030" });
  });
});

/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "@/copy";
import { ObjectiveEditor } from "../ObjectiveEditor";

const gc = copy.projects.goals;

function Harness({ initial = "", aligned = 0 }: { initial?: string; aligned?: number }) {
  const [objective, setObjective] = useState(initial);
  return <ObjectiveEditor objective={objective} alignedGoals={aligned} onChange={setObjective} data-cartograph-field="/spec/objectives/0/objective" />;
}

const met = (label: string) => screen.getByText(label).closest("[data-met]")?.getAttribute("data-met");

// The objective is written whole, in the writer's own word order (engine
// TAXONOMY.md D36), and a mark is met only by what is written.
describe("the objective", () => {
  it("meets no mark of its text while it is empty", () => {
    render(<Harness />);
    expect(met(gc.objectiveQuality.qualitative)).toBe("false");
  });

  it("is one sentence, kept as typed, in any word order", async () => {
    render(<Harness aligned={1} />);
    const box = document.querySelector('[data-cartograph-field="/spec/objectives/0/objective"]') as HTMLTextAreaElement;
    await userEvent.type(box, "Jedes Depot prüft Lieferungen nach einem Standard, durch Schulung");
    expect(box.value).toBe("Jedes Depot prüft Lieferungen nach einem Standard, durch Schulung");
    expect(met(gc.objectiveQuality.qualitative)).toBe("true");
    expect(met(gc.objectiveQuality.aligned)).toBe("true");
  });

  it("is told when it carries a number, which belongs to a key result", async () => {
    render(<Harness initial="Cut losses to 5 percent" />);
    expect(met(gc.objectiveQuality.qualitative)).toBe("false");
  });
});

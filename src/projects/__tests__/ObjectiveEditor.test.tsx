/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "@/copy";
import { ObjectiveEditor } from "../ObjectiveEditor";

const gc = copy.projects.goals;

function Harness({ initial = "", aligned = 0, about }: { initial?: string; aligned?: number; about?: string }) {
  const [objective, setObjective] = useState(initial);
  return <ObjectiveEditor objective={objective} about={about} alignedGoals={aligned} onChange={setObjective} data-cartograph-field="/spec/objectives/0/objective" />;
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

// What the project is about is usually its objective: written in when it
// reads as one, offered with what to change when it does not (#57).
describe("the objective from what the project is about", () => {
  const box = () => document.querySelector('[data-cartograph-field="/spec/objectives/0/objective"]') as HTMLTextAreaElement;

  it("writes it in when it reads as an objective, and can be cleared", async () => {
    render(<Harness about="Every delivery is checked at intake against one standard" />);
    expect(box()).toHaveValue("Every delivery is checked at intake against one standard");
    expect(screen.getByText(gc.objectiveFromAbout)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: gc.objectiveFromAboutUndo }));
    expect(box()).toHaveValue("");
  });

  it("offers it with what to change when it carries numbers", async () => {
    render(<Harness about="Raise the share of crates graded alike to 90% by 2027" />);
    expect(box()).toHaveValue("");
    expect(screen.getByText(gc.objectiveAboutHasNumbers)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: gc.objectiveAboutUse }));
    expect(box()).toHaveValue("Raise the share of crates graded alike to 90% by 2027");
  });

  it("leaves a written objective alone", () => {
    render(<Harness initial="Checks happen at intake" about="Every delivery is checked at intake" />);
    expect(box()).toHaveValue("Checks happen at intake");
    expect(screen.queryByText(gc.objectiveFromAbout)).toBeNull();
  });
});

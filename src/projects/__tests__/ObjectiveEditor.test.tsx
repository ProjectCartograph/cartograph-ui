/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "@/copy";
import { ObjectiveEditor } from "../ObjectiveEditor";

const gc = copy.projects.goals;

type Aim = { state: string; message: string; notJudged?: boolean };

function Harness({ initial = "", aim, about }: { initial?: string; aim?: Aim; about?: string }) {
  const [objective, setObjective] = useState(initial);
  return <ObjectiveEditor objective={objective} about={about} aim={aim} onChange={setObjective} data-cartograph-field="/spec/objectives/0/objective" />;
}

const met = (label: string) => screen.getByText(label).closest("[data-met]")?.getAttribute("data-met");

// The objective is written whole, in the writer's own word order (engine
// TAXONOMY.md D36). Its one mark is the engine's judgement of the text,
// shown with the engine's reason; what the project serves is a link, in
// the checks panel, not a mark of the text (#69).
describe("the objective", () => {
  it("meets no mark of its text while it is empty", () => {
    render(<Harness />);
    expect(met(gc.objectiveQuality.qualitative)).toBe("false");
  });

  it("is one sentence, kept as typed, in any word order", async () => {
    render(<Harness aim={{ state: "ok", message: "Each objective says a change in words, not a figure to reach." }} />);
    const box = document.querySelector('[data-cartograph-field="/spec/objectives/0/objective"]') as HTMLTextAreaElement;
    await userEvent.type(box, "Jedes Depot prüft Lieferungen nach einem Standard, durch Schulung");
    expect(box.value).toBe("Jedes Depot prüft Lieferungen nach einem Standard, durch Schulung");
    expect(met(gc.objectiveQuality.qualitative)).toBe("true");
    expect(screen.getByText("Each objective says a change in words, not a figure to reach.")).toBeInTheDocument();
  });

  it("is told, with the reason, when it reads as a target", () => {
    const why = "Objective 1 likely reads as a target. Say the change the work makes in words, and put the figure in a key result.";
    render(<Harness initial="Cut losses to 5 percent" aim={{ state: "warn", message: why }} />);
    expect(met(gc.objectiveQuality.qualitative)).toBe("false");
    expect(screen.getByText(why)).toBeInTheDocument();
  });

  it("is neither met nor missed when the model did not judge it, and says why", () => {
    const why = "Not judged: whether the objective reads as a target rather than a change in words is the decision model's to judge, and it is off (CARTOGRAPH_DECIDE=off).";
    render(<Harness initial="Every delivery is checked" aim={{ state: "ok", message: why, notJudged: true }} />);
    const mark = screen.getByText(gc.objectiveQuality.qualitative).closest("[data-met]");
    expect(mark?.getAttribute("data-met")).toBe("false");
    expect(mark?.hasAttribute("data-unjudged")).toBe(true);
    expect(screen.getByText(why)).toBeInTheDocument();
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

/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "@/copy";
import { ObjectiveEditor, joinObjective, joinVerb, splitObjective, splitVerb } from "../ObjectiveEditor";

// What the engine's English guide offers for a project objective.
const verbs = ["improve", "close", "standardise"];

function renderEditor(objective = "", alignedGoals = 0) {
  const onChange = vi.fn();
  const view = render(
    <ObjectiveEditor objective={objective} alignedGoals={alignedGoals} onChange={onChange} verbs={verbs} meansWord="by" />,
  );
  return { onChange, view };
}

describe("splitObjective", () => {
  it("round-trips a stored sentence through its two parts", () => {
    const stored = "Improve customer retention by adapting services to changing workplace needs";
    const { outcome, means } = splitObjective(stored);
    expect(outcome).toBe("Improve customer retention");
    expect(means).toBe("by adapting services to changing workplace needs");
    expect(joinObjective(outcome, means)).toBe(stored);
  });

  it("keeps a sentence with no means in the first part", () => {
    const stored = "Make delivery quality visible on the day it happens";
    expect(splitObjective(stored)).toEqual({ outcome: stored, means: "" });
    expect(joinObjective(stored, "")).toBe(stored);
  });

  it("splits on the first 'by' only, so nothing is lost", () => {
    const stored = "Cut rework by standardising checks by depot";
    const { outcome, means } = splitObjective(stored);
    expect(joinObjective(outcome, means)).toBe(stored);
  });
});

describe("splitVerb", () => {
  it("finds an offered verb and keeps the rest as typed, trailing space and all", () => {
    expect(splitVerb("Improve retention ", verbs)).toEqual({ verb: "improve", rest: "retention " });
    expect(joinVerb("improve", "retention ")).toBe("Improve retention ");
  });

  it("keeps an objective that opens with another word whole, with no verb picked", () => {
    expect(splitVerb("Close the gap", verbs)).toEqual({ verb: "close", rest: "the gap" });
    expect(splitVerb("Deliver the pack", verbs)).toEqual({ verb: "", rest: "Deliver the pack" });
    // A language whose guide offers no verbs.
    expect(splitVerb("Close the gap", [])).toEqual({ verb: "", rest: "Close the gap" });
  });

  it("splits the means on the guide's word, or not at all without one", () => {
    expect(splitObjective("Close the gap by checking at intake", "by")).toEqual({ outcome: "Close the gap", means: "by checking at intake" });
    expect(splitObjective("Close the gap by checking at intake", "")).toEqual({ outcome: "Close the gap by checking at intake", means: "" });
  });
});

describe("ObjectiveEditor", () => {
  it("assembles no sentence while it is being written", () => {
    renderEditor();
    expect(document.querySelector('[data-slot="objective-sentence"]')).toBeNull();
  });

  it("stores the verb, the change and the means as the one sentence the contract holds", async () => {
    const user = userEvent.setup();

    // Driven the way the Goals step drives it: one stored string, split
    // into its parts on the way in and joined on the way out.
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <>
          <ObjectiveEditor objective={value} alignedGoals={0} onChange={setValue} verbs={verbs} meansWord="by" />
          <output data-testid="stored">{value}</output>
        </>
      );
    }
    render(<Harness />);

    // The verb is picked from the list; "by" is a fixed prefix on the
    // means. Typing a listed verb in the box leaves it where it was typed.
    const outcome = screen.getByLabelText(copy.projects.goals.objectiveStepOutcome);
    await user.type(outcome, "Improve customer retention");
    expect(outcome).toHaveValue("Improve customer retention");
    await user.type(screen.getByLabelText(copy.projects.goals.objectiveStepMeans), "fixing the intake");

    expect(screen.getByTestId("stored")).toHaveTextContent("Improve customer retention by fixing the intake");
  });

  it("marks only what the engine decides: aligned, and no numbers", () => {
    // Whether it names a change, and how, is for the guidance to say.
    const { view } = renderEditor("Improve customer retention by adapting services", 1);
    expect(view.container.querySelectorAll('[data-slot="quality-marks"] [data-met]')).toHaveLength(2);
    expect(view.container.querySelectorAll('[data-slot="quality-marks"] [data-met="true"]')).toHaveLength(2);
  });

  it("is one line with no means part when the guide offers no words", () => {
    render(<ObjectiveEditor objective="Close the gap" alignedGoals={0} onChange={() => {}} />);
    expect(screen.queryByLabelText(copy.projects.goals.objectiveVerbLabel)).toBeNull();
    expect(screen.queryByLabelText(copy.projects.goals.objectiveStepMeans)).toBeNull();
  });

  it("refuses to light the marks a weak objective fails", () => {
    // Not aligned to any goal, no means, and a number in it: an objective
    // carrying a number is a key result wearing the wrong hat, and the
    // server refuses it. The mark says so before the save does.
    const { view } = renderEditor("Retention at 20 percent", 0);
    const met = view.container.querySelectorAll('[data-slot="quality-marks"] [data-met="true"]');
    expect(met).toHaveLength(0);
  });
});

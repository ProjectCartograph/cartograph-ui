import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AimEditor, splitAim } from "../AimEditor";
import { joinEnd, splitEnd } from "../HorizonPicker";

const verbs = ["raise", "hold", "make sure"];

describe("guided aim", () => {
  it("reads a stored aim back into an offered word and the rest", () => {
    expect(splitAim("Raise what a member earns", verbs)).toEqual({ verb: "raise", rest: "what a member earns" });
    // A sentence that opens with no offered word, or a language with none
    // offered, is kept whole.
    expect(splitAim("Every member is paid on time", verbs)).toEqual({ verb: "", rest: "Every member is paid on time" });
    expect(splitAim("Raise what a member earns", [])).toEqual({ verb: "", rest: "Raise what a member earns" });
  });

  it("judges only what the engine does: numbers belong in the measures", () => {
    const onChange = vi.fn();
    render(<AimEditor level="outcome" value="Produce reaches a depot the same day" onChange={onChange} maxLength={120} />);
    const marks = document.querySelectorAll("[data-met]");
    expect([...marks].map((m) => m.getAttribute("data-met"))).toEqual(["true"]);
    fireEvent.change(screen.getByLabelText("What will be true"), { target: { value: "Cut losses by 20%" } });
    expect(onChange).toHaveBeenCalledWith("Cut losses by 20%");
  });

  it("counts digits in any script", () => {
    render(<AimEditor level="outcome" value="Produce arrives within ٢ days" onChange={() => {}} maxLength={120} />);
    expect(document.querySelector("[data-met]")?.getAttribute("data-met")).toBe("false");
  });

  it("keeps the rest when an objective is typed after its offered word", () => {
    const onChange = vi.fn();
    render(<AimEditor level="objective" verbs={verbs} value="Raise what a member earns" onChange={onChange} maxLength={120} />);
    fireEvent.change(screen.getByLabelText("What changes"), { target: { value: "what a member keeps" } });
    expect(onChange).toHaveBeenLastCalledWith("Raise what a member keeps");
  });

  it("is one line when the guide offers no words", () => {
    render(<AimEditor level="objective" value="Raise what a member earns" onChange={() => {}} maxLength={120} />);
    expect(screen.queryByLabelText("What changes")).toBeNull();
    expect(screen.getByDisplayValue("Raise what a member earns")).toBeInTheDocument();
  });
});

describe("horizon picker", () => {
  it("stores a year alone, or a year and month", () => {
    expect(joinEnd("2025", "whole")).toBe("2025");
    expect(joinEnd("2025", "09")).toBe("2025-09");
    expect(joinEnd("", "09")).toBe("");
    expect(splitEnd("2027-07")).toEqual({ year: "2027", month: "07" });
    expect(splitEnd("2030")).toEqual({ year: "2030", month: "whole" });
  });
});

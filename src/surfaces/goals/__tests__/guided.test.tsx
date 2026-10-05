import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AimEditor } from "../AimEditor";
import { joinEnd, splitEnd } from "../HorizonPicker";

const verbs = ["raise", "hold", "make sure"];

// A statement is written whole, in the writer's own language (engine
// TAXONOMY.md D36); the one mark is what the engine itself decides.
describe("a goal's statement", () => {
  it("judges only what the engine does: numbers belong in the measures", () => {
    const onChange = vi.fn();
    render(<AimEditor level="outcome" value="Produce reaches a depot the same day" onChange={onChange} maxLength={120} />);
    const marks = document.querySelectorAll("[data-met]");
    expect([...marks].map((m) => m.getAttribute("data-met"))).toEqual(["true"]);
    fireEvent.change(screen.getByLabelText("What will be true"), { target: { value: "Cut losses by 20%" } });
    expect(onChange).toHaveBeenCalledWith("Cut losses by 20%");
  });

  it("meets no mark while it is empty", () => {
    render(<AimEditor level="objective" value="" onChange={() => {}} maxLength={120} />);
    expect(document.querySelector("[data-met]")?.getAttribute("data-met")).toBe("false");
  });

  it("counts digits in any script", () => {
    render(<AimEditor level="outcome" value="Produce arrives within ٢ days" onChange={() => {}} maxLength={120} />);
    expect(document.querySelector("[data-met]")?.getAttribute("data-met")).toBe("false");
  });

  it("is one line, kept as typed, with no word picked from a list", () => {
    const onChange = vi.fn();
    render(<AimEditor level="objective" value="Die Qualität in jedem Depot heben" onChange={onChange} maxLength={120} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.change(screen.getByLabelText("What changes"), { target: { value: "Die Qualität überall heben" } });
    expect(onChange).toHaveBeenLastCalledWith("Die Qualität überall heben");
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

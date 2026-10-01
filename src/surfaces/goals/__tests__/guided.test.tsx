import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AimEditor, splitAim } from "../AimEditor";
import { joinEnd, splitEnd } from "../HorizonPicker";

describe("guided aim", () => {
  it("reads a stored aim back into an action and the rest", () => {
    expect(splitAim("Raise every child's reading")).toEqual({ verb: "raise", rest: "every child's reading" });
    expect(splitAim("Institutionalize parental engagement")).toEqual({ verb: "institutionalize", rest: "parental engagement" });
    // A sentence that opens with no listed action is kept whole.
    expect(splitAim("Every child reads")).toEqual({ verb: "", rest: "Every child reads" });
  });

  it("lights the marks for an outcome written as a state", () => {
    const onChange = vi.fn();
    render(<AimEditor level="outcome" value="Pupils who fall behind get help early" onChange={onChange} maxLength={120} />);
    const marks = document.querySelectorAll("[data-met]");
    expect([...marks].map((m) => m.getAttribute("data-met"))).toEqual(["true", "true", "true"]);
    fireEvent.change(screen.getByLabelText("What will be true"), { target: { value: "Raise 90% of pupils" } });
    expect(onChange).toHaveBeenCalledWith("Raise 90% of pupils");
  });

  it("keeps the rest when an objective is typed after its action", () => {
    const onChange = vi.fn();
    render(<AimEditor level="objective" value="Raise every child's reading" onChange={onChange} maxLength={120} />);
    fireEvent.change(screen.getByLabelText("What changes"), { target: { value: "every child's writing" } });
    expect(onChange).toHaveBeenLastCalledWith("Raise every child's writing");
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

/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { copy } from "@/copy";
import { ProposedMark } from "../ProposedMark";

// What the active change set does to a record is marked where the record
// shows, and said to a screen reader; a record it leaves alone carries
// nothing.
describe("the proposed mark", () => {
  it("says new or changed, and nothing otherwise", () => {
    const { rerender } = render(<ProposedMark proposed="new" />);
    expect(screen.getByRole("img", { name: copy.proposed.new })).toBeInTheDocument();
    rerender(<ProposedMark proposed="changed" />);
    expect(screen.getByRole("img", { name: copy.proposed.changed })).toBeInTheDocument();
    rerender(<ProposedMark proposed={undefined} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

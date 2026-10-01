/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "@/copy";
import { NotesField, withNote } from "../NotesField";

const nc = copy.definition.notes;

describe("withNote", () => {
  it("writes a note under the step's own name", () => {
    expect(withNote({}, "risks", "A caveat")).toEqual({ notes: { risks: "A caveat" } });
  });

  it("leaves other steps' notes alone", () => {
    const spec = { notes: { aim: "One", risks: "Two" } };
    expect(withNote(spec, "risks", "Changed")).toEqual({ notes: { aim: "One", risks: "Changed" } });
  });

  it("drops the map with the last note, rather than leaving an empty one", () => {
    // A definition carrying no note must not carry `notes: {}` in its YAML.
    expect(withNote({ notes: { risks: "Two" } }, "risks", undefined)).toEqual({ notes: undefined });
  });

  it("keeps the map while another note remains", () => {
    expect(withNote({ notes: { aim: "One", risks: "Two" } }, "risks", undefined)).toEqual({
      notes: { aim: "One" },
    });
  });
});

describe("the note field", () => {
  it("stays shut until asked for, so a box does not invite prose", () => {
    render(<NotesField value={undefined} onChange={() => {}} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: nc.add })).toBeInTheDocument();
  });

  it("opens already filled when the step has a note", () => {
    render(<NotesField value="Waiting on the legal opinion" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("Waiting on the legal opinion");
  });

  it("reports an emptied note as absent, not as an empty string", async () => {
    const onChange = vi.fn();
    render(<NotesField value="x" onChange={onChange} />);
    await userEvent.clear(screen.getByRole("textbox"));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("closes again when it is left empty", async () => {
    const onChange = vi.fn();
    render(<NotesField value={undefined} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: nc.add }));
    const box = screen.getByRole("textbox");
    expect(box).toHaveFocus();
    await userEvent.tab();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    // Nothing was written: opening a box is not a change.
    expect(onChange).not.toHaveBeenCalled();
  });
});

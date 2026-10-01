import { useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Help } from "@/components/guidance";
import { copy } from "@/copy";

/**
 * The note for one step, and nothing else.
 *
 * Kept closed until there is something in it, because an open box invites
 * prose where a field would have held the same thing in a shape that can
 * be checked. Anything Cartograph has a field for belongs in that field; this
 * is for what it has no field for — a caveat, why a choice was made,
 * something to come back to.
 *
 * Pure: the two stores in this app have different APIs, so each hosts this
 * with its own three lines rather than this reaching for a hook.
 */
export function NotesField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}) {
  const c = copy.definition.notes;
  const [open, setOpen] = useState(Boolean(value));
  const ref = useRef<HTMLTextAreaElement>(null);
  // Opened by hand rather than by loading a note: focus only on the former,
  // or arriving at a step with a note on it would steal the cursor.
  const openedByHand = useRef(false);

  useEffect(() => {
    if (open && openedByHand.current) ref.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start text-muted-foreground"
        onClick={() => {
          openedByHand.current = true;
          setOpen(true);
        }}
      >
        <NotebookPen />
        {c.add}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium" htmlFor="section-note">
          <NotebookPen className="size-4 text-muted-foreground" aria-hidden="true" />
          {c.label}
        </label>
        <Help label={c.label} hint={c.hint} />
      </div>
      <Textarea
        id="section-note"
        ref={ref}
        rows={3}
        maxLength={4000}
        placeholder={c.placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        onBlur={() => {
          // An empty box left behind is not a note; close it rather than
          // keep a widget open for nothing.
          if (!value) {
            openedByHand.current = false;
            setOpen(false);
          }
        }}
      />
    </div>
  );
}

/**
 * Put a note into, or take one out of, a spec's notes map. Removing the
 * last note removes the map, so a definition that carries no note has no
 * empty object in its YAML.
 */
export function withNote<S extends { notes?: Record<string, string> }>(
  spec: S,
  section: string,
  next: string | undefined,
): S {
  const notes = { ...(spec.notes ?? {}) };
  if (next === undefined) delete notes[section];
  else notes[section] = next;
  return { ...spec, notes: Object.keys(notes).length > 0 ? notes : undefined };
}

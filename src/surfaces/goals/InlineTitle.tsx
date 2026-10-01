import { useState } from "react";

import { Input } from "@/components/ui/input";
import { copy } from "@/copy";

const hc = copy.goals.home;

/** A single-line, inline-editable title: click to edit, Enter to save,
 * Escape to cancel. Shared by a pillar card, a strategic goal card and the
 * goal editor's own header (card §5, "inline rename"). */
export function InlineTitle({
  value,
  onSave,
  className,
  as: As = "p",
}: {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  className?: string;
  as?: "p" | "h1";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <As
        role="button"
        tabIndex={0}
        title={hc.renameHint}
        className={`cursor-text truncate ${className ?? ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDraft(value);
          setEditing(true);
        }}
      >
        {value}
      </As>
    );
  }
  return (
    <Input
      autoFocus
      value={draft}
      className="h-7 px-1 py-0"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const next = draft.trim();
          if (next && next !== value) {
            await onSave(next);
          }
          setEditing(false);
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

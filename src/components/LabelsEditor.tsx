import { useState } from "react";
import { Plus, Tag, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy, plusNoun } from "@/copy";

const lc = copy.labels;

/**
 * metadata.labels, edited as chips.
 *
 * Kubernetes' labels, and deliberately theirs: free-form key and value
 * pairs for the cuts somebody wants to make later and nobody anticipated
 * (TAXONOMY.md D11). Nothing validates them, because a fact worth
 * validating is a property with a name and a check.
 *
 * Why a register needs them: twenty-four measures read as chips; a
 * hundred read as a wall. A label is what turns the wall back into
 * sections somebody can look down, and the same key that groups a picker
 * filters an index.
 */
export function LabelsEditor({
  labels,
  onChange,
  idPrefix = "labels",
}: {
  labels: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  idPrefix?: string;
}) {
  const [text, setText] = useState("");
  const entries = Object.entries(labels);

  // Written Kubernetes' way (engine TAXONOMY.md D70): a key alone, such as
  // an internal code, or key=value. Several may be typed at once, apart.
  function add() {
    const next = { ...labels };
    for (const part of text.split(/[,\s]+/)) {
      const [k, ...rest] = part.split("=");
      const key = k.trim();
      if (key) next[key] = rest.join("=").trim();
    }
    onChange(next);
    setText("");
  }

  function remove(k: string) {
    const next = { ...labels };
    delete next[k];
    onChange(next);
  }

  // metadata.labels, the one field this edits. The box holds labels not
  // added yet, so it names no field of its own.
  return (
    <div className="flex flex-col gap-2" data-cartograph-field="/metadata/labels">
      {entries.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(([k, v]) => (
            <Badge
              key={k}
              variant="outline"
              className="h-6 gap-1 pr-1 font-mono"
              data-cartograph-field={`/metadata/labels/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`}
            >
              <Tag aria-hidden="true" />
              <span className="truncate">{v ? `${k}=${v}` : k}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-4"
                aria-label={`${copy.projects.common.remove} ${k}`}
                onClick={() => remove(k)}
              >
                <X />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground" htmlFor={`${idPrefix}-new`}>
          {lc.shown}
          <Input
            id={`${idPrefix}-new`}
            className="font-mono"
            value={text}
            aria-label={lc.keyLabel}
            aria-describedby={`${idPrefix}-hint`}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!text.trim()} aria-label={lc.add}>
          <Plus />
          {plusNoun(lc.add)}
        </Button>
      </div>
      <p id={`${idPrefix}-hint`} className="text-xs text-muted-foreground">{lc.syntax}</p>
    </div>
  );
}

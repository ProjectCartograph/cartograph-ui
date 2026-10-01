import { useState } from "react";
import { Plus, Tag, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";

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
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const entries = Object.entries(labels);

  function add() {
    const k = key.trim();
    if (!k) return;
    onChange({ ...labels, [k]: value.trim() });
    setKey("");
    setValue("");
  }

  function remove(k: string) {
    const next = { ...labels };
    delete next[k];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(([k, v]) => (
            <Badge key={k} variant="outline" className="h-6 gap-1 pr-1">
              <Tag aria-hidden="true" />
              <span className="truncate">{v ? `${k}: ${v}` : k}</span>
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

      <div className="flex items-center gap-2">
        <Input
          id={`${idPrefix}-key`}
          className="w-40"
          value={key}
          placeholder={lc.keyPlaceholder}
          aria-label={lc.keyLabel}
          maxLength={60}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Input
          id={`${idPrefix}-value`}
          className="w-40"
          value={value}
          placeholder={lc.valuePlaceholder}
          aria-label={lc.valueLabel}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!key.trim()}>
          <Plus />
          {lc.add}
        </Button>
      </div>
    </div>
  );
}

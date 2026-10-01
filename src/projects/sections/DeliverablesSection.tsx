import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Help, FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { AcceptanceEditor } from "../AcceptanceEditor";
import { useSectionAutosave, useProjectStore } from "../store";
import type { Deliverable } from "../types";
import { seg } from "../field";

const dc = copy.projects.deliverables;

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Step three: the things this project hands over. Each carries the tests
 * that settle whether it was accepted and the role that applies each one.
 * Those tests are the project's closing lines, read back and adjusted on
 * the Closing step rather than re-authored there; the editor is shared
 * (`AcceptanceEditor`), so both screens edit the one copy.
 */
export function DeliverablesSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const deliverables = store.spec.deliverables ?? [];

  function update(idx: number, patch: Partial<Deliverable>) {
    store.updateSpec((s) => {
      const next = [...(s.deliverables ?? [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...s, deliverables: next };
    });
  }

  function add() {
    store.updateSpec((s) => ({
      ...s,
      deliverables: [...(s.deliverables ?? []), { id: `d-${randomSuffix()}`, name: "" }],
    }));
  }

  function remove(idx: number) {
    store.updateSpec((s) => ({ ...s, deliverables: (s.deliverables ?? []).filter((_, i) => i !== idx) }));
  }

  return (
    <div className="flex flex-col gap-4" data-cartograph-region="deliverables">
      {deliverables.length === 0 ? <p className="text-sm text-muted-foreground">{dc.empty}</p> : null}

      {deliverables.map((d, idx) => (
        <div key={d.id} data-cartograph-region={`deliverable-${idx}`} className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
          <div className="flex items-start gap-3">
            <span className="mt-7 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
              D{idx + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <FieldHeading label={dc.nameLabel} examples={dc.nameExamples} />
              <Input
                data-cartograph-field={`/spec/deliverables/${seg(d, idx)}/name`}
                value={d.name}
                onChange={(e) => {
                  const name = e.target.value.slice(0, 60);
                  update(idx, { name, id: d.id || `d-${slugify(name)}-${randomSuffix()}` });
                }}
                placeholder={dc.namePlaceholder}
                aria-label={dc.nameLabel}
                maxLength={60}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-7"
              onClick={() => remove(idx)}
              aria-label={copy.projects.common.remove}
            >
              <X />
            </Button>
          </div>

          <div className="flex flex-col gap-2 pl-9">
            <div className="flex items-center gap-1">
              <Label>{dc.acceptanceLabel}</Label>
              <Help label={dc.acceptanceLabel} hint={dc.acceptanceHint} examples={dc.acceptanceExamples} />
            </div>
            <AcceptanceEditor index={idx} />
          </div>

          <div className="flex flex-col gap-2 pl-9">
            <FieldHeading label={dc.descriptionLabel} hint={dc.descriptionHint} examples={dc.descriptionExamples} />
            <Textarea
              data-cartograph-field={`/spec/deliverables/${seg(d, idx)}/description`}
              value={d.description ?? ""}
              onChange={(e) => update(idx, { description: e.target.value.slice(0, 240) })}
              placeholder={dc.descriptionPlaceholder}
              aria-label={dc.descriptionLabel}
              maxLength={240}
              rows={2}
            />
            <p className="self-end text-xs text-muted-foreground">{240 - (d.description ?? "").length} left</p>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" className="self-start border-dashed" onClick={add}>
        <Plus />
        {dc.add}
      </Button>
    </div>
  );
}

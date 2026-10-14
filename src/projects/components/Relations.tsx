import { Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LucideIcon } from "lucide-react";

/** One item a relation holds, as a chip. */
export interface RelationItem {
  key: string;
  name: string;
  icon?: LucideIcon;
  /** Shown on hover: why it is here, or where it was recorded. */
  title?: string;
  /** Marks beside the name (critical path, most depended on, a loop). */
  marks?: ReactNode;
  /** Removing it; absent when it is changed elsewhere. */
  onRemove?: () => void;
  removeLabel?: string;
}

/**
 * A relation of this record, shown as itself rather than asked about: an
 * icon and its noun, how many, the items as chips, and an add button that
 * opens the picker. Empty is the answer "none"; nobody is asked a yes or
 * no question to reach the picker.
 */
export function RelationRow({
  icon: Icon,
  label,
  hint,
  items,
  empty,
  addLabel,
  addTitle,
  picker,
  wide,
  slot,
}: {
  icon: LucideIcon;
  label: string;
  /** What the relation is, in one sentence, on hover and for screen readers. */
  hint: string;
  items: RelationItem[];
  empty: string;
  /** A short noun for the add button; the full sentence is addTitle. */
  addLabel?: string;
  addTitle?: string;
  /** The picker the add button opens. */
  picker?: ReactNode;
  wide?: boolean;
  slot: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4" data-slot={slot}>
      <div className="flex w-40 shrink-0 items-center gap-2 pt-1" title={hint}>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
        <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground" aria-label={`${items.length}`}>
          {items.length}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {items.length === 0 ? <span className="pt-1 text-sm text-muted-foreground">{empty}</span> : null}
        {items.map((it) => {
          const ItemIcon = it.icon;
          return (
            <span key={it.key} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-sm" title={it.title} data-relation-item={it.key}>
              {ItemIcon ? <ItemIcon className="size-3.5 text-muted-foreground" aria-hidden="true" /> : null}
              {it.name}
              {it.marks}
              {it.onRemove ? (
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={it.onRemove}
                  aria-label={it.removeLabel}
                  title={it.removeLabel}
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </span>
          );
        })}
        {picker && addLabel ? (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1" onClick={() => setOpen(true)} aria-label={addTitle} title={addTitle} data-relation-add={slot}>
            <Plus />
            {addLabel}
          </Button>
        ) : null}
      </div>
      {picker ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className={wide ? "sm:max-w-5xl" : "sm:max-w-lg"} data-cartograph-region={`${slot}-picker`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </DialogTitle>
              <DialogDescription>{hint}</DialogDescription>
            </DialogHeader>
            {picker}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

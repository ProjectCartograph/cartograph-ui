import { useMemo, useState } from "react";
import { Check, ChevronRight, Eye, Plus, Search, Sparkles } from "lucide-react";

import { copy } from "@/copy";
import { SparkleBurst } from "@/components/Sparkle";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RecordPreview } from "@/records/RecordPreview";

/**
 * One pickable thing. Where the register it comes from has a shape, the
 * chip says where it sits: `group` is the outer branch (a pillar) and
 * `tag` the inner one (a strategic area). Both are headings when they are
 * present, never words repeated on every chip.
 */
export interface ChipItem {
  id: string;
  label: string;
  /** The outer branch. Given on every item or on none. */
  group?: string;
  /** The inner branch. A heading when `group` is set; otherwise a word
   * beside the chip, for a flat register that still needs one. */
  tag?: string;
  title?: string;
  /** Named just now, in the flow on screen: marked as new while it lasts. */
  isNew?: boolean;
  /** Named this moment: it sparkles as it appears. */
  fresh?: boolean;
}

/** Past this many items, branches start closed: a register longer than a
 * handful of rows reads faster as its headings. */
const LONG_REGISTER = 5;

interface Branch {
  name: string;
  areas: { name: string; items: ChipItem[] }[];
}

/**
 * Pick from a register, as chips.
 *
 * Grouped where the register has a shape: a project aligns to a goal, and
 * a goal sits somewhere. The Programme Lead's rule of 2026-09-26 took the
 * tree off this step because two of its three levels cannot be picked;
 * the correction the same day is that removing the levels is not the same
 * as removing the structure. The two levels are headings now, quiet ones,
 * so a person reads down the shape of the plan and picks inside it,
 * instead of scanning a wall of chips for the one they mean.
 *
 * The ancestry lives in the headings, so a chip carries its own name and
 * nothing else. Search still matches a goal, its area or its pillar, and
 * a branch with no match left in it disappears whole.
 */
export function ChipPicker({
  items,
  selected,
  onToggle,
  placeholder,
  addLabel,
  onAdd,
  empty,
  slot,
  groupIcon,
  areaIcon,
  previewKind,
  "data-cartograph-field": field,
}: {
  items: ChipItem[];
  selected: string[];
  onToggle: (id: string) => void;
  placeholder: string;
  /** Read out for the add button; shown as a label beside its plus. */
  addLabel?: string;
  onAdd?: () => void;
  /** Shown when the register itself is empty, or nothing matches. */
  empty: string;
  slot?: string;
  /** Marks beside the two headings, so a branch is found by shape as well
   * as by its name. */
  groupIcon?: React.ReactNode;
  areaIcon?: React.ReactNode;
  /** The kind the items are, when each can be read in a preview before it
   * is picked (#28). */
  previewKind?: string;
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string;
}) {
  const [search, setSearch] = useState("");
  const grouped = items.some((c) => c.group);
  // Each branch opened or closed by hand. Otherwise a short register shows
  // whole, and a long one reads as its headings, opening only the branches
  // that hold a pick, or all while searching (#29).
  const [toggled, setToggled] = useState<Map<string, boolean>>(new Map());
  const long = items.length > LONG_REGISTER;

  // A picked chip is never filtered away: losing sight of the selection is
  // what the old second panel existed to prevent.
  const matching = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    const has = (s: string | undefined) => (s ?? "").toLowerCase().includes(term);
    return items.filter(
      (c) => selected.includes(c.id) || has(c.label) || has(c.tag) || has(c.group),
    );
  }, [items, selected, search]);

  // Branches in register order, each keeping only the areas that still
  // have something in them.
  const branches = useMemo<Branch[]>(() => {
    if (!grouped) return [];
    const out: Branch[] = [];
    for (const item of matching) {
      const groupName = item.group ?? "";
      let branch = out.find((b) => b.name === groupName);
      if (!branch) {
        branch = { name: groupName, areas: [] };
        out.push(branch);
      }
      const areaName = item.tag ?? "";
      let area = branch.areas.find((a) => a.name === areaName);
      if (!area) {
        area = { name: areaName, items: [] };
        branch.areas.push(area);
      }
      area.items.push(item);
    }
    return out;
  }, [matching, grouped]);

  function chip(c: ChipItem, withTag: boolean) {
    const isPicked = selected.includes(c.id);
    return (
      <button
        key={c.id}
        type="button"
        data-chip-id={c.id}
        aria-pressed={isPicked}
        title={c.title ?? c.tag}
        onClick={() => onToggle(c.id)}
        className={`cartograph-pick relative inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
          isPicked ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
        } ${c.isNew ? "cartograph-new" : ""}`}
        data-new={c.isNew ? "" : undefined}
      >
        {c.fresh ? <SparkleBurst /> : null}
        {c.isNew ? <Sparkles className="size-3.5 shrink-0 text-new" aria-label={copy.common.isNew} /> : null}
        {isPicked ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        <span className="truncate">{c.label}</span>
        {withTag && c.tag ? (
          <span className={`truncate text-xs ${isPicked ? "opacity-75" : "text-muted-foreground"}`}>{c.tag}</span>
        ) : null}
      </button>
    );
  }

  /** One pickable thing, at the weight it deserves: a full-width row with
   * its own mark, not a chip in a wrap. A goal is what a whole project
   * aligns to (Programme Lead, 2026-09-26). */
  function row(c: ChipItem, position: "first" | "middle" | "only" | "last") {
    const isPicked = selected.includes(c.id);
    const rounded =
      position === "only"
        ? "rounded-lg"
        : position === "first"
          ? "rounded-t-lg"
          : position === "last"
            ? "rounded-b-lg"
            : "";
    const pick = (
      <button
        key={c.id}
        type="button"
        data-chip-id={c.id}
        aria-pressed={isPicked}
        title={c.title}
        onClick={() => onToggle(c.id)}
        className={`cartograph-pick relative flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors ${rounded} ${
          position === "middle" || position === "last" ? "-mt-px" : ""
        } ${isPicked ? "z-10 border-primary bg-accent" : "hover:bg-accent/50"} ${c.isNew ? "cartograph-new z-20" : ""}`}
        data-new={c.isNew ? "" : undefined}
      >
        {c.fresh ? <SparkleBurst /> : null}
        <span
          aria-hidden="true"
          className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
            isPicked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
          }`}
        >
          {isPicked ? <Check className="size-3" /> : null}
        </span>
        <span id={`chip-label-${c.id}`} className={`min-w-0 flex-1 text-sm text-pretty ${isPicked ? "font-medium" : ""}`}>{c.label}</span>
        {c.isNew ? <Sparkles className="size-4 shrink-0 text-new" aria-label={copy.common.isNew} /> : null}
      </button>
    );
    if (!previewKind) return pick;
    return (
      <div key={c.id} className="group/row relative flex items-stretch">
        <div className="min-w-0 flex-1">{pick}</div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="absolute top-1/2 right-2 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={copy.recordPreview.short}
              aria-describedby={`chip-label-${c.id}`}
              title={copy.recordPreview.label(c.label)}
            >
              <Eye className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="end">
            <RecordPreview kind={previewKind} id={c.id} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-slot={slot} data-cartograph-field={field}>
      <div className="flex items-center gap-2">
        <InputGroup className="h-8 max-w-xs">
          <InputGroupAddon>
            <Search className="size-3.5" />
          </InputGroupAddon>
          {/* A placeholder is not a name: it is the only thing labelling
              this box, and it disappears the moment somebody types. Every
              picker in the app is this one, so naming it here names all of
              them. */}
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
          />
        </InputGroup>
        {onAdd ? (
          <Button type="button" variant="ghost" size="sm" onClick={onAdd} aria-label={addLabel} title={addLabel}>
            <Plus />
          </Button>
        ) : null}
      </div>

      {matching.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : null}

      {grouped ? (
        <div className="flex flex-col gap-4">
          {branches.map((branch) => {
            const pickedHere = branch.areas.reduce(
              (n, a) => n + a.items.filter((c) => selected.includes(c.id)).length,
              0,
            );
            const open = search.trim() ? true : (toggled.get(branch.name) ?? (!long || pickedHere > 0));
            return (
              <section key={branch.name} className="flex flex-col gap-3" data-slot="chip-group" data-open={open ? "" : undefined}>
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  aria-expanded={open}
                  onClick={() => setToggled((m) => new Map(m).set(branch.name, !open))}
                >
                  <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`} aria-hidden="true" />
                  {groupIcon ? <span className="text-muted-foreground">{groupIcon}</span> : null}
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{branch.name}</h3>
                  {/* How many of this branch's goals are served, as a number
                      rather than a sentence: the one cue that lets a person
                      find their way back to what they have already picked. */}
                  {pickedHere > 0 ? (
                    <span
                      className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground"
                      data-slot="chip-group-count"
                    >
                      {pickedHere}
                    </span>
                  ) : null}
                  {!open ? <span className="text-xs text-muted-foreground">{branch.areas.reduce((n, a) => n + a.items.length, 0)}</span> : null}
                  <span aria-hidden className="h-px flex-1 bg-border" />
                </button>
                {open ? (
                <div className="ml-1 flex flex-col gap-4 border-l pl-4">
                  {branch.areas.map((area) => (
                    <div key={area.name} className="flex flex-col gap-2" data-slot="chip-area">
                      <div className="flex items-center gap-1.5">
                        {areaIcon ? <span className="text-muted-foreground">{areaIcon}</span> : null}
                        <p className="text-sm font-medium">{area.name}</p>
                      </div>
                      <div className="flex flex-col">
                        {area.items.map((c, i) =>
                          row(
                            c,
                            area.items.length === 1
                              ? "only"
                              : i === 0
                                ? "first"
                                : i === area.items.length - 1
                                  ? "last"
                                  : "middle",
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        // A flat register (no branches to read down): picked first, so the
        // selection stays together at the front.
        <div className="flex flex-wrap gap-2">
          {[
            ...matching.filter((c) => selected.includes(c.id)),
            ...matching.filter((c) => !selected.includes(c.id)),
          ].map((c) => chip(c, true))}
        </div>
      )}
    </div>
  );
}

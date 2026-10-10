import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { defaultFilter } from "cmdk";
import { Check, FolderSearch, Search } from "lucide-react";

import { useClient } from "@/client/context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";
import { RecordPreview } from "./RecordPreview";

const pk = copy.recordPicker;

/**
 * Choosing records with each one readable before it is chosen (#28): the
 * list, searchable, on the left; the highlighted record's preview on the
 * right. Arrow keys move, Space chooses or unchooses, Enter is done.
 */
export function PickerDialog(props: PickerProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { open, onOpenChange, title, multiple } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" data-cartograph-region="record-picker">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{multiple ? pk.hintMany : pk.hintOne}</DialogDescription>
        </DialogHeader>
        {/* Mounted afresh on each opening, starting from what is chosen now. */}
        {open ? <PickerBody {...props} close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

type PickerProps = {
  kind: string;
  title: string;
  multiple: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
  /** The ids that may be chosen, where fewer than every record may. */
  only?: ReadonlySet<string>;
};

function PickerBody({ kind, title, multiple, selected, onChange, only, close }: PickerProps & { close: () => void }) {
  const client = useClient();
  const list = useQuery({ queryKey: ["picker", kind], queryFn: () => client.list(kind) });
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string[]>(selected);
  const [pointed, setPointed] = useState<string | undefined>(undefined);
  const listRef = useRef<HTMLUListElement>(null);

  const rows = useMemo(() => {
    const all = (list.data ?? []).filter((r) => !only || only.has(r.id));
    const q = query.trim();
    return q ? all.filter((r) => defaultFilter(r.name, q, Object.values(r.labels ?? {})) > 0) : all;
  }, [list.data, query, only]);
  // The row read in the preview: the one pointed at, else the first.
  const at = rows.some((r) => r.id === pointed) ? pointed : rows[0]?.id;

  function toggle(id: string) {
    if (!multiple) {
      onChange([id]);
      close();
      return;
    }
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }
  function move(d: number) {
    const i = rows.findIndex((r) => r.id === at);
    const next = rows[Math.min(rows.length - 1, Math.max(0, i + d))];
    if (next) {
      setPointed(next.id);
      listRef.current?.querySelector(`[data-row="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }
  function done() {
    onChange(chosen);
    close();
  }

  return (
    <>
      <div className="grid min-h-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label={pk.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
                if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
                if (e.key === " " && multiple && at && !query.endsWith(" ")) { e.preventDefault(); toggle(at); }
                if (e.key === "Enter") { e.preventDefault(); if (multiple) done(); else if (at) toggle(at); }
              }}
            />
          </div>
          <ul ref={listRef} role="listbox" aria-label={title} aria-multiselectable={multiple} className="flex max-h-[55vh] flex-col overflow-y-auto rounded-lg p-1 ring-1 ring-foreground/10">
            {list.isLoading ? <li className="p-2 text-sm text-muted-foreground">{pk.loading}</li> : null}
            {!list.isLoading && rows.length === 0 ? <li className="p-2 text-sm text-muted-foreground">{query ? pk.noMatch : pk.empty}</li> : null}
            {rows.map((r) => {
              const on = chosen.includes(r.id);
              return (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={on}
                  data-row={r.id}
                  data-at={r.id === at ? "" : undefined}
                  onMouseEnter={() => setPointed(r.id)}
                  onFocus={() => setPointed(r.id)}
                  onClick={() => toggle(r.id)}
                  className={`flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm ${r.id === at ? "bg-muted" : ""}`}
                >
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30"}`} aria-hidden="true">
                    {on ? <Check className="size-3" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="max-h-[60vh] min-w-0 overflow-y-auto rounded-lg p-3 ring-1 ring-foreground/10" aria-live="polite">
          {at ? <RecordPreview kind={kind} id={at} /> : <p className="text-sm text-muted-foreground">{pk.previewEmpty}</p>}
        </div>
      </div>
      {multiple ? (
        <DialogFooter>
          <span className="mr-auto self-center text-sm text-muted-foreground">{pk.chosen(chosen.length)}</span>
          <Button type="button" variant="outline" onClick={close}>
            {pk.cancel}
          </Button>
          <Button type="button" onClick={done}>
            <Check />
            {pk.done}
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}

/** A button that opens the picker: icon and a short noun, the full
 * sentence as its name. */
export function BrowseButton(props: PickerProps) {
  const [open, setOpen] = useState(false);
  const kindLabel = copy.sheets.kindsSingular[props.kind] ?? props.kind;
  return (
    <>
      <Button type="button" variant="outline" size="icon-sm" onClick={() => setOpen(true)} aria-label={pk.browseLabel(kindLabel)} title={pk.browseLabel(kindLabel)} data-cartograph-region="browse">
        <FolderSearch />
      </Button>
      <PickerDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}

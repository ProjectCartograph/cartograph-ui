import { useMemo, useState } from "react";
import { ArrowRight, Hourglass } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Suggested } from "@/components/relevance";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { copy } from "@/copy";
import { useProjectStore } from "@/projects/store";
import { NEW_OPERATION_ID } from "@/projects/types";
import { type RefOption, useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";

const lc = copy.projects.landing;

const OPERATION_PATH = "/spec/operation";

/**
 * "Lands in": the service that runs the result. A new service is defined
 * from New, in its own walk, never here (TAXONOMY.md D30, D31). When it is
 * not defined yet, the person records a placeholder by its name and
 * carries on: the step says what it waits on, offers to define it, and,
 * once it is, to name it here in one step. Projects saved before 2.7
 * named the literal "new"; it still reads, under its own label.
 */
export function LandsInField({ resolve }: { resolve?: string }) {
  const store = useProjectStore();
  const { data } = useReferenceOptions("Operation");
  const current = store.spec.operation || undefined;
  const waiting = store.pending.find((p) => p.path === OPERATION_PATH);
  const others = store.pending.filter((p) => p.path !== OPERATION_PATH);

  const options = useMemo<RefOption[]>(
    () => [...(current === NEW_OPERATION_ID ? [{ value: NEW_OPERATION_ID, label: lc.legacyNewOperation }] : []), ...(data?.options ?? [])],
    [data, current],
  );
  // Naming the service ends the placeholder that held its place.
  const set = (next?: string) => {
    store.updateSpec((s) => ({ ...s, operation: next ?? "" }));
    if (next && waiting) store.setPending(others);
  };
  const resolvedName = resolve ? data?.names.get(resolve) : undefined;
  return (
    <div className="flex flex-col gap-3">
      {waiting ? (
        <WaitingOn
          name={waiting.name}
          projectId={store.id}
          onRemove={() => store.setPending(others)}
          ready={resolve && resolvedName ? { name: resolvedName, onName: () => set(resolve) } : undefined}
        />
      ) : null}
      <Suggested kind="Operation" selected={current ? [current] : []} onPick={(id) => set(id === current ? undefined : id)} />
      <div className="flex items-center gap-2">
        <Combobox
          options={options}
          value={current}
          onValueChange={set}
          placeholder={lc.operationPlaceholder}
          emptyText={copy.sheets.dialog.noMatches}
          clearLabel={copy.common.clear}
          aria-label={lc.landsInTitle}
          data-cartograph-field="/spec/operation"
        />
        {!current && !waiting ? (
          <NotDefinedYet onAdd={(name) => store.setPending([...others, { path: OPERATION_PATH, kind: "Operation", name }])} />
        ) : null}
      </div>
    </div>
  );
}

/** The placeholder, as the step shows it: what it waits on, and the way to
 * define it; once defined, the one step that names it here. */
function WaitingOn({
  name,
  projectId,
  onRemove,
  ready,
}: {
  name: string;
  projectId: string;
  onRemove: () => void;
  ready?: { name: string; onName: () => void };
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-warning/10 p-3 ring-1 ring-inset ring-warning/35" data-slot="pending" data-pending-path={OPERATION_PATH}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Hourglass className="size-4 shrink-0 text-warning" aria-hidden="true" />
        {lc.waitingOn(name)}
      </p>
      {ready ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={ready.onName}>
            {lc.nameIt(ready.name)}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/operations/new" search={{ status: "planned", name, for: projectId }}>
              {lc.defineIt}
              <ArrowRight />
            </Link>
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            {lc.removePlaceholder}
          </Button>
        </div>
      )}
    </div>
  );
}

/** "Not defined yet": a placeholder by the service's name, so the person
 * can carry on and knows what to come back to. */
function NotDefinedYet({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-slot="not-defined-yet">
          <Hourglass />
          {lc.notDefinedYet}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3">
        <p className="text-sm text-muted-foreground">{lc.notDefinedYetHint}</p>
        <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 160))} aria-label={lc.placeholderName} autoFocus />
        <Button
          type="button"
          size="sm"
          disabled={!name.trim()}
          onClick={() => {
            onAdd(name.trim());
            setName("");
            setOpen(false);
          }}
        >
          {lc.holdItsPlace}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

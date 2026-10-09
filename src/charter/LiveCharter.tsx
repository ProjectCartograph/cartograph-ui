import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MoreHorizontal, PencilLine, Undo2 } from "lucide-react";

import { useClient } from "@/client/context";
import type { CharterPart } from "@/client/port";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";

const lc = copy.charter.live;

/** A field a part holds, with the label the charter prints it under. */
interface PartField {
  path: string;
  label: string;
}

/** The fields a part's HTML holds, each with the label printed before it. */
function fieldsOf(part: CharterPart): PartField[] {
  if (part.fields.length === 0) return [];
  const doc = new DOMParser().parseFromString(`<div>${part.html}</div>`, "text/html");
  return part.fields.map((path) => {
    const dd = doc.querySelector(`[data-field="${CSS.escape(path)}"]`);
    const dt = dd?.previousElementSibling;
    return { path, label: dt?.textContent?.trim() || path };
  });
}

/**
 * The charter as a document of parts, beside the walk (engine TAXONOMY.md
 * D55): each section the engine renders, in order, drawn from the same
 * renderer as the PDF, a placeholder where nothing is said yet. Every part
 * has a menu (its button, a right click, Shift+F10 or the menu key) of its
 * step and the fields it holds; a field opens in place, with the step's
 * open checks beside it, and saves to the change set like any edit. The
 * charter follows the walk, and a part opens its step.
 */
export function LiveCharter({
  id,
  version,
  step,
  onStep,
  onField,
  valueOf,
  checksOf,
}: {
  id: string;
  /** Changes whenever the draft does, to read the parts again. */
  version: unknown;
  /** The walk's current step, which the charter scrolls to. */
  step?: string;
  onStep: (step: string) => void;
  onField: (path: string, value: string) => void;
  /** A field's text as the draft holds it now. */
  valueOf: (path: string) => string;
  /** The open checks a step's fields answer, in words. */
  checksOf: (step: string) => string[];
}) {
  const client = useClient();
  const queries = useQueryClient();
  const parts = useQuery({ queryKey: ["charter-parts", id], queryFn: () => client.charterParts(id) });
  // Read again a moment after the draft changes, for everyone in the
  // change set: their edits and this person's alike.
  useEffect(() => {
    const t = setTimeout(() => void queries.invalidateQueries({ queryKey: ["charter-parts", id] }), 900);
    return () => clearTimeout(t);
  }, [version, id, queries]);
  const [editing, setEditing] = useState<{ part: number; field: PartField } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const blocks = useRef<(HTMLElement | null)[]>([]);
  // The walk moves the document: the first part its step writes.
  useEffect(() => {
    if (!step || !parts.data) return;
    const at = parts.data.findIndex((p) => p.step === step);
    blocks.current[at]?.scrollIntoView?.({ block: "nearest" });
  }, [step, parts.data]);

  if (parts.isLoading) return <Skeleton className="h-96 w-full" />;
  if (parts.isError || !parts.data) return <p className="text-sm text-muted-foreground">{copy.charter.empty}</p>;

  return (
    <div className="flex flex-col gap-3" data-cartograph-region="live-charter">
      {parts.data.map((part, i) => (
        <Part
          key={`${part.title}-${i}`}
          part={part}
          current={!!step && part.step === step}
          menuOpen={menu === i}
          onMenu={(open) => setMenu(open ? i : null)}
          refBlock={(el) => {
            blocks.current[i] = el;
          }}
          onStep={onStep}
          onEdit={(field) => setEditing({ part: i, field })}
          editing={editing?.part === i ? editing.field : null}
          panel={
            editing?.part === i ? (
              <FieldPanel
                field={editing.field}
                value={valueOf(editing.field.path)}
                checks={part.step ? checksOf(part.step) : []}
                onSave={(v) => {
                  onField(editing.field.path, v);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : null
          }
        />
      ))}
    </div>
  );
}

function Part({
  part,
  current,
  menuOpen,
  onMenu,
  refBlock,
  onStep,
  onEdit,
  editing,
  panel,
}: {
  part: CharterPart;
  current: boolean;
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
  refBlock: (el: HTMLElement | null) => void;
  onStep: (step: string) => void;
  onEdit: (field: PartField) => void;
  editing: PartField | null;
  panel: React.ReactNode;
}) {
  const fields = useMemo(() => fieldsOf(part), [part]);
  return (
    <article
      ref={refBlock}
      tabIndex={0}
      aria-label={part.title}
      data-part-step={part.step}
      data-part-empty={part.empty || undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(true);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
          e.preventDefault();
          onMenu(true);
        }
      }}
      className={`group rounded-lg border bg-card p-3 outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-ring ${current ? "ring-2 ring-primary/40" : ""} ${part.empty ? "border-dashed" : ""}`}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{part.title}</h3>
        <DropdownMenu open={menuOpen} onOpenChange={onMenu}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={lc.menu(part.title)} title={lc.menu(part.title)}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {part.step ? (
              <DropdownMenuItem onSelect={() => onStep(part.step!)}>
                <Undo2 />
                {lc.openStep}
              </DropdownMenuItem>
            ) : null}
            {fields.length > 0 && part.step ? <DropdownMenuSeparator /> : null}
            {fields.map((f) => (
              <DropdownMenuItem key={f.path} onSelect={() => onEdit(f)}>
                <PencilLine />
                {lc.edit(f.label)}
              </DropdownMenuItem>
            ))}
            {!part.step && fields.length === 0 ? <DropdownMenuItem disabled>{lc.nothing}</DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      {part.empty ? (
        <p className="mt-1 text-sm text-muted-foreground">{lc.placeholder}</p>
      ) : (
        <div
          className="charter-part mt-2 text-sm [&_dd]:mb-2 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_table]:w-full [&_td]:border-t [&_td]:p-1 [&_th]:p-1 [&_th]:text-left [&_th]:text-xs [&_[data-field]]:cursor-text [&_[data-field]]:rounded [&_[data-field]:hover]:bg-muted"
          // The engine writes this HTML, every value escaped, from the same
          // renderer as the charter's PDF (engine render/document.go).
          dangerouslySetInnerHTML={{ __html: part.html }}
          onClick={(e) => {
            const el = (e.target as HTMLElement).closest<HTMLElement>("[data-field]");
            const f = el && fields.find((x) => x.path === el.dataset.field);
            if (f) onEdit(f);
          }}
        />
      )}
      {editing ? panel : null}
    </article>
  );
}

/** A field as it is, edited in place, with the checks its step answers. */
function FieldPanel({
  field,
  value,
  checks,
  onSave,
  onCancel,
}: {
  field: PartField;
  value: string;
  checks: string[];
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md bg-muted/40 p-2" role="group" aria-label={lc.panel(field.label)} data-field-panel={field.path}>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {field.label}
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim()) onSave(text.trim());
            }
            if (e.key === "Escape") onCancel();
          }}
          className="min-h-16 text-sm text-foreground"
          data-cartograph-field={field.path}
        />
      </label>
      {checks.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground" aria-label={lc.checks}>
          {checks.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={!text.trim()} onClick={() => onSave(text.trim())} aria-label={lc.save(field.label)}>
          <Check />
          {lc.saveShort}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {lc.cancel}
        </Button>
      </div>
    </div>
  );
}

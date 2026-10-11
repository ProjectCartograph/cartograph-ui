import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { TimingField } from "@/projects/TimingField";
import type { Timing } from "@/projects/types";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { getAt } from "./pointer";
import { editorAt, schemaAt, type Editor } from "./schemaAt";
import { wordsOf } from "./words";

const dc = copy.charter.doc;


type RenderParty = (value: unknown, onChange: (v: unknown) => void) => ReactNode;

/**
 * One value's editor, by what the contract says it is: a choice as its
 * options, a reference or a party as its picker, a number, a date or a
 * timing as their own controls, text as a field. Each change is kept as it
 * is made, as a document keeps it.
 */
export function FieldEditor({
  editor,
  label,
  value,
  renderParty,
  onChange,
  onDone,
  compact = false,
  field,
}: {
  editor: Editor;
  label: string;
  value: unknown;
  renderParty: RenderParty;
  onChange: (v: unknown) => void;
  onDone?: () => void;
  /** Inside a source panel: one line, no heading. */
  compact?: boolean;
  field?: string;
}) {
  const heading = compact ? null : <p className="mb-2 pr-6 text-xs font-medium text-muted-foreground">{label}</p>;
  switch (editor.kind) {
    case "choice":
      return (
        <div>
          {heading}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
            {editor.values.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={value === v}
                onClick={() => (onChange(v), onDone?.())}
                className={`rounded-full px-2.5 py-0.5 text-xs ring-1 transition-colors ${value === v ? "bg-primary/10 font-medium text-primary ring-primary/30" : "ring-foreground/15 hover:bg-muted"}`}
              >
                {wordsOf(v)}
              </button>
            ))}
          </div>
        </div>
      );
    case "ref":
      return (
        <div>
          {heading}
          <ReferencePicker refKind={editor.refKind} value={typeof value === "string" ? value : undefined} onChange={(v) => onChange(v)} label={label} data-cartograph-field={field} />
        </div>
      );
    case "refs":
      return (
        <div>
          {heading}
          <RefList refKind={editor.refKind} value={Array.isArray(value) ? (value as string[]) : []} label={label} onChange={onChange} />
        </div>
      );
    case "party":
      return (
        <div>
          {heading}
          {renderParty(value, onChange)}
        </div>
      );
    case "timing":
      return <TimingField value={value as Timing | undefined} onChange={(v) => onChange(v)} field={field ?? ""} label={label} />;
    case "number":
      return (
        <div>
          {heading}
          <Input type="number" aria-label={label} defaultValue={typeof value === "number" ? value : ""} autoFocus={!compact} onBlur={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), onDone?.())} />
        </div>
      );
    case "date":
      return (
        <div>
          {heading}
          <Input type={editor.month ? "month" : "date"} aria-label={label} defaultValue={typeof value === "string" ? value : ""} autoFocus={!compact} onChange={(e) => onChange(e.target.value || undefined)} />
        </div>
      );
    case "flag":
      return (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {label}
        </label>
      );
    default: {
      const text = typeof value === "string" ? value : "";
      const long = editor.kind === "text" && editor.long;
      return (
        <div>
          {heading}
          {long ? (
            <Textarea aria-label={label} defaultValue={text} rows={2} onBlur={(e) => onChange(e.target.value.trim() || undefined)} />
          ) : (
            <Input aria-label={label} defaultValue={text} onBlur={(e) => onChange(e.target.value.trim() || undefined)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
          )}
        </div>
      );
    }
  }
}

/** Several references: each named, with a mark to take it off, and a
 * picker for the next. */
function RefList({ refKind, value, label, onChange }: { refKind: string; value: string[]; label: string; onChange: (v: unknown) => void }) {
  const names = useReferenceOptions(refKind).data?.names;
  const [picking, setPicking] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-1.5">
        {value.map((id) => (
          <li key={id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs">
            {names?.get(id) ?? id}
            <button type="button" aria-label={dc.removeOne(names?.get(id) ?? id)} title={dc.removeOne(names?.get(id) ?? id)} onClick={() => onChange(value.filter((v) => v !== id))}>
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <ReferencePicker key={picking} refKind={refKind} value={undefined} label={label} onChange={(v) => v && !value.includes(v) && (onChange([...value, v]), setPicking((n) => n + 1))} />
    </div>
  );
}

/** What names an item in a list, for its heading in a source panel. */
const NAME_KEYS = ["name", "title", "metric", "statement", "description", "action", "category", "label"];

/**
 * What a worked-out value comes from, edited where it is shown: a start
 * date's milestones, a budget's funding lines. Each item with its own
 * values, each as its own editor, the change kept as it is made.
 */
export function SourceEditor({
  path,
  label,
  spec,
  schema,
  renderParty,
  onChange,
}: {
  path: string;
  label: string;
  spec: Record<string, unknown>;
  schema: unknown;
  renderParty: RenderParty;
  onChange: (path: string, v: unknown) => void;
}) {
  const value = getAt(spec, path);
  const s = schemaAt(schema as never, path);
  const where = wordsOf(path.split("/").filter((k) => !/^\d+$/.test(k)).pop() ?? "").toLowerCase();
  const items: { at: string; item: Record<string, unknown> }[] = Array.isArray(value)
    ? value.map((item, i) => ({ at: `${path}/${i}`, item: (item ?? {}) as Record<string, unknown> }))
    : value && typeof value === "object"
      ? [{ at: path, item: value as Record<string, unknown> }]
      : [];
  const props = Object.keys((Array.isArray(value) || s?.type === "array" ? s?.items?.properties : s?.properties) ?? {}).filter((k) => k !== "id");
  return (
    <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
      <p className="pr-6 text-xs font-medium text-muted-foreground">{dc.from(label, where)}</p>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">{dc.noneYet}</p> : null}
      {items.map(({ at, item }, n) => {
        const name = NAME_KEYS.map((k) => item[k]).find((v) => typeof v === "string" && v) as string | undefined;
        return (
          <div key={at} className="flex flex-col gap-2 rounded-md bg-muted/40 p-2" data-source-item={at}>
            {Array.isArray(value) ? <p className="text-xs font-medium">{name ?? `${n + 1}`}</p> : null}
            {props.map((k) => {
              const editor = editorAt(schema as never, `${at}/${k}`);
              if (editor.kind === "list" || editor.kind === "record") return null;
              return (
                <label key={k} className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {wordsOf(k)}
                  <FieldEditor compact editor={editor} label={wordsOf(k)} value={item[k]} field={`${at}/${k}`} renderParty={renderParty} onChange={(v) => onChange(`${at}/${k}`, v)} />
                </label>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

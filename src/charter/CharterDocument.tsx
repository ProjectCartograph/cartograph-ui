import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { useClient } from "@/client/context";
import type { CharterPart } from "@/client/port";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposedMark } from "@/changesets/ProposedMark";
import { SectionPeers, sectionRing, usePeersOn } from "@/collab/SectionPeers";
import { copy } from "@/copy";
import { FieldEditor, SourceEditor } from "./InlineEditors";
import { appendAt, getAt, removeAt, setAt } from "./pointer";
import { editorAt, schemaAt, type Editor } from "./schemaAt";
import "./charter-document.css";

const dc = copy.charter.doc;

type Spec = Record<string, unknown>;

/** What is open at a value: its editor, or where a worked-out value comes
 * from, anchored where the value is printed. */
type Opened = { kind: "field"; path: string; editor: Editor; at: DOMRect; label: string } | { kind: "source"; path: string; at: DOMRect; label: string };

/**
 * The charter as the document it is, edited where it is read (#75): the
 * sections the engine renders, one after another as the PDF prints them.
 * A value typed as text takes the cursor where it is clicked and saves as
 * it is typed; a choice, a reference, a party, a number or a date opens its
 * editor at the value; a value worked out (a start date, a budget's total)
 * opens what it is worked out from, in place. A list takes its next item
 * under it, and a row goes with the mark at its end. Nothing sends the
 * reader anywhere else.
 */
export function CharterDocument({
  id,
  spec,
  update,
  schema,
  step,
  routeOf,
  renderParty,
}: {
  id: string;
  spec: Spec;
  /** Changes the draft; every edit lands in the change set as the walk's do. */
  update: (fn: (spec: Spec) => Spec) => void;
  /** The kind's schema, which says how each value is edited. */
  schema: unknown;
  /** The walk's current step, which the document scrolls to. */
  step?: string;
  /** The route of a step, where the people on it are seen. */
  routeOf?: (step: string) => string | undefined;
  /** The picker of a party (a role of the project, or a body). */
  renderParty: (value: unknown, onChange: (v: unknown) => void) => ReactNode;
}) {
  const client = useClient();
  const queries = useQueryClient();
  const parts = useQuery({ queryKey: ["charter-parts", id], queryFn: () => client.charterParts(id) });
  const record = useQuery({ queryKey: ["charter-parts", id, "record"], queryFn: () => client.charterParts(id, { record: true }) });
  // What the sections hold (the components diagram, the triangle, chips)
  // styled as the charter styles them, its colour variables renamed to the
  // page's own (#77).
  const style = useQuery({ queryKey: ["charter-parts-style"], queryFn: () => client.charterPartsStyle(), staleTime: Infinity });
  // Read again a moment after the draft changes, for everyone in the
  // change set: their edits and this person's alike.
  useEffect(() => {
    const t = setTimeout(() => void queries.invalidateQueries({ queryKey: ["charter-parts", id] }), 700);
    return () => clearTimeout(t);
  }, [spec, id, queries]);
  const [opened, setOpened] = useState<Opened | null>(null);
  // Where the cursor goes once a new item shows: the list it was added to.
  const focusNext = useRef<string | null>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    if (!step || !parts.data) return;
    const at = parts.data.findIndex((p) => p.step === step);
    sections.current[at]?.scrollIntoView?.({ block: "nearest" });
  }, [step, parts.data]);

  if (parts.isLoading) return <Skeleton className="h-96 w-full" />;
  if (parts.isError || !parts.data) return <p className="text-sm text-muted-foreground">{copy.charter.empty}</p>;

  const proposedOf = (part: CharterPart): "new" | "changed" | undefined => {
    if (!record.data || part.empty) return undefined;
    const was = record.data.find((r) => r.title === part.title && r.step === part.step);
    if (!was || was.empty) return "new";
    return was.html !== part.html ? "changed" : undefined;
  };
  const act: Actions = {
    save: (path, text) => update((s) => setAt(s, path, text.trim() === "" ? undefined : text)),
    open: setOpened,
    add: (path) => {
      const items = schemaAt(schema as never, `${path}/0`);
      const list = getAt(spec, path);
      focusNext.current = `${path}/${Array.isArray(list) ? list.length : 0}`;
      update((s) => appendAt(s, path, items?.type === "string" ? "" : {}));
    },
    remove: (path) => update((s) => removeAt(s, path)),
    editorOf: (path) => editorAt(schema as never, path),
    focusNext,
  };

  return (
    <article className="charter-doc" data-cartograph-region="charter-document" aria-label={copy.charter.title}>
      {style.data ? <style>{`.charter-doc { ${style.data.replaceAll("var(--", "var(--charter-")} }`}</style> : null}
      {parts.data.map((part, i) => (
        <Section
          key={`${part.title}-${i}`}
          part={part}
          proposed={proposedOf(part)}
          route={part.step ? routeOf?.(part.step) : undefined}
          refSection={(el) => {
            sections.current[i] = el;
          }}
          act={act}
        />
      ))}
      {opened ? (
        <Anchored at={opened.at} onClose={() => setOpened(null)} label={opened.label}>
          {opened.kind === "field" ? (
            <FieldEditor
              editor={opened.editor}
              label={opened.label}
              value={getAt(spec, opened.path)}
              renderParty={renderParty}
              onChange={(v) => update((s) => setAt(s, opened.path, v))}
              onDone={() => setOpened(null)}
            />
          ) : (
            <SourceEditor path={opened.path} label={opened.label} spec={spec} schema={schema} renderParty={renderParty} onChange={(path, v) => update((s) => setAt(s, path, v))} />
          )}
        </Anchored>
      ) : null}
    </article>
  );
}

interface Actions {
  save: (path: string, text: string) => void;
  open: (o: Opened) => void;
  add: (path: string) => void;
  remove: (path: string) => void;
  editorOf: (path: string) => Editor;
  focusNext: React.MutableRefObject<string | null>;
}

/** The label a value is printed under: its term in a list of facts, or
 * its column in a table. */
function labelOf(el: HTMLElement): string {
  const dd = el.closest("dd");
  const dt = dd?.previousElementSibling;
  if (dt?.tagName === "DT") return dt.textContent?.trim() ?? "";
  const td = el.closest("td");
  const table = el.closest("table");
  if (td && table) {
    const i = Array.from(td.parentElement!.children).indexOf(td);
    return table.querySelector("tr")?.children[i]?.textContent?.trim() ?? "";
  }
  const p = el.closest("ul")?.previousElementSibling;
  if (p?.classList.contains("label")) return p.textContent?.trim() ?? "";
  return "";
}

const isText = (e: Editor) => e.kind === "text";

/** Readies the engine's HTML for editing where it is read: text takes the
 * cursor, everything else opens at the value, and lists take and lose
 * items in place. */
function decorate(root: HTMLElement, act: Actions) {
  root.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
    const path = el.dataset.field!;
    const editor = act.editorOf(path);
    // A part of a sentence (a problem's who, what, why) is named by what
    // belongs there, and edited beside the sentence, never typed into it.
    const part = el.hasAttribute("data-part");
    const hint = el.dataset.hint ?? "";
    const label = part ? hint.charAt(0).toUpperCase() + hint.slice(1) : labelOf(el);
    el.dataset.label = label;
    if (part) {
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.setAttribute("aria-label", dc.change(label));
      el.dataset.placeholder = hint;
    } else if (isText(editor)) {
      el.setAttribute("contenteditable", "plaintext-only");
      el.spellcheck = true;
      el.setAttribute("role", "textbox");
      el.setAttribute("aria-label", label || dc.text);
      el.dataset.placeholder = dc.write;
      el.dataset.was = el.textContent ?? "";
    } else {
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.setAttribute("aria-label", dc.change(label));
      el.dataset.placeholder = dc.choose;
    }
  });
  root.querySelectorAll<HTMLElement>("[data-source]").forEach((el) => {
    const label = labelOf(el);
    el.dataset.label = label;
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.setAttribute("aria-label", dc.source(label));
  });
  root.querySelectorAll<HTMLElement>("[data-add]").forEach((el) => {
    if (el.querySelector("button")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.addButton = el.dataset.add!;
    b.textContent = `+ ${el.dataset.addLabel ?? ""}`;
    b.setAttribute("aria-label", dc.add(el.dataset.addLabel ?? ""));
    el.appendChild(b);
  });
  // A row, or a line of a list, goes with the mark at its end.
  root.querySelectorAll<HTMLElement>("tr, li").forEach((row) => {
    if (row.querySelector("[data-remove]")) return;
    const first = row.querySelector<HTMLElement>("[data-field], [data-source]");
    const path = first?.dataset.field ?? first?.dataset.source;
    const item = path?.match(/^(.*\/\d+)(\/|$)/)?.[1];
    if (!item) return;
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.remove = item;
    b.setAttribute("aria-label", dc.remove);
    b.title = dc.remove;
    b.textContent = "×";
    if (row.tagName === "TR") {
      const td = document.createElement("td");
      td.className = "remove-cell";
      td.appendChild(b);
      row.appendChild(td);
    } else row.appendChild(b);
  });
  // The item just added takes the cursor in its first place to type.
  if (act.focusNext.current) {
    const el = root.querySelector<HTMLElement>(`[data-field^="${CSS.escape(act.focusNext.current)}"][contenteditable]`);
    if (el) {
      act.focusNext.current = null;
      el.focus();
    }
  }
}

function Section({ part, proposed, route, refSection, act }: { part: CharterPart; proposed?: "new" | "changed"; route?: string; refSection: (el: HTMLElement | null) => void; act: Actions }) {
  const body = useRef<HTMLDivElement>(null);
  const peers = usePeersOn(route ?? "");
  // The engine's HTML, put in only while nobody is typing in it: what is
  // being typed is never redrawn under the cursor. The latest waits for
  // the cursor to leave.
  const latest = useRef(part.html);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const actRef = useRef(act);
  // Kept current for the handlers, which run after a render.
  useLayoutEffect(() => {
    latest.current = part.html;
    actRef.current = act;
  });
  useLayoutEffect(() => {
    const el = body.current;
    if (!el || el.contains(document.activeElement)) return;
    el.innerHTML = part.html;
    decorate(el, actRef.current);
  }, [part.html]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  const flush = (el: HTMLElement) => {
    const path = el.dataset.field!;
    clearTimeout(timers.current.get(path));
    timers.current.delete(path);
    const text = el.textContent ?? "";
    if (text !== el.dataset.was) {
      el.dataset.was = text;
      actRef.current.save(path, text);
    }
  };
  const openAt = (el: HTMLElement) => {
    const label = el.dataset.label ?? "";
    if (el.dataset.source) actRef.current.open({ kind: "source", path: el.dataset.source, at: el.getBoundingClientRect(), label });
    else if (el.dataset.field) actRef.current.open({ kind: "field", path: el.dataset.field, editor: actRef.current.editorOf(el.dataset.field), at: el.getBoundingClientRect(), label });
  };

  return (
    <section ref={refSection} aria-label={part.title} data-part-step={part.step} data-proposed={proposed} style={sectionRing(peers)}>
      <h2>
        <ProposedMark proposed={proposed} />
        {part.title}
        <SectionPeers peers={peers} />
      </h2>
      {part.empty ? <p className="empty-part">{dc.nothingYet}</p> : null}
      <div
        ref={body}
        className="part-body"
        // The engine writes this HTML, every value escaped, from the same
        // renderer as the charter's PDF (engine render/editable.go).
        onInput={(e) => {
          const el = (e.target as HTMLElement).closest<HTMLElement>("[data-field][contenteditable]");
          if (!el) return;
          const path = el.dataset.field!;
          clearTimeout(timers.current.get(path));
          timers.current.set(path, setTimeout(() => flush(el), 500));
        }}
        onBlur={(e) => {
          const el = (e.target as HTMLElement).closest<HTMLElement>("[data-field][contenteditable]");
          if (el) flush(el);
          // The cursor has left: what changed meanwhile is drawn now.
          requestAnimationFrame(() => {
            const root = body.current;
            if (root && !root.contains(document.activeElement) && root.innerHTML !== latest.current) {
              root.innerHTML = latest.current;
              decorate(root, actRef.current);
            }
          });
        }}
        onKeyDown={(e) => {
          const el = e.target as HTMLElement;
          if (el.hasAttribute("contenteditable")) {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              el.blur();
            } else if (e.key === "Escape") {
              el.textContent = el.dataset.was ?? "";
              el.blur();
            }
            return;
          }
          if ((e.key === "Enter" || e.key === " ") && (el.dataset.field || el.dataset.source)) {
            e.preventDefault();
            openAt(el);
          }
        }}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          const remove = t.closest<HTMLElement>("[data-remove]");
          if (remove) return actRef.current.remove(remove.dataset.remove!);
          const add = t.closest<HTMLElement>("[data-add-button]");
          if (add) return actRef.current.add(add.dataset.addButton!);
          const el = t.closest<HTMLElement>("[data-field], [data-source]");
          if (el && !el.hasAttribute("contenteditable")) openAt(el);
        }}
      />
    </section>
  );
}

/** An editor anchored under the value it edits, closed by a click outside
 * it or Escape. */
function Anchored({ at, onClose, label, children }: { at: DOMRect; onClose: () => void; label: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("[data-radix-popper-content-wrapper], [role=listbox], [role=dialog]")) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const t = setTimeout(() => document.addEventListener("mousedown", away));
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  const left = Math.max(8, Math.min(at.left, window.innerWidth - 360));
  return (
    <div
      ref={box}
      role="group"
      aria-label={label}
      className="fixed z-50 w-[22rem] max-w-[calc(100vw-1rem)] rounded-lg bg-popover p-3 text-sm shadow-lg ring-1 ring-foreground/10 animate-in fade-in zoom-in-95 duration-150"
      style={{ top: Math.min(at.bottom + 6, window.innerHeight - 80), left }}
      data-slot="charter-inline-editor"
    >
      {children}
      <button type="button" className="absolute top-2 right-2 rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label={dc.close} title={dc.close} onClick={onClose}>
        <X className="size-3.5" />
      </button>
    </div>
  );
}

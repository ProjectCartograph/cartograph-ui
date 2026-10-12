// Which editor a value needs, read from the contract's schema at the
// value's pointer, so the charter edits each field as its own step does.

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  $ref?: string;
  format?: string;
  pattern?: string;
  maxLength?: number;
  description?: string;
  oneOf?: Schema[];
  anyOf?: Schema[];
  "x-cartograph-ref"?: string;
  "x-cartograph-enum"?: unknown[];
  $defs?: Record<string, Schema>;
  required?: string[];
};

export type Editor =
  | { kind: "text"; long: boolean }
  | { kind: "choice"; values: string[] }
  | { kind: "ref"; refKind: string }
  | { kind: "refs"; refKind: string }
  | { kind: "party" }
  | { kind: "number" }
  | { kind: "date"; month: boolean }
  | { kind: "timing" }
  | { kind: "standard" }
  | { kind: "flag" }
  | { kind: "record" }
  | { kind: "list" };

/** The schema at a pointer of a kind's document, following the
 * document's own $defs; undefined where it cannot be read. */
export function schemaAt(doc: Schema | undefined, pointer: string): Schema | undefined {
  if (!doc) return undefined;
  const local = (s: Schema | undefined): Schema | undefined => {
    let at = s;
    for (let n = 0; at?.$ref?.startsWith("#/$defs/") && n < 8; n++) at = doc.$defs?.[at.$ref.slice("#/$defs/".length)];
    return at;
  };
  let at: Schema | undefined = doc.properties?.spec;
  for (const k of pointer.split("/").filter(Boolean).slice(1)) {
    at = local(at);
    if (!at) return undefined;
    if (/^\d+$/.test(k)) at = at.items;
    else at = at.properties?.[k] ?? (at.oneOf ?? at.anyOf ?? []).map((o) => local(o)?.properties?.[k]).find(Boolean);
  }
  return local(at);
}

/** The editor a value at a pointer needs. */
export function editorAt(doc: Schema | undefined, pointer: string): Editor {
  // A measured success criterion's target is built, as its step builds it:
  // a comparison, a number and a unit, or words (#79). A criterion of
  // compliance has none; the engine offers no place to write one.
  if (/\/successCriteria\/\d+\/standard$/.test(pointer)) return { kind: "standard" };
  const s = schemaAt(doc, pointer);
  if (!s) return { kind: "text", long: false };
  if (typeof s["x-cartograph-ref"] === "string") return { kind: "ref", refKind: s["x-cartograph-ref"] };
  if (s.items && typeof s.items["x-cartograph-ref"] === "string") return { kind: "refs", refKind: s.items["x-cartograph-ref"] };
  // The common shapes, named by the definition they point at.
  if (s.$ref?.endsWith("/Ref")) return { kind: "party" };
  if (s.$ref?.endsWith("/Timing")) return { kind: "timing" };
  if (s.$ref?.endsWith("/YearMonth")) return { kind: "date", month: true };
  if (s.$ref?.endsWith("/Date")) return { kind: "date", month: false };
  const values = (s["x-cartograph-enum"] ?? s.enum) as string[] | undefined;
  if (Array.isArray(values)) return { kind: "choice", values: values.map(String) };
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  if (type === "number" || type === "integer") return { kind: "number" };
  if (type === "boolean") return { kind: "flag" };
  if (type === "array") return { kind: "list" };
  if (type === "object" || s.properties) return { kind: "record" };
  if (s.format === "date") return { kind: "date", month: false };
  return { kind: "text", long: (s.maxLength ?? 0) > 160 };
}

/**
 * A new item for the list at a pointer, as its own step adds one: text
 * empty, to be typed where it shows, and what the contract requires
 * filled as that step fills it: an id after the list's own (m3 after m2),
 * an empty list, a timing on a date still to be given.
 */
export function newItemAt(doc: Schema | undefined, pointer: string, list: unknown): unknown {
  const items = Array.isArray(list) ? (list as unknown[]) : [];
  const s = schemaAt(doc, `${pointer}/${items.length}`);
  const type = Array.isArray(s?.type) ? s?.type[0] : s?.type;
  if (type === "string") return "";
  const item: Record<string, unknown> = {};
  for (const k of s?.required ?? []) {
    const at = `${pointer}/${items.length}/${k}`;
    if (k === "id") item.id = nextId(pointer, items);
    else if (editorAt(doc, at).kind === "timing") item[k] = { form: "date" };
    else if (editorAt(doc, at).kind === "list" || editorAt(doc, at).kind === "refs") item[k] = [];
    else if (editorAt(doc, at).kind === "text") item[k] = "";
  }
  return item;
}

/** The next id in a list: its name's first letter and the first number
 * not taken, as each step numbers what it adds. */
function nextId(pointer: string, items: unknown[]): string {
  const name = pointer.split("/").filter((k) => k && !/^\d+$/.test(k)).pop() ?? "item";
  const prefix = name[0]?.toLowerCase() ?? "i";
  const taken = new Set(items.map((it) => (it && typeof it === "object" ? (it as { id?: unknown }).id : undefined)));
  let n = items.length + 1;
  while (taken.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

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

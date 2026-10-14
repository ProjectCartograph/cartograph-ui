// Values in a spec by the JSON pointer the charter names them by
// ("/spec/risks/0/description"), the leading /spec standing for the spec
// itself. Each change copies only the path it walks.

type Json = unknown;

const keysOf = (pointer: string) =>
  pointer
    .split("/")
    .filter(Boolean)
    .slice(1)
    .map((k) => k.replace(/~1/g, "/").replace(/~0/g, "~"));

const isIndex = (k: string) => /^\d+$/.test(k);

/** The value at a pointer, or undefined. */
export function getAt(spec: Json, pointer: string): Json {
  let at: Json = spec;
  for (const k of keysOf(pointer)) {
    if (at === null || typeof at !== "object") return undefined;
    at = (at as Record<string, Json>)[k];
  }
  return at;
}

/** The spec with the value at a pointer set, or removed when undefined.
 * What the path runs through is made as it goes: a list where the next
 * key is an index, an object otherwise. */
export function setAt<T>(spec: T, pointer: string, value: Json): T {
  const keys = keysOf(pointer);
  const walk = (node: Json, i: number): Json => {
    const k = keys[i];
    const container: Record<string, Json> | Json[] = Array.isArray(node) ? [...node] : node && typeof node === "object" ? { ...(node as object) } : isIndex(k) ? [] : {};
    const c = container as Record<string, Json>;
    if (i === keys.length - 1) {
      // Emptied: a key goes, a list keeps its place (removeAt drops one).
      if ((value === undefined || value === "") && !Array.isArray(container)) delete c[k];
      else c[k] = value ?? "";
      return container;
    }
    c[k] = walk(c[k], i + 1);
    return container;
  };
  return walk(spec, 0) as T;
}

/** The spec with an item added at the end of the list at a pointer. */
export function appendAt<T>(spec: T, pointer: string, item: Json): T {
  const list = getAt(spec, pointer);
  return setAt(spec, pointer, [...(Array.isArray(list) ? list : []), item]);
}

/** The spec without the list item at a pointer. */
export function removeAt<T>(spec: T, pointer: string): T {
  const keys = keysOf(pointer);
  const index = Number(keys[keys.length - 1]);
  const listPointer = "/spec/" + keys.slice(0, -1).join("/");
  const list = getAt(spec, listPointer);
  if (!Array.isArray(list) || Number.isNaN(index)) return setAt(spec, pointer, undefined);
  return setAt(spec, listPointer, list.filter((_, i) => i !== index));
}

/** The pointer of the list item a value is part of: /spec/risks/0 for
 * /spec/risks/0/owner. */
export function itemOf(pointer: string): string | undefined {
  const parts = pointer.split("/");
  for (let i = parts.length - 1; i > 1; i--) if (isIndex(parts[i])) return parts.slice(0, i + 1).join("/");
  return undefined;
}

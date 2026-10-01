// JSON pointers (RFC 6901) into a manifest, as data-cartograph-field names
// a control. An element of a list is addressed by its index, or by its id
// in braces (`/spec/keyResults/{kr-2}/target`), because two people's lists
// do not share indices (docs/UI_CONTRACT.md, section 1.1).

/** The pointer's segments, unescaped. "" is the whole document. */
export function parsePointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new Error(`not a JSON pointer: ${pointer}`);
  return pointer
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** A pointer from segments, escaped. */
export function formatPointer(segments: readonly (string | number)[]): string {
  return segments.map((s) => "/" + String(s).replace(/~/g, "~0").replace(/\//g, "~1")).join("");
}

/** Whether `inner` is `outer` or lies under it. */
export function within(inner: string, outer: string): boolean {
  return outer === "" || inner === outer || inner.startsWith(outer + "/");
}

function keyed(segment: string): string | undefined {
  return segment.length > 2 && segment.startsWith("{") && segment.endsWith("}") ? segment.slice(1, -1) : undefined;
}

/**
 * The property path a pointer names in `root`: list indices as numbers, a
 * braced id resolved to the index of the item that carries it. Undefined
 * when a braced id names no item. Keys that do not exist yet are kept, so
 * a write can create them.
 */
export function resolvePointer(root: unknown, pointer: string): (string | number)[] | undefined {
  const out: (string | number)[] = [];
  let node: unknown = root;
  for (const segment of parsePointer(pointer)) {
    if (Array.isArray(node)) {
      const id = keyed(segment);
      let index: number;
      if (id !== undefined) {
        index = node.findIndex((item) => isObject(item) && String(plainScalar(item.id)) === id);
        if (index < 0) return undefined;
      } else if (segment === "-") {
        index = node.length;
      } else {
        index = Number(segment);
        if (!Number.isInteger(index) || index < 0) return undefined;
      }
      out.push(index);
      node = node[index];
    } else {
      out.push(segment);
      node = isObject(node) ? node[segment] : undefined;
    }
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// An id held as an Automerge scalar string reads as an object with `val`.
function plainScalar(v: unknown): unknown {
  return isObject(v) && typeof (v as { val?: unknown }).val === "string" ? (v as { val: string }).val : v;
}

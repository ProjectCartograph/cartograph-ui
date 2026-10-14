/**
 * A new record's id, as the engine mints one: its kind and eight random
 * hexadecimal digits (project-1a2b3c4d). An id never comes from a name
 * (engine AGENTS.md: ids are generated, never derived from names), so a
 * record can be renamed freely and two records may share a name; what
 * people call it besides is a tag (metadata.labels).
 */
export function newRecordId(kind: string): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `${kind.toLowerCase()}-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

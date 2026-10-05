/** What starting a project may arrive with, from wherever it was begun. */
export interface StartSearch {
  /** What it is about, from a sentence typed elsewhere (Home, Prepare). */
  about?: string;
  /** The idea in full, when it was longer than a sentence. */
  idea?: string;
  /** A name typed elsewhere: offered when the project is named. */
  name?: string;
  /** A component of a bigger project (TAXONOMY.md D14, D15). */
  partOf?: boolean;
  /** The planned service it sets up (TAXONOMY.md D30). */
  operation?: string;
  /** A project to walk again, from its draft. */
  from?: string;
}

export function startSearch(search: Record<string, unknown>): StartSearch {
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.slice(0, max) : undefined);
  const out: StartSearch = {};
  const about = text(search.about, 300);
  const idea = text(search.idea, 1000);
  const name = text(search.name, 160);
  const operation = text(search.operation, 80);
  const from = text(search.from, 80);
  if (about) out.about = about;
  if (idea) out.idea = idea;
  if (name) out.name = name;
  if (operation) out.operation = operation;
  if (from) out.from = from;
  if (search.partOf === true || search.partOf === "true") out.partOf = true;
  return out;
}

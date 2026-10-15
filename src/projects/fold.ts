/** The sections of a stage folded as it opens (#32): each that has checks
 * and passes every one, but never the one the stage was opened at. */
export function foldedOnArrival(sections: string[], at: string | undefined, checks: { section: string; state: string }[]): Set<string> {
  const met = new Map<string, boolean>();
  for (const c of checks) met.set(c.section, (met.get(c.section) ?? true) && c.state === "ok");
  return new Set(sections.filter((s) => s !== at && met.get(s) === true));
}

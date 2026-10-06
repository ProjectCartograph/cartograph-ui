/** Whether a control's pointer (/spec/deliverables/{d-1}/name) is a guide
 * path (/spec/deliverables/-/name): a list item, by id or index, matches
 * the guide's "-". */
export function pointerMatches(pointer: string, path: string): boolean {
  const a = pointer.split("/");
  const b = path.split("/");
  if (a.length !== b.length) return false;
  return b.every((seg, i) => seg === a[i] || (seg === "-" && a[i] !== ""));
}

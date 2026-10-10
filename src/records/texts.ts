/** Every text a JSON pointer reaches in a document, list items ("-") read
 * one by one and objects read for their own texts, two levels down. */
export function textsAt(doc: unknown, path: string): string[] {
  const parts = path.split("/").slice(1);
  let here: unknown[] = [doc];
  for (const p of parts) {
    const next: unknown[] = [];
    for (const h of here) {
      if (p === "-" && Array.isArray(h)) next.push(...h);
      else if (h && typeof h === "object" && !Array.isArray(h)) next.push((h as Record<string, unknown>)[p]);
    }
    here = next;
  }
  const out: string[] = [];
  // An id or a code (one lowercase word or words joined by hyphens) is a
  // reference, not something a person reads.
  const idLike = (t: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t);
  const take = (v: unknown, depth: number) => {
    if (typeof v === "string" && v.trim() && !idLike(v.trim())) out.push(v.trim());
    else if (Array.isArray(v)) v.forEach((x) => take(x, depth));
    else if (v && typeof v === "object" && depth < 2) Object.values(v).forEach((x) => take(x, depth + 1));
  };
  here.forEach((h) => take(h, 0));
  return out;
}

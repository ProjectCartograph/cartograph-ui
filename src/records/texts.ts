/** A string a document holds, with the pointer it sits at. */
export interface TextAt {
  text: string;
  path: string;
}

/** Every string a JSON pointer reaches in a document, with where each
 * sits: list items ("-") read one by one, and objects read for their own
 * strings, two levels down. What each is (prose, a choice, a reference)
 * is the schema's to say, at its path. */
export function stringsAt(doc: unknown, path: string): TextAt[] {
  const parts = path.split("/").slice(1);
  let here: { v: unknown; at: string }[] = [{ v: doc, at: "" }];
  for (const p of parts) {
    const next: { v: unknown; at: string }[] = [];
    for (const h of here) {
      if (p === "-" && Array.isArray(h.v)) h.v.forEach((x, i) => next.push({ v: x, at: `${h.at}/${i}` }));
      else if (h.v && typeof h.v === "object" && !Array.isArray(h.v)) next.push({ v: (h.v as Record<string, unknown>)[p], at: `${h.at}/${p}` });
    }
    here = next;
  }
  const out: TextAt[] = [];
  const take = (v: unknown, at: string, depth: number) => {
    if (typeof v === "string" && v.trim()) out.push({ text: v.trim(), path: at });
    else if (Array.isArray(v)) v.forEach((x, i) => take(x, `${at}/${i}`, depth));
    else if (v && typeof v === "object" && depth < 2) Object.entries(v).forEach(([k, x]) => take(x, `${at}/${k}`, depth + 1));
  };
  here.forEach((h) => take(h.v, h.at, 0));
  return out;
}

/** Every text a JSON pointer reaches that a person reads, where no schema
 * is at hand: an id or a code (one lowercase word or words joined by
 * hyphens) is a reference, not something a person reads. */
export function textsAt(doc: unknown, path: string): string[] {
  const idLike = (t: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t);
  return stringsAt(doc, path)
    .map((s) => s.text)
    .filter((t) => !idLike(t));
}

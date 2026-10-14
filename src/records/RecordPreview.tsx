import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { useClient } from "@/client/context";
import { useGuide } from "@/components/guide";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy";
import { manifestLink } from "@/proposals/links";
import { schemaAt } from "@/charter/schemaAt";
import { useVocabularyWords } from "@/components/useVocabulary";
import { stringsAt, textsAt } from "./texts";

const rp = copy.recordPreview;

/**
 * What a record says, read in place: its name, then what each step of its
 * kind's walk holds, under the step's own title. Shown beside a list of
 * records to choose from, so a person reads one before choosing it rather
 * than opening it in another tab and coming back (#28).
 */
export function RecordPreview({ kind, id }: { kind: string; id: string }) {
  const client = useClient();
  const view = useQuery({ queryKey: ["record-preview", kind, id], queryFn: () => client.get(kind, id), staleTime: 30_000 });
  const guide = useGuide(kind);
  // What each value is comes from the kind's schema, as the engine serves
  // it: a choice is printed as its words, a reference or an id not at all
  // (#97: a data source previewed "paperRecord").
  const schema = useQuery({ queryKey: ["schema", kind], queryFn: () => client.schema(kind), staleTime: Infinity });
  const vocab = useVocabularyWords();
  if (view.isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }
  const manifest = view.data?.manifest as { metadata?: { name?: string; id?: string }; spec?: unknown } | undefined;
  if (!manifest) return <p className="text-sm text-muted-foreground">{rp.unavailable}</p>;
  const name = manifest.metadata?.name ?? id;
  // A value shown once, under the first step that holds it.
  const seen = new Set<string>([name]);
  const sections = (guide.data?.steps ?? [])
    .map((st) => {
      const texts = st.fields
        .flatMap((f) => (f.references ? [] : readable(manifest, f.path)))
        .filter((t) => !seen.has(t) && seen.add(t));
      return { key: st.key, title: st.title, texts: texts.slice(0, 3) };
    })
    .filter((s) => s.texts.length > 0)
    .slice(0, 6);
  const link = manifestLink({ kind, manifestId: id } as never);
  // A string as a person reads it, or nothing: prose as written; a choice
  // as its words; a reference, an id or a code left out.
  function readable(doc: unknown, path: string): string[] {
    const s = schema.data as Parameters<typeof schemaAt>[0] | undefined;
    if (!s) return textsAt(doc, path);
    return stringsAt(doc, path).flatMap(({ text, path: at }) => {
      const node = schemaAt(s, at) as Record<string, unknown> | undefined;
      if (!node) return [];
      if (typeof node["x-cartograph-ref"] === "string" || node.pattern || node.format) return [];
      if (typeof node["x-cartograph-vocabulary"] === "string") return [vocab(node["x-cartograph-vocabulary"] as string, text)];
      if (Array.isArray(node.enum) || Array.isArray(node["x-cartograph-enum"])) {
        const field = at.split("/").pop() ?? "";
        const word = copy.sheets.fieldValues[kind]?.[field]?.[text];
        return word ? [word] : [];
      }
      return [text];
    });
  }
  return (
    <article className="flex flex-col gap-3" data-cartograph-region="record-preview" aria-label={rp.label(name)}>
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">{copy.sheets.kindsSingular[kind] ?? kind}</span>
          <h3 className="text-base font-semibold text-pretty">{name}</h3>
        </div>
        <Link to={link.to} params={link.params as never} target="_blank" className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground" aria-label={rp.openLabel(name)} title={rp.openLabel(name)}>
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
          {rp.open}
        </Link>
      </header>
      {sections.length === 0 ? <p className="text-sm text-muted-foreground">{rp.nothingYet}</p> : null}
      {sections.map((s) => (
        <section key={s.key} className="flex flex-col gap-1">
          <h4 className="text-xs font-medium text-muted-foreground">{s.title}</h4>
          {s.texts.map((t, i) => (
            <p key={i} className="text-sm text-pretty">
              {t}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}

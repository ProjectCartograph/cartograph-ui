import type { GlossaryEntry } from "@/client/port";
import { termOf, useGlossary } from "@/components/glossary";
import { Definition } from "@/components/Term";
import { copy } from "@/copy";

const gc = copy.glossary;

/** The work's stages; every other stage is the strategy's. */
const WORK = new Set(["programme", "theory of change", "operation", "project", "results framework", "component", "stakeholders"]);

/**
 * Every word Cartograph uses, as a dictionary lists it (TAXONOMY.md D29):
 * the strategy's words in the order you write them, then the work's, then
 * the lists everything draws on. One page to read before starting, and the
 * same definitions every "?" shows.
 */
export function GlossaryPage() {
  const glossary = useGlossary();
  const entries = glossary.data ?? [];
  const groups: { title: string; region: string; entries: GlossaryEntry[] }[] = [
    { title: gc.strategy, region: "glossary-strategy", entries: entries.filter((e) => !e.register && !WORK.has(e.key)) },
    { title: gc.work, region: "glossary-work", entries: entries.filter((e) => !e.register && WORK.has(e.key)) },
    { title: gc.registers, region: "glossary-registers", entries: entries.filter((e) => e.register) },
  ];
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{gc.title}</h1>
        <p className="text-muted-foreground">{gc.subtitle}</p>
      </div>
      {groups.map((g) =>
        g.entries.length === 0 ? null : (
          <section key={g.region} className="flex flex-col gap-3" aria-label={g.title} data-cartograph-region={g.region}>
            <h2 className="text-base font-medium">{g.title}</h2>
            <dl className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
              {g.entries.map((e) => (
                <div key={e.key} id={`term-${e.key}`} className="grid gap-1 p-4 text-sm sm:grid-cols-[10rem_1fr] sm:gap-4">
                  <dt className="font-medium">{termOf(e.key)}</dt>
                  <dd className="flex flex-col gap-1.5">
                    <Definition entry={e} />
                    {e.after?.length ? (
                      <p className="text-xs text-muted-foreground">{gc.comesAfter(e.after.map(termOf).join(", "))}</p>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ),
      )}
    </div>
  );
}

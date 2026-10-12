import { BookA, Plus, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";
import { DefinitionStoreProvider, useDefinitionStore } from "@/definition/store";
import { useSettings } from "@/surfaces/goals/api";
import type { VocabularyTerm } from "@/components/useVocabulary";

interface SettingsSpec {
  vocabularies?: Record<string, VocabularyTerm[]>;
  [field: string]: unknown;
}

/**
 * The workspace's own words where a field's choices are its own (engine
 * TAXONOMY.md D71): its classification levels, how often a source changes,
 * the forms a source takes. Each starts as the standard list; a list set
 * here replaces it, edited like any record, in the person's change set.
 */
export function Vocabularies() {
  return (
    <DefinitionStoreProvider<SettingsSpec> kind="Settings" id="default" blank={() => ({})}>
      <Lists />
    </DefinitionStoreProvider>
  );
}

function Lists() {
  const store = useDefinitionStore<SettingsSpec>();
  const served = (useSettings().data as { vocabularies?: Record<string, VocabularyTerm[]> } | undefined)?.vocabularies ?? {};
  const own = store.spec.vocabularies ?? {};
  const words = copy.access.vocabularies;
  const set = (name: string, terms: VocabularyTerm[] | undefined) =>
    store.updateSpec((spec) => {
      const next = { ...(spec.vocabularies ?? {}) };
      if (terms) next[name] = terms;
      else delete next[name];
      return { ...spec, vocabularies: Object.keys(next).length ? next : undefined };
    });
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-labelledby="vocabularies-title" data-cartograph-region="vocabularies">
      <div className="flex items-center gap-2">
        <BookA className="size-4 text-muted-foreground" aria-hidden />
        <h2 id="vocabularies-title" className="text-sm font-semibold">
          {words.title}
        </h2>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">{words.intro}</p>
      <div className="hidden gap-1.5 text-xs text-muted-foreground sm:grid sm:grid-cols-[8rem_10rem_1fr_2rem]" aria-hidden>
        <span>{words.value}</span>
        <span>{words.label}</span>
        <span>{words.description}</span>
      </div>
      {Object.keys(served)
        .sort()
        .map((name) => {
          const mine = own[name];
          const terms = mine ?? served[name] ?? [];
          const edit = (i: number, patch: Partial<VocabularyTerm>) => set(name, terms.map((t, j) => (j === i ? { ...t, ...patch } : t)));
          return (
            <div key={name} className="space-y-2" data-vocabulary={name}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{words.names[name] ?? name}</h3>
                {mine ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set(name, undefined)} aria-label={words.useStandard(words.names[name] ?? name)} title={words.useStandard(words.names[name] ?? name)}>
                    <RotateCcw />
                    {words.standard}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{words.isStandard}</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {terms.map((t, i) => (
                  <li key={`${t.value}-${i}`} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_10rem_1fr_auto]">
                    <Input value={t.value} onChange={(e) => edit(i, { value: e.target.value.replace(/\s+/g, "").slice(0, 60) })} aria-label={words.value} className="font-mono text-xs" disabled={!store.loaded} />
                    <Input value={t.label} onChange={(e) => edit(i, { label: e.target.value.slice(0, 60) })} aria-label={words.label} disabled={!store.loaded} />
                    <Input value={t.description ?? ""} onChange={(e) => edit(i, { description: e.target.value.slice(0, 300) || undefined })} aria-label={words.description} disabled={!store.loaded} />
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => set(name, terms.filter((_, j) => j !== i))} aria-label={words.remove(t.label)} title={words.remove(t.label)} disabled={!store.loaded || terms.length <= 1}>
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" size="sm" onClick={() => set(name, [...terms, { value: `term${terms.length + 1}`, label: "" }])} disabled={!store.loaded} aria-label={words.addHint(words.names[name] ?? name)} title={words.addHint(words.names[name] ?? name)}>
                <Plus />
                {words.add}
              </Button>
            </div>
          );
        })}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {store.staged ? copy.access.changeControl.staged : copy.access.changeControl.inForce}
      </p>
    </section>
  );
}

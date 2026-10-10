import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldHeading } from "@/components/guidance";
import { Textarea } from "@/components/ui/textarea";
import { copy, plusNoun } from "@/copy";
import { ContextRecap } from "../ContextRecap";
import { RiskPrompt } from "../constraints/RiskPrompt";
import { useSectionAutosave, useProjectStore } from "../store";

const sc = copy.projects.scope;

function ScopeList({
  title,
  hint,
  placeholder,
  examples,
  items,
  onChange,
  field,
}: {
  /** The list's own pointer; each sentence is named by its index under it. */
  field: string;
  title: string;
  hint: string;
  placeholder: string;
  examples: string[];
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const store = useProjectStore();
  // A risk names its line word for word: editing the line carries its
  // risks along (engine TAXONOMY.md D62).
  function edit(idx: number, text: string) {
    const before = items[idx];
    const next = [...items];
    next[idx] = text;
    onChange(next);
    if (before && (store.spec.risks ?? []).some((r) => r.scopeLine === before)) {
      store.updateSpec((sp) => ({ ...sp, risks: (sp.risks ?? []).map((r) => (r.scopeLine === before ? { ...r, scopeLine: text || undefined } : r)) }));
    }
  }
  return (
    <div className="flex flex-col gap-2" data-cartograph-region={field === "/spec/summary/scopeIn" ? "scope-in" : "scope-out"}>
      <FieldHeading label={title} hint={hint} examples={examples} />
      <div className="flex flex-col gap-2">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{sc.scopeEmpty}</p> : null}
        {items.map((item, idx) => (
          <div key={idx} className="flex flex-col gap-1 rounded-lg border p-2">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] tabular-nums text-muted-foreground">
              {idx + 1}
            </span>
            {/* A sentence wraps rather than scrolling out of sight: sixty
                characters do not fit on one line in a two-column layout. */}
            <Textarea
              data-cartograph-field={`${field}/${idx}`}
              value={item}
              onChange={(e) => edit(idx, e.target.value.slice(0, 60))}
              placeholder={placeholder}
              aria-label={`${title} ${idx + 1}`}
              maxLength={60}
              rows={2}
              className="min-h-0 min-w-0 flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              aria-label={copy.projects.common.remove}
            >
              <X />
            </Button>
          </div>
          {/* How the scope could creep across this line (#59). */}
          {item.trim() ? (
            <div className="pl-7">
              <RiskPrompt side="scope" scopeLine={item} question={copy.projects.triangle.askCreep} short={copy.projects.triangle.shortCreep} />
            </div>
          ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start border-dashed"
          onClick={() => onChange([...items, ""])}
         aria-label={sc.addSentence}>
          <Plus />
          {plusNoun(sc.addSentence)}
        </Button>
      </div>
    </div>
  );
}

/**
 * Step four: the boundary, and nothing else. The problem and the change
 * are stated in Aim, what gets produced is listed in Deliverables, and the
 * money moved to Resources, where the charter template keeps it: scope is
 * where the project stops, not what it costs.
 */
export function ScopeSection() {
  useSectionAutosave();
  const store = useProjectStore();

  const summary = store.spec.summary;

  function updateSummary<K extends keyof typeof summary>(key: K, value: (typeof summary)[K]) {
    store.updateSpec((s) => ({ ...s, summary: { ...s.summary, [key]: value } }));
  }

  return (
    <div className="flex flex-col gap-6">
      <ContextRecap omit={["measures"]} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScopeList
          field="/spec/summary/scopeIn"
          title={sc.inScopeTitle}
          hint={sc.inScopeHint}
          placeholder={sc.inScopePlaceholder}
          examples={sc.inScopeExamples}
          items={summary.scopeIn ?? []}
          onChange={(next) => updateSummary("scopeIn", next)}
        />
        <ScopeList
          field="/spec/summary/scopeOut"
          title={sc.outScopeTitle}
          hint={sc.outScopeHint}
          placeholder={sc.outScopePlaceholder}
          examples={sc.outScopeExamples}
          items={summary.scopeOut ?? []}
          onChange={(next) => updateSummary("scopeOut", next)}
        />
      </div>

    </div>
  );
}

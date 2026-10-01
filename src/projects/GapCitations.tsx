import { useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { copy } from "@/copy";
import { SheetAddDialog } from "@/surfaces/sheet/InlineSheetAdd";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { useQueries } from "@tanstack/react-query";
import { client } from "@/api/client";
import type { GapCitation } from "./types";

const ac = copy.projects.aim;

/** The segments one gap was observed in, read from the gap itself. */
function useGapSegments(gapIDs: string[]) {
  const results = useQueries({
    queries: gapIDs.map((id) => ({
      queryKey: ["gap-segments", id],
      staleTime: 30_000,
      queryFn: async (): Promise<string[]> => {
        const res = await client.GET("/manifests/{kind}/{id}", {
          params: { path: { kind: "Gap", id } },
        });
        if (res.error) return [];
        const spec = (res.data as unknown as { manifest?: { spec?: { segments?: string[] } } })
          .manifest?.spec;
        return spec?.segments ?? [];
      },
    })),
  });
  const byGap = new Map<string, string[]>();
  gapIDs.forEach((id, i) => byGap.set(id, results[i]?.data ?? []));
  return byGap;
}

/**
 * Which gaps a problem answers, and how much of each.
 *
 * A gap observed in four slices, answered by work that reaches one of
 * them, is a quarter of a claim. Until 2026-09-29 the citation was a bare
 * list of ids and there was no way to say so, which made every citation
 * look like the whole (GAP_DESIGN.md).
 *
 * So each citation is a row: the gap, and the segments this work reaches.
 * A gap that names no segments has nothing to narrow and shows none — the
 * ceremony appears only where there is a choice to make.
 */
export function GapCitations({
  value,
  onChange,
}: {
  value: GapCitation[];
  onChange: (next: GapCitation[]) => void;
}) {
  const { data: gapRefs } = useReferenceOptions("Gap");
  const { data: segmentRefs } = useReferenceOptions("Segment");
  const [adding, setAdding] = useState(false);

  const cited = value.map((c) => c.gap);
  const segmentsByGap = useGapSegments(cited);

  const gapOptions = gapRefs?.options ?? [];
  const segmentLabel = (id: string) =>
    segmentRefs?.options.find((o) => o.value === id)?.label ?? id;
  const gapLabel = (id: string) => gapOptions.find((o) => o.value === id)?.label ?? id;

  function setGaps(next: string[]) {
    // Keep what each surviving citation already said about its segments.
    const previous = new Map(value.map((c) => [c.gap, c]));
    onChange(next.map((id) => previous.get(id) ?? { gap: id }));
  }

  function setSegments(gap: string, segments: string[]) {
    onChange(
      value.map((c) =>
        c.gap === gap ? { gap, ...(segments.length > 0 ? { segments } : {}) } : c,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ComboboxMultiple
        options={gapOptions}
        value={cited}
        onValueChange={setGaps}
        placeholder={ac.problemGapsPlaceholder}
        emptyText={ac.problemGapsNone}
        removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
        aria-label={ac.problemGapsLabel}
        // A gap noticed while writing the problem it explains must not cost
        // the problem. Same rule the role picker follows.
        onAdd={() => setAdding(true)}
        addLabel={ac.problemGapsAdd}
      />
      <SheetAddDialog
        kind="Gap"
        open={adding}
        onOpenChange={setAdding}
        onAdded={(id) => onChange([...value, { gap: id }])}
      />

      {value.map((citation) => {
        const scope = segmentsByGap.get(citation.gap) ?? [];
        if (scope.length === 0) return null;
        const picked = citation.segments ?? [];
        return (
          <div
            key={citation.gap}
            data-slot="gap-citation-scope"
            className="flex flex-col gap-1.5 rounded-lg border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">{gapLabel(citation.gap)}</span>
              {picked.length === 0 ? (
                <Badge variant="secondary">
                  <span className="truncate">{ac.gapScopeWhole}</span>
                </Badge>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground"
                  onClick={() => setSegments(citation.gap, [])}
                >
                  <X />
                  {ac.gapScopeClear}
                </Button>
              )}
            </div>
            <ComboboxMultiple
              options={scope.map((id) => ({ value: id, label: segmentLabel(id) }))}
              value={picked}
              onValueChange={(next) => setSegments(citation.gap, next)}
              placeholder={ac.gapScopePlaceholder}
              emptyText={ac.gapScopeNone}
              removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
              aria-label={`${ac.gapScopeLabel} ${gapLabel(citation.gap)}`}
            />
          </div>
        );
      })}
    </div>
  );
}

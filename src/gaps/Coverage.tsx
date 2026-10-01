import { CircleDashed, CircleDot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy";
import { useGapCoverage } from "./api";

/**
 * Which parts of this gap somebody is working on, and which nobody is.
 *
 * The question a gap register exists to answer, and one Cartograph could not
 * ask before a citation could name segments: a gap observed in four slices
 * and cited by two projects told you nothing about which two slices were
 * covered (GAP_DESIGN.md).
 *
 * Read-only on purpose. Nothing here is edited: coverage is what the work
 * says about itself, and the place to change it is the work.
 *
 * The word is *addressed*, never *closed*. Somebody working on a slice is
 * contribution; whether the shortfall narrowed is what the measure reads.
 */
export function GapCoveragePanel({ id }: { id: string }) {
  const { data, isLoading } = useGapCoverage(id);
  const c = copy.gaps.coverage;

  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (!data) return null;

  const unaddressed = data.segments.filter((s) => (s.addressedBy ?? []).length === 0).length;

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{c.title}</h2>
        {data.segments.length > 0 ? (
          <Badge variant={unaddressed > 0 ? "secondary" : "outline"}>
            <span className="truncate">
              {c.count(data.segments.length - unaddressed, data.segments.length)}
            </span>
          </Badge>
        ) : null}
      </div>

      {data.segments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.noSegments}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.segments.map((s) => {
            const by = s.addressedBy ?? [];
            return (
              <li key={s.segment} className="flex items-start gap-2 text-sm">
                {by.length > 0 ? (
                  <CircleDot className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
                ) : (
                  <CircleDashed
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{s.name}</span>
                  {by.length > 0 ? (
                    <span className="text-muted-foreground"> {by.map((w) => w.name).join(", ")}</span>
                  ) : (
                    <span className="text-muted-foreground"> {c.nobody}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* A citation that named no segments claims all of it. Worth saying
          out loud, because it is the thing that hides an unaddressed
          slice. */}
      {(data.whole ?? []).length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {c.whole((data.whole ?? []).map((w) => w.name).join(", "))}
        </p>
      ) : null}
    </section>
  );
}

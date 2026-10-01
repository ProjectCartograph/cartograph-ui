import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { FileQuestion } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useClient } from "@/client/context";
import { copy } from "@/copy";
import { ErrorAlert } from "@/components/error-alert";
import { kindIcon } from "@/components/vocab";
import { SHEET_KINDS } from "@/surfaces/sheet/schema";
import { useUnapplied } from "@/surfaces/sheet/Unapplied";

export const Route = createFileRoute("/sheets/")({ component: SheetsIndexPage });

function SheetsIndexPage() {
  const client = useClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["kinds"],
    queryFn: () => client.kinds(),
  });

  const counts = new Map((data ?? []).map((k) => [k.kind, k.count]));
  // What each directory is withholding, so the number on the card is not
  // the only number and nobody has to open one to find out.
  const { data: unapplied } = useUnapplied();
  const withheld = new Map<string, number>();
  for (const r of unapplied ?? []) withheld.set(r.kind, (withheld.get(r.kind) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{copy.sheets.indexTitle}</h1>
        <p className="text-muted-foreground">{copy.sheets.indexSubtitle}</p>
      </div>

      {isError ? <ErrorAlert message={copy.sheets.indexError} onRetry={() => refetch()} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-cartograph-region="sheet-kinds">
        {isLoading
          ? Array.from({ length: SHEET_KINDS.length }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          : !isError
            ? SHEET_KINDS.map((kind) => (
                <Link key={kind} to="/sheets/$kind" params={{ kind }}>
                  <Card className="transition-colors hover:bg-accent">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          {(() => {
                            const Icon = kindIcon(kind);
                            return Icon ? (
                              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            ) : null;
                          })()}
                          <span className="min-w-0 truncate">{copy.sheets.kinds[kind] ?? kind}</span>
                        </span>
                        {withheld.get(kind) ? (
                          <Badge variant="secondary" className="gap-1" title={copy.sheets.unapplied.hint}>
                            <FileQuestion className="size-3.5" aria-hidden="true" />
                            <span className="truncate">{withheld.get(kind)}</span>
                          </Badge>
                        ) : null}
                      </CardTitle>
                      <CardDescription>{counts.get(kind) ?? 0} manifests</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))
            : null}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { client } from "@/api/client";
import { copy, manifestKindLabels } from "@/copy";
import { ErrorAlert } from "@/components/error-alert";

export const Route = createFileRoute("/manifests/$kind")({ component: ManifestsPage });

function ManifestsPage() {
  const { kind } = Route.useParams();
  const kindLabel = manifestKindLabels[kind] ?? kind;

  const { data: raw, isLoading, isError, refetch } = useQuery({
    queryKey: ["manifests", kind],
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/{kind}", {
        params: { path: { kind } },
      });
      if (error) throw error;
      return data;
    },
  });

  // Neither limit nor cursor is passed above, so the API always answers with
  // the bare array; the union in the generated type only exists because the
  // same endpoint can also return the paginated envelope.
  const data = Array.isArray(raw) ? raw : (raw?.items ?? undefined);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{kindLabel}</h1>
        <p className="text-muted-foreground">{copy.manifests.subtitle}</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : null}
      {isError ? <ErrorAlert message={copy.manifests.error} onRetry={() => refetch()} /> : null}

      {!isError && data && data.length === 0 ? (
        <p className="text-muted-foreground">{copy.manifests.empty}</p>
      ) : null}

      {data && data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.manifests.columns.id}</TableHead>
              <TableHead>{copy.manifests.columns.name}</TableHead>
              <TableHead>{copy.manifests.columns.version}</TableHead>
              <TableHead>{copy.manifests.columns.updatedOn}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">{row.id}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.version}</TableCell>
                <TableCell>{new Date(row.updatedOn).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}

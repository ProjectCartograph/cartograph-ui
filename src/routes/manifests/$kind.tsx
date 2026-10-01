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
import { useClient } from "@/client/context";
import { copy, manifestKindLabels } from "@/copy";
import { ErrorAlert } from "@/components/error-alert";

export const Route = createFileRoute("/manifests/$kind")({ component: ManifestsPage });

function ManifestsPage() {
  const { kind } = Route.useParams();
  const kindLabel = manifestKindLabels[kind] ?? kind;
  const client = useClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["manifests", kind],
    queryFn: () => client.list(kind),
  });

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

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  FolderOpen,
  RotateCw,
  Search,
  RotateCcw,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { client } from "@/api/client";
import { ErrorAlert } from "@/components/error-alert";

export const Route = createFileRoute("/snapshots/")({ component: SnapshotsPage });

function SnapshotsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [limit] = useState(20);
  const [cursor, setCursor] = useState<string | null>(null);

  const vaultQuery = useQuery({
    queryKey: ["vault"],
    queryFn: async () => {
      const { data, error } = await client.GET("/vault");
      if (error) throw error;
      return data;
    },
  });

  const excludedQuery = useQuery({
    queryKey: ["vault-excluded"],
    queryFn: async () => {
      const { data, error } = await client.GET("/vault/excluded");
      if (error) throw error;
      return data;
    },
  });

  const unappliedQuery = useQuery({
    queryKey: ["vault-unapplied"],
    queryFn: async () => {
      const { data, error } = await client.GET("/vault/unapplied");
      if (error) throw error;
      return data;
    },
  });

  const snapshotsQuery = useQuery({
    queryKey: ["snapshots", limit, cursor],
    queryFn: async () => {
      const { data, error } = await client.GET("/snapshots", {
        params: { query: { limit, cursor: cursor || undefined } },
      });
      if (error) throw error;
      return data;
    },
  });

  const snapshots = snapshotsQuery.data?.snapshots ?? [];
  const kinds = Array.from(new Set(snapshots.map((s) => s.kind))).sort();

  const filtered = snapshots
    .filter((s) => {
      if (kindFilter && s.kind !== kindFilter) return false;
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          s.id.toLowerCase().includes(searchLower) ||
          (s.definition && s.definition.toLowerCase().includes(searchLower)) ||
          s.reason.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Snapshots</h1>
          <p className="text-muted-foreground">
            Every saved version in this vault. The file is the draft; a snapshot is a version.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RotateCw className="h-4 w-4" />
            Rebuild index
          </Button>
          <Button variant="outline" size="sm">
            <FolderOpen className="h-4 w-4" />
            Open vault folder
          </Button>
        </div>
      </div>

      {vaultQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : vaultQuery.data ? (
        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Vault</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-sm truncate">
                {vaultQuery.data.metadata?.id}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Manifests in live state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {vaultQuery.data.spec?.include?.length ?? 0}{" "}
                <span className="text-xs text-muted-foreground">
                  included in vault.yaml
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last snapshot line</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-xs truncate">
                {snapshots.length > 0 && snapshots[0].reason}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {snapshotsQuery.isError && (
        <ErrorAlert
          message="Failed to load snapshots"
          onRetry={() => snapshotsQuery.refetch()}
        />
      )}

      <div className="space-y-6">
        {excludedQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (excludedQuery.data ?? []).length > 0 ? (
          <Card>
            <CardHeader>
              <CardDescription>Removed from the state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(excludedQuery.data ?? []).map((item: any) => (
                  <div key={`${item.kind}/${item.id}`} className="flex items-center justify-between gap-2 p-2 border rounded text-sm">
                    <div>
                      <div className="font-medium">{item.kind}/{item.id}</div>
                      <div className="text-xs text-muted-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground">Removed on {new Date(item.on).toLocaleDateString()}: {item.reason}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const { error } = await client.POST("/vault/recover", {
                          body: { ref: `${item.kind}/${item.id}` },
                        });
                        if (!error) {
                          queryClient.invalidateQueries({ queryKey: ["vault-excluded"] });
                          queryClient.invalidateQueries({ queryKey: ["vault"] });
                        }
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Recover
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {unappliedQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (unappliedQuery.data ?? []).length > 0 ? (
          <Card>
            <CardHeader>
              <CardDescription>Files not applied</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(unappliedQuery.data ?? []).map((item: any) => (
                  <div key={`${item.kind}/${item.id}`} className="flex items-center justify-between gap-2 p-2 border rounded text-sm">
                    <div>
                      <div className="font-medium">{item.kind}/{item.id}</div>
                      {item.name && <div className="text-xs text-muted-foreground">{item.name}</div>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const { error } = await client.POST("/vault/apply", {
                          body: { ref: `${item.kind}/${item.id}` },
                        });
                        if (!error) {
                          queryClient.invalidateQueries({ queryKey: ["vault-unapplied"] });
                          queryClient.invalidateQueries({ queryKey: ["vault"] });
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search snapshots..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={kindFilter || "all"} onValueChange={(value) => setKindFilter(value === "all" ? null : value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {kinds.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {kind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {snapshotsQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : snapshots.length === 0 ? (
        <p className="text-muted-foreground">No snapshots found</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Definition</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>On</TableHead>
                <TableHead>Bundle</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((snapshot) => (
                <TableRow key={`${snapshot.kind}/${snapshot.id}/v${snapshot.number}`}>
                  <TableCell className="font-semibold">{snapshot.version}</TableCell>
                  <TableCell className="truncate font-medium">
                    {snapshot.definition}
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate">
                    {snapshot.kind}
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-xs">
                    {snapshot.reason}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                    {new Date(snapshot.on).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {snapshot.bundle ? (
                      <Badge variant="outline">{snapshot.bundle.split("/").pop()}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">none</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <a href="#" className="text-xs font-medium hover:underline">
                      Diff
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {snapshots.length} snapshots
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!cursor}
            onClick={() => setCursor(null)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!snapshotsQuery.data?.cursor}
            onClick={() => setCursor(snapshotsQuery.data?.cursor || null)}
          >
            Next
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Snapshots live in .cartograph beside the files. History across machines belongs to whatever
        synchronises the vault; Cartograph never runs it.
      </p>
    </div>
  );
}

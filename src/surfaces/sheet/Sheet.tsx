import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { fieldVocab, VocabChip, VocabOption } from "@/components/vocab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useClient } from "@/client/context";
import { copy } from "@/copy";
import { Term } from "@/components/Term";
import { ErrorAlert } from "@/components/error-alert";
import { type FieldDef, type SheetKind, parseSpecFields, unitHint } from "./schema";
import { SheetForm, type SheetRow } from "./SheetForm";
import { refOptionsQuery } from "./useReferenceOptions";

const PAGE_SIZE = 50;
const ANY = "__any__";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function formatCount(from: number, to: number, total: number): string {
  return copy.sheets.count.of
    .replace("{from}", String(from))
    .replace("{to}", String(to))
    .replace("{total}", String(total));
}

function TruncatedText({ text }: { text: string }) {
  if (!text) return <span className="text-muted-foreground">{"-"}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block max-w-64 truncate">{text}</span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

interface Row {
  id: string;
  name: string;
  version: number;
  updatedOn: string;
  spec: Record<string, unknown> | undefined;
  loading: boolean;
}

function SpecCell({
  field,
  kind,
  row,
  refNames,
}: {
  field: FieldDef;
  kind: SheetKind;
  row: Row;
  refNames: Map<string, Map<string, string>>;
}) {
  const value = row.spec?.[field.name];
  const dash = <span className="text-muted-foreground">{"-"}</span>;

  switch (field.kind) {
    case "ref": {
      if (!value || typeof value !== "string") return dash;
      const names = refNames.get(field.refKind as string);
      return <TruncatedText text={names?.get(value) ?? value} />;
    }
    case "ref-array": {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      if (ids.length === 0) return dash;
      const label = copy.sheets.fields[kind]?.[field.name] ?? field.name;
      return <Badge variant="secondary">{`${ids.length} ${label.toLowerCase()}`}</Badge>;
    }
    case "string-array": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      if (items.length === 0) return dash;
      const label = copy.sheets.fields[kind]?.[field.name] ?? field.name;
      return <Badge variant="secondary">{`${items.length} ${label.toLowerCase()}`}</Badge>;
    }
    case "enum": {
      // Numbers are enums too (a reporting cycle's period is 1, 3, 6 or
      // 12), and a string test alone used to drop them into a dash. The
      // chip carries the mark and the reading, never the stored value.
      if (value === undefined || value === null || value === "") return dash;
      const vocab = fieldVocab(kind, field.name);
      if (vocab) return <VocabChip vocab={vocab} value={value as string | number} />;
      return typeof value === "string" ? <Badge variant="secondary">{value}</Badge> : dash;
    }
    case "boolean":
      return value ? <Check className="size-4" aria-label={copy.sheets.dialog.trueLabel} /> : dash;
    case "integer":
    case "number": {
      if (value === undefined || value === null || value === "") return dash;
      const hint = unitHint(field.name);
      return (
        <span>
          {String(value)}
          {hint ? <span className="text-muted-foreground"> {hint}</span> : null}
        </span>
      );
    }
    default:
      return <TruncatedText text={typeof value === "string" ? value : value ? JSON.stringify(value) : ""} />;
  }
}

/**
 * The one generic Sheet component, built once, used by /sheets/$kind for
 * all seven directory kinds.
 */
export function Sheet({ kind }: { kind: SheetKind }) {
  const client = useClient();
  // What this kind is, in one sentence, as the engine's guidance says it.
  const summary = useQuery({ queryKey: ["kinds"], queryFn: () => client.kinds() }).data?.find((k) => k.kind === kind)?.summary;
  const kindLabel = copy.sheets.kinds[kind] ?? kind;
  const kindLabelSingular = copy.sheets.kindsSingular[kind] ?? kind;

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 250);
  const [enumFilters, setEnumFilters] = useState<Record<string, string>>({});
  const [refFilters, setRefFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<{ open: boolean; row?: SheetRow }>({ open: false });

  useEffect(() => {
    setPage(0);
  }, [debouncedQ, enumFilters, refFilters, kind]);

  const schemaQuery = useQuery({
    queryKey: ["schema", kind],
    queryFn: () => client.schema(kind),
  });

  const fields = useMemo(() => parseSpecFields(schemaQuery.data), [schemaQuery.data]);
  const enumFields = useMemo(() => fields.filter((f) => f.kind === "enum"), [fields]);
  const refFields = useMemo(
    () => fields.filter((f) => f.kind === "ref" || f.kind === "ref-array"),
    [fields]
  );
  const refKinds = useMemo(
    () => Array.from(new Set(refFields.map((f) => f.refKind as string))),
    [refFields]
  );

  const refQueries = useQueries({ queries: refKinds.map((rk) => refOptionsQuery(client, rk)) });
  const refNames = useMemo(() => {
    const m = new Map<string, Map<string, string>>();
    refKinds.forEach((rk, i) => m.set(rk, refQueries[i]?.data?.names ?? new Map()));
    return m;
  }, [refKinds, refQueries]);
  const refOptionsByKind = useMemo(() => {
    const m = new Map<string, { value: string; label: string }[]>();
    refKinds.forEach((rk, i) => m.set(rk, refQueries[i]?.data?.options ?? []));
    return m;
  }, [refKinds, refQueries]);

  const refParams = useMemo(() => {
    const out: string[] = [];
    for (const f of refFields) {
      const id = refFilters[f.name];
      if (id) out.push(`${f.refKind}/${id}`);
    }
    return out;
  }, [refFields, refFilters]);

  const summariesQuery = useQuery({
    queryKey: ["sheet-summaries", kind, debouncedQ, refParams.join(",")],
    queryFn: () =>
      client.list(kind, { q: debouncedQ || undefined, ref: refParams.length ? refParams : undefined }),
  });
  const summaries = summariesQuery.data ?? [];

  const rowQueries = useQueries({
    queries: summaries.map((s) => ({
      queryKey: ["sheet-row", kind, s.id, s.version],
      queryFn: () => client.get(kind, s.id),
      staleTime: 30_000,
    })),
  });

  const rows: Row[] = useMemo(
    () =>
      summaries.map((s, i) => ({
        id: s.id,
        name: s.name,
        version: s.version,
        updatedOn: s.updatedOn,
        spec: rowQueries[i]?.data?.manifest.spec as Record<string, unknown> | undefined,
        loading: rowQueries[i]?.isLoading ?? true,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summaries, rowQueries.map((q) => q.dataUpdatedAt).join(","), rowQueries.map((q) => q.isLoading).join(",")]
  );

  const activeEnumFields = enumFields.filter((f) => enumFilters[f.name]);
  const filteredRows = rows.filter((r) => {
    if (activeEnumFields.length === 0) return true;
    if (!r.spec) return true; // still loading: keep provisionally, settles once loaded
    return activeEnumFields.every((f) => r.spec?.[f.name] === enumFilters[f.name]);
  });

  const total = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const from = total === 0 ? 0 : clampedPage * PAGE_SIZE + 1;
  const to = Math.min(total, (clampedPage + 1) * PAGE_SIZE);
  const pageRows = filteredRows.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const isInitialLoading = schemaQuery.isLoading || summariesQuery.isLoading;
  const hasError = schemaQuery.isError || summariesQuery.isError;
  const kindIsEmpty = !isInitialLoading && !hasError && summaries.length === 0 && !q && refParams.length === 0;
  const noResults = !isInitialLoading && !hasError && total === 0 && !kindIsEmpty;

  function openAdd() {
    setDialog({ open: true, row: undefined });
  }
  function openEdit(r: Row) {
    if (!r.spec) return;
    setDialog({ open: true, row: { id: r.id, name: r.name, version: r.version, spec: r.spec } });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
            {kindLabel}
            <Term word={kind} />
          </h1>
          <p className="max-w-[70ch] text-muted-foreground">{summary ?? copy.sheets.subtitle}</p>
        </div>
        <Button onClick={openAdd} aria-label={copy.sheets.addNamed(kindLabelSingular)}>
          <Plus />
          {kindLabelSingular}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-cartograph-region="sheet-filters">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={copy.sheets.searchPlaceholder}
          className="w-56"
        />
        {enumFields.map((f) => {
          const label = copy.sheets.fields[kind]?.[f.name] ?? f.name;
          const anyLabel = copy.sheets.anyFilter.replace("{field}", label);
          return (
            <Select
              key={f.name}
              value={enumFilters[f.name] ?? ANY}
              onValueChange={(v) =>
                setEnumFilters((prev) => {
                  const next = { ...prev };
                  if (v === ANY) delete next[f.name];
                  else next[f.name] = v;
                  return next;
                })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{anyLabel}</SelectItem>
                {/* The same mark and the same word the cell shows. This
                    printed the raw enum value until 2026-09-29, so a
                    filter offered "formOrSurvey" while the column beside
                    it said "Form" with a clipboard. */}
                {(f.enumValues ?? []).map((v) => {
                  const vocab = fieldVocab(kind, f.name);
                  return (
                    <SelectItem key={v} value={String(v)}>
                      {vocab ? (
                        <VocabOption vocab={vocab} value={v} />
                      ) : (
                        (copy.sheets.fieldValues[kind]?.[f.name]?.[String(v)] ?? String(v))
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          );
        })}
        {refFields.map((f) => {
          const label = copy.sheets.fields[kind]?.[f.name] ?? f.name;
          const anyLabel = copy.sheets.anyFilter.replace("{field}", label);
          return (
            <Select
              key={f.name}
              value={refFilters[f.name] ?? ANY}
              onValueChange={(v) =>
                setRefFilters((prev) => {
                  const next = { ...prev };
                  if (v === ANY) delete next[f.name];
                  else next[f.name] = v;
                  return next;
                })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{anyLabel}</SelectItem>
                {(refOptionsByKind.get(f.refKind as string) ?? []).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}
      </div>

      {hasError ? (
        <ErrorAlert
          message={copy.sheets.error}
          onRetry={() => {
            schemaQuery.refetch();
            summariesQuery.refetch();
          }}
        />
      ) : null}

      {!hasError && kindIsEmpty ? (
        <p className="text-muted-foreground">{copy.sheets.empty}</p>
      ) : !hasError ? (
        <>
          {noResults ? <p className="text-muted-foreground">{copy.sheets.noResults}</p> : null}

          {!noResults && !kindIsEmpty ? (
            <Table data-cartograph-region="sheet-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.sheets.fields[kind]?.name ?? "Name"}</TableHead>
                  {fields.map((f) => (
                    <TableHead key={f.name}>{copy.sheets.fields[kind]?.[f.name] ?? f.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isInitialLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={fields.length + 1}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : pageRows.map((r) => (
                      <TableRow
                        key={r.id}
                        tabIndex={0}
                        className="cursor-pointer"
                        onClick={() => openEdit(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openEdit(r);
                        }}
                      >
                        <TableCell className="font-medium">
                          {r.loading ? <Skeleton className="h-5 w-32" /> : <TruncatedText text={r.name} />}
                        </TableCell>
                        {fields.map((f) => (
                          <TableCell key={f.name}>
                            {r.loading ? (
                              <Skeleton className="h-5 w-20" />
                            ) : (
                              <SpecCell field={f} kind={kind} row={r} refNames={refNames} />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          ) : null}

          {!kindIsEmpty && total > 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{formatCount(from, to, total)}</p>
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      text={copy.sheets.previous}
                      aria-disabled={clampedPage === 0}
                      className={clampedPage === 0 ? "pointer-events-none opacity-50" : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        if (clampedPage > 0) setPage(clampedPage - 1);
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      text={copy.sheets.next}
                      aria-disabled={clampedPage >= pageCount - 1}
                      className={clampedPage >= pageCount - 1 ? "pointer-events-none opacity-50" : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        if (clampedPage < pageCount - 1) setPage(clampedPage + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </>
      ) : null}

      {dialog.open ? (
        <SheetForm
          kind={kind}
          kindLabel={kindLabelSingular}
          fields={fields}
          open={dialog.open}
          onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
          existing={dialog.row}
        />
      ) : null}
    </div>
  );
}

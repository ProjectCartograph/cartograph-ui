import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { client } from "@/api/client";
import { copy } from "@/copy";

export interface UnappliedRef {
  kind: string;
  id: string;
  name?: string;
}

/** Everything in the vault directory that the vault does not yet include. */
export function useUnapplied() {
  return useQuery({
    queryKey: ["vault-unapplied"],
    queryFn: async (): Promise<UnappliedRef[]> => {
      const { data, error } = await client.GET("/vault/unapplied");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as UnappliedRef[];
    },
  });
}

/**
 * What this vault is holding back, said where somebody would notice.
 *
 * Files in a vault directory are not live until they are applied, which is
 * right: dropping a file into a folder should not silently change what the
 * vault says. But nothing announced it. A vault built by a generator had
 * twenty-nine gaps, twenty-nine stakeholder maps and twelve resources on
 * disk, valid, and every screen showed none of them, with the only way to
 * find out buried under Snapshots (Programme Lead, 2026-09-29).
 *
 * So each directory says what it is withholding, and applies it in one
 * move rather than seventy.
 */
export function UnappliedBar({ kind }: { kind: string }) {
  const { data } = useUnapplied();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const c = copy.sheets.unapplied;

  const mine = (data ?? []).filter((r) => r.kind === kind);

  const apply = useMutation({
    mutationFn: async (refs: UnappliedRef[]) => {
      // One call for the batch. One request per ref rewrote vault.yaml,
      // rehydrated the whole store and reindexed every reference each
      // time, so applying seventy files did seventy full walks and felt
      // exactly as slow as that sounds (Programme Lead, 2026-09-29).
      const { error } = await client.POST("/vault/apply", {
        body: { refs: refs.map((r) => `${r.kind}/${r.id}`) },
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setFailed(false);
      // Everything that could be showing a list without these in it. The
      // sheet's own rows are keyed "sheet-summaries", not "manifests", and
      // missing that made twenty-nine applied gaps look like none applied.
      // Awaited, and refetchType "all" rather than the default: a list
      // rendered by a component that is not currently mounted is left
      // stale by the default, which is why an applied file only appeared
      // after a reload or a trip away and back. The bar hides itself the
      // moment its own query comes back empty.
      await Promise.all(
        [
          ["vault-unapplied"],
          ["vault"],
          ["kinds"],
          ["manifests", kind],
          ["sheet-summaries", kind],
          ["sheet-ref-options", kind],
        ].map((key) => queryClient.invalidateQueries({ queryKey: key, refetchType: "all" })),
      );
    },
    onError: () => setFailed(true),
  });

  if (mine.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
      <FileQuestion className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm">
        {c.count(mine.length)} <span className="text-muted-foreground">{c.hint}</span>
      </p>
      {failed ? <p className="text-sm text-destructive">{c.failed}</p> : null}
      <Button
        type="button"
        size="sm"
        disabled={apply.isPending}
        onClick={() => apply.mutate(mine)}
      >
        {c.applyAll(mine.length)}
      </Button>
    </div>
  );
}

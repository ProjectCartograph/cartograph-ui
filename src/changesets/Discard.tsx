import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import { activeChangeSet } from "@/client/active";
import { useClient } from "@/client/context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/copy";

const c = copy.discard;

/**
 * Discards a change set: it closes without saving (engine CloseChangeSet),
 * so nothing in it reaches the record and the records stay as they are.
 * Asked once, since the drafts are not kept for working in again. The
 * change set being worked in stops being the active one.
 */
export function DiscardDialog({ set, title, open, onOpenChange, onDiscarded }: { set: string; title: string; open: boolean; onOpenChange: (open: boolean) => void; onDiscarded?: () => void }) {
  const client = useClient();
  const queries = useQueryClient();
  const discard = useMutation({
    mutationFn: () => client.closeChangeSet(set, c.reason),
    onSuccess: () => {
      if (activeChangeSet.get() === set) activeChangeSet.set(undefined);
      void queries.invalidateQueries();
      onOpenChange(false);
      onDiscarded?.();
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{c.title(title)}</DialogTitle>
          <DialogDescription>{c.body}</DialogDescription>
        </DialogHeader>
        {discard.isError ? <p className="text-sm text-destructive">{c.failed}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {c.keep}
          </Button>
          <Button variant="destructive" disabled={discard.isPending} onClick={() => discard.mutate()} aria-label={c.confirmLabel} title={c.confirmLabel}>
            <Trash2 />
            {c.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A Discard button with its confirmation. */
export function DiscardButton({ set, title, size = "sm", variant = "ghost", onDiscarded }: { set: string; title: string; size?: "sm" | "icon"; variant?: "ghost" | "outline"; onDiscarded?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)} aria-label={c.label} title={c.label} data-cartograph-action="discard">
        <Trash2 />
        {size === "icon" ? null : c.button}
      </Button>
      <DiscardDialog set={set} title={title} open={open} onOpenChange={setOpen} onDiscarded={onDiscarded} />
    </>
  );
}

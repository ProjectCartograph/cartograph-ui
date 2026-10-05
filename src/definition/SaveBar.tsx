import { useState } from "react";
import { Save, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/copy";
import { useDefinitionStore } from "./store";

/**
 * The moment of deciding.
 *
 * Autosave stages a draft in the vault's staging directory and does not put
 * it in the vault, so a kind that had only autosave had no way to finish:
 * the write was continuous and the decision never happened. This is the
 * decision — one control, shown only while there is a draft to act on, so
 * a definition that is already saved offers nothing to press.
 *
 * The discard beside it is the other half, and it is the half that could not
 * exist before: the working copy used to be the file, so there was nothing
 * to go back to.
 */
export function SaveBar() {
  const store = useDefinitionStore<unknown>();
  const c = copy.definition.save;
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problems, setProblems] = useState<{ path?: string; message: string }[]>([]);

  async function handleSave() {
    setSaving(true);
    setProblems([]);
    const result = await store.save();
    setSaving(false);
    if (!result.ok) setProblems(result.problems.length > 0 ? result.problems : [{ message: c.failed }]);
  }

  async function handleDiscard() {
    setConfirming(false);
    setProblems([]);
    await store.discardDraft();
  }

  if (!store.staged) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4" data-cartograph-region="save-bar">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary">
          <span className="truncate">{c.staged}</span>
        </Badge>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            <Undo2 />
            {c.discard}
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={handleSave} data-celebrate="">
            <Save />
            {c.button}
          </Button>
        </div>
      </div>
      {problems.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {problems.map((problem, i) => (
            <li key={`${problem.path ?? ""}-${i}`} className="text-sm text-destructive">
              {problem.path ? `${problem.path}: ` : ""}
              {problem.message}
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-sm" data-cartograph-region="dialog-discard">
          <DialogHeader>
            <DialogTitle>{c.discardTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{c.discardBody}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              {c.cancel}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDiscard}>
              {c.discardConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

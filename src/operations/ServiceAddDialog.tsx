import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClient } from "@/client/context";
import { ClientError } from "@/client/port";
import { copy } from "@/copy";
import { slugify } from "@/surfaces/sheet/schema";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";

const sc = copy.operations.add;

/**
 * A new service, from the project that sets it up (TAXONOMY.md D30). It is
 * recorded first, as planned, with what the schema requires (a name, what
 * it will do, the team that will run it), so the project can name it as
 * where it lands. The rest is the service's own page.
 */
export function ServiceAddDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (id: string, name: string) => void;
}) {
  const queryClient = useQueryClient();
  const client = useClient();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [team, setTeam] = useState<string | undefined>();
  const [refused, setRefused] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const ready = !!name.trim() && !!purpose.trim() && !!team;

  function close(next: boolean) {
    if (!next) {
      setName("");
      setPurpose("");
      setTeam(undefined);
      setRefused(false);
      setFailed(null);
    }
    onOpenChange(next);
  }

  async function save() {
    if (!ready) {
      setRefused(true);
      return;
    }
    const id = slugify(name);
    const manifest = {
      apiVersion: "cartograph/v1",
      kind: "Operation",
      metadata: { id, name: name.trim() },
      spec: { purpose: purpose.trim(), status: "planned", team },
    };
    try {
      await client.saveVersion("Operation", id, manifest, sc.reason);
    } catch (e) {
      if (!(e instanceof ClientError)) throw e;
      setFailed(sc.failed);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["manifests", "Operation"] });
    queryClient.invalidateQueries({ queryKey: ["sheet-ref-options", "Operation"] });
    onAdded?.(id, name.trim());
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg" data-cartograph-region="dialog-service-add">
        <DialogHeader>
          <DialogTitle>{sc.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="service-new-name">{copy.operations.nameLabel}</Label>
            <Input
              id="service-new-name"
              data-cartograph-field="/metadata/name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 160))}
              aria-invalid={refused && !name.trim()}
              maxLength={160}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="service-new-purpose">{copy.operations.purposeLabel}</Label>
            <Textarea
              id="service-new-purpose"
              data-cartograph-field="/spec/purpose"
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              aria-invalid={refused && !purpose.trim()}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{copy.operations.teamLabel}</Label>
            <ReferencePicker
              data-cartograph-field="/spec/team"
              refKind="Team"
              value={team}
              onChange={setTeam}
              label={copy.operations.teamLabel}
            />
          </div>
          {failed ? <p className="text-xs text-destructive">{failed}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => close(false)}>
            {copy.common.cancel}
          </Button>
          <Button type="button" onClick={save}>
            {sc.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

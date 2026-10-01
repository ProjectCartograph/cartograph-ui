import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { slugify } from "@/surfaces/sheet/schema";
import { useProjectStore } from "./store";
import type { ProjectRoleKind, Ref } from "./types";

const rc = copy.projects.roleDialog;

/** An id for a new role, derived from the catalogue entry it names so a
 * reader of the YAML can tell what it is, and numbered when two roles slug
 * the same. Anything that slugs to nothing usable falls back to a plain
 * numbered id. */
function uniqueRoleID(from: string, taken: (string | undefined)[]): string {
  const used = new Set(taken.filter((t): t is string => Boolean(t)));
  const base = slugify(from).slice(0, 48) || "role";
  if (base.length >= 2 && !used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base.length >= 2 ? base : "role"}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * Names a role that does not exist yet and files it in Resources, from
 * wherever it was discovered.
 *
 * Deliverables has asked who verifies an acceptance criterion since it
 * was built, and Success now asks who tracks and who confirms each line;
 * both are places a role is thought of. Resources moved ahead of them on
 * 2026-09-27 so neither ever opens on an empty picker, and this stays
 * for the role nobody thought of until they needed it.
 *
 * The new role is filed as a position, never a RACI letter: accountable,
 * responsible, consulted and informed left the role list the same day,
 * because a letter says how somebody relates to a task and tasks live in
 * the delivery tool.
 */
export function NameRoleDialog({
  open,
  onOpenChange,
  onNamed,
  kind = "teamMember",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with a reference to the new role, once it is in
   * `spec.resources`. A reference rather than the title, so what the
   * caller stores cannot go stale when the title changes. */
  onNamed: (ref: Ref) => void;
  /** The position the new role holds. */
  kind?: ProjectRoleKind;
}) {
  const store = useProjectStore();
  const [resource, setResource] = useState<string | undefined>(undefined);

  function reset() {
    setResource(undefined);
  }

  function add() {
    if (!resource) return;
    const existing = store.spec.resources ?? [];
    // The same catalogue entry can hold two positions on one project, so a
    // row is the pair. Naming a pair that is already there selects it
    // rather than filing a second one.
    const already = existing.find((r) => r.resource === resource && r.role === kind);
    const id = already?.id ?? uniqueRoleID(resource, existing.map((r) => r.id));
    if (!already) {
      store.updateSpec((s) => ({
        ...s,
        resources: [...(s.resources ?? []), { id, role: kind, resource }],
      }));
    }
    onNamed({ local: "resources", id });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rc.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {/* One field. It asked for a free-text name as well until
              2026-09-29, and the two could not be told apart. Where the
              catalogue has no entry yet, the picker's own add makes one,
              which is the same act as typing a name and better: the next
              project can point at it. */}
          <div className="flex flex-col gap-2">
            <FieldHeading label={rc.resourceLabel} examples={rc.examples} />
            <ReferencePicker
              refKind="Resource"
              value={resource}
              onChange={(v) => setResource(v || undefined)}
              placeholder={rc.resourcePlaceholder}
              label={rc.resourceLabel}
            />
          </div>
          <Badge variant="secondary" className="self-start font-normal">
            {copy.projects.resources.roleKind[kind] ?? kind}
          </Badge>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {copy.projects.common.cancel}
          </Button>
          <Button type="button" disabled={!resource} onClick={add}>
            {copy.projects.common.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { CloudOff } from "lucide-react";

import { copy } from "@/copy";
import { useConnection } from "./connection";

/**
 * A quiet line while the sync connection is down. Editing carries on: the
 * draft is kept on this device and syncs when the connection returns.
 */
export function OfflineNote() {
  const status = useConnection();
  if (status !== "offline") return null;
  return (
    <p role="status" data-slot="offline-note" className="flex min-w-0 items-start gap-1.5 text-sm text-pretty text-muted-foreground">
      <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{copy.collab.offline}</span>
    </p>
  );
}

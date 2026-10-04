import { Archive, Hourglass, Repeat } from "lucide-react";

/** Where a service is in its life (TAXONOMY.md D30), and its mark. */
export type ServiceStatus = "planned" | "running" | "retired";

export const STATUS_ICON = { planned: Hourglass, running: Repeat, retired: Archive } as const;

/** A service's status; running when it says none, as every service saved
 * before 2.7 does. */
export function statusOf(spec: { status?: unknown } | undefined): ServiceStatus {
  const s = spec?.status;
  return s === "planned" || s === "retired" ? s : "running";
}

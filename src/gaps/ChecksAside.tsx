import { useParams } from "@tanstack/react-router";

import { DefinitionCheckPanel } from "@/definition/CheckPanel";
import { useGapChecks } from "./api";

/** The gap's checks, scoped to the step on screen. */
export function ChecksAside({ section }: { section: string }) {
  const { id } = useParams({ from: "/gaps/$id" });
  const query = useGapChecks(id);
  return <DefinitionCheckPanel items={query.data ?? []} loading={query.isLoading} section={section} />;
}

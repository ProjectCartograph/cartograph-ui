import { useParams } from "@tanstack/react-router";

import { DefinitionCheckPanel } from "@/definition/CheckPanel";
import { useOperationChecks } from "./api";

/** The operation's checks, scoped to the step on screen. */
export function ChecksAside({ section }: { section: string }) {
  const { id } = useParams({ from: "/operations/$id" });
  const query = useOperationChecks(id);
  return <DefinitionCheckPanel items={query.data ?? []} loading={query.isLoading} section={section} />;
}

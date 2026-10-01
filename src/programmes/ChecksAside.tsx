import { useParams } from "@tanstack/react-router";

import { DefinitionCheckPanel } from "@/definition/CheckPanel";
import { useProgrammeChecks } from "./api";

/**
 * The programme's checks, scoped to the step on screen.
 *
 * The id comes from the route rather than a prop, so every step hosts this
 * the same way and no route has to thread a param it already has.
 */
export function ChecksAside({ section }: { section: string }) {
  const { id } = useParams({ from: "/programmes/$id" });
  const query = useProgrammeChecks(id);
  return (
    <DefinitionCheckPanel
      items={query.data ?? []}
      loading={query.isLoading}
      section={section}
    />
  );
}

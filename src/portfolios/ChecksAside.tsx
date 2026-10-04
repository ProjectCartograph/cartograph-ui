import { useParams } from "@tanstack/react-router";

import { DefinitionCheckPanel } from "@/definition/CheckPanel";
import { usePortfolioChecks } from "./api";

/** The portfolio's checks, scoped to the step on screen. */
export function ChecksAside({ section }: { section: string }) {
  const { id } = useParams({ from: "/portfolios/$id" });
  const query = usePortfolioChecks(id);
  return <DefinitionCheckPanel items={query.data ?? []} loading={query.isLoading} section={section} />;
}

import { getRouteApi, Link, Navigate, Outlet } from "@tanstack/react-router";
import { BriefcaseBusiness, Plus } from "lucide-react";

import { WriteGate } from "@/access/WriteGate";
import { Explorer } from "@/components/explorer/Explorer";
import { usePortfolioRows } from "@/components/explorer/registers";
import { Button } from "@/components/ui/button";
import { copy, plusNoun } from "@/copy";
import { NewDefinition } from "@/definition/NewDefinition";
import { DefinitionStoreProvider } from "@/definition/store";
import { blankPortfolioSpec } from "./types";

const one = getRouteApi("/portfolios/$id");
const opening = getRouteApi("/portfolios/$id/");
const fresh = getRouteApi("/portfolios/new");

/** The portfolios, as a file explorer (components/explorer/Explorer.tsx). */
export function PortfoliosPage() {
  const { rows, loading } = usePortfolioRows();
  return (
    <div className="flex flex-col gap-4">
      <Explorer
        title={copy.rail.portfolios}
        icon={BriefcaseBusiness}
        rows={rows}
        loading={loading}
        route="/portfolios/$id"
        action={
          <Button asChild aria-label={copy.portfolios.newLink}>
            <Link to="/portfolios/new">
              <Plus />
              {plusNoun(copy.portfolios.newLink)}
            </Link>
          </Button>
        }
      />
    </div>
  );
}

/** One portfolio, held in the shared definition store for its steps. */
export function PortfolioLayout() {
  const { id } = one.useParams();
  return (
    <DefinitionStoreProvider kind="Portfolio" id={id} blank={blankPortfolioSpec}>
      <WriteGate kind="Portfolio" id={id}>
        <Outlet />
      </WriteGate>
    </DefinitionStoreProvider>
  );
}

/** A portfolio opens on its aim. */
export function PortfolioOpening() {
  const { id } = opening.useParams();
  return <Navigate to="/portfolios/$id/aim" params={{ id }} replace />;
}

export function NewPortfolioPage() {
  const c = copy.portfolios.newPortfolio;
  return (
    <NewDefinition
      initialName={fresh.useSearch().name}
      kind="Portfolio"
      title={c.title}
      subtitle={c.subtitle}
      nameLabel={c.nameLabel}
      namePlaceholder={c.namePlaceholder}
      teamLabel={c.teamLabel}
      teamField="/spec/leadTeam"
      teamPlaceholder={c.teamPlaceholder}
      createLabel={c.create}
      errorLabel={c.generalError}
      // The aim is asked for on the first step, not guessed here.
      specFrom={(_name, team) => ({ aim: "", leadTeam: team })}
      firstStep="/portfolios/$id/aim"
    />
  );
}

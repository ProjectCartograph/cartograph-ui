import { ComboboxMultiple } from "@/components/ui/combobox";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { PortfolioSpec } from "../types";

const fc = copy.portfolios;

/** Who decides, with which budgets, how often, and inside what. */
export function GovernanceSection() {
  useSectionAutosave();
  const store = useDefinitionStore<PortfolioSpec>();
  const spec = store.spec;
  const { data: budgets } = useReferenceOptions("FundingSource");
  const { data: portfolios } = useReferenceOptions("Portfolio");
  const many = (field: "funding" | "portfolios", label: string, options: { value: string; label: string }[], path: string) => (
    <div className="flex flex-col gap-2">
      <FieldHeading label={label} />
      <ComboboxMultiple
        data-cartograph-field={path}
        options={options}
        value={spec[field] ?? []}
        onValueChange={(next) => store.updateSpec((s) => ({ ...s, [field]: next.length > 0 ? next : undefined }))}
        emptyText={copy.sheets.dialog.noMatches}
        removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
        aria-label={label}
      />
    </div>
  );
  return (
    <div className="flex max-w-2xl flex-col gap-6" data-cartograph-region="portfolio-governance">
      <div className="flex flex-col gap-2">
        <FieldHeading label={fc.leadTeamLabel} />
        <ReferencePicker
          data-cartograph-field="/spec/leadTeam"
          refKind="Team"
          value={spec.leadTeam}
          onChange={(v) => store.updateSpec((s) => ({ ...s, leadTeam: v }))}
          label={fc.leadTeamLabel}
        />
      </div>
      {many("funding", fc.fundingLabel, budgets?.options ?? [], "/spec/funding")}
      <div className="flex flex-col gap-2">
        <FieldHeading label={fc.reviewCycleLabel} />
        <ReferencePicker
          data-cartograph-field="/spec/reviewCycle"
          refKind="ReportingCycle"
          value={spec.reviewCycle}
          onChange={(v) => store.updateSpec((s) => ({ ...s, reviewCycle: v }))}
          label={fc.reviewCycleLabel}
        />
      </div>
      {many("portfolios", fc.partOfLabel, (portfolios?.options ?? []).filter((o) => o.value !== store.id), "/spec/portfolios")}
    </div>
  );
}

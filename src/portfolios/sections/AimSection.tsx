import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import type { PortfolioSpec } from "../types";

const fc = copy.portfolios;

/** What the portfolio invests in, and to what end. */
export function AimSection() {
  useSectionAutosave();
  const store = useDefinitionStore<PortfolioSpec>();
  return (
    <div className="flex max-w-3xl flex-col gap-6" data-cartograph-region="portfolio-aim">
      <div className="flex flex-col gap-2">
        <FieldHeading label={fc.newPortfolio.nameLabel} htmlFor="portfolio-name" />
        <Input
          id="portfolio-name"
          data-cartograph-field="/metadata/name"
          value={store.name}
          onChange={(e) => store.setName(e.target.value.slice(0, 160))}
          maxLength={160}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={fc.aimLabel} htmlFor="portfolio-aim" />
        <Textarea
          id="portfolio-aim"
          data-cartograph-field="/spec/aim"
          value={store.spec.aim ?? ""}
          onChange={(e) => store.updateSpec((s) => ({ ...s, aim: e.target.value.slice(0, 400) }))}
          rows={3}
        />
      </div>
    </div>
  );
}

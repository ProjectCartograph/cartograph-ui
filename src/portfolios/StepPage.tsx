import type { ReactNode } from "react";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "./ChecksAside";
import { PORTFOLIO_STEPS } from "./types";

/** One step of the portfolio's walk, in the programme's frame. */
export function PortfolioStep({ section, children }: { section: string; children: ReactNode }) {
  const c = copy.portfolios.sections[section];
  return (
    <DefinitionShell
      home="/portfolios"
      steps={PORTFOLIO_STEPS}
      current={section}
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section={section} />
          <ChecksAside section={section} />
        </>
      }
    >
      {children}
    </DefinitionShell>
  );
}

import type { ComponentType } from "react";

import { copy } from "@/copy";
import type { InitiationSection, Stage } from "../types";
import { AimSection } from "./AimSection";
import { BeneficiariesSection } from "./BeneficiariesSection";
import { DataSection } from "./DataSection";
import { DeliverablesSection } from "./DeliverablesSection";
import { AlignmentSection, MeasuresSection } from "./GoalsSection";
import { HandoverSection } from "./HandoverSection";
import { MandateSection } from "./MandateSection";
import { ResourcesSection } from "./ResourcesSection";
import { RisksSection } from "./RisksSection";
import { ScopeSection } from "./ScopeSection";
import { StakeholdersSection } from "./StakeholdersSection";
import { SuccessSection } from "./SuccessSection";
import { TimelineSection } from "./TimelineSection";

const pc = copy.projects;

/** What each step of the walk shows, and the words above it. A stage is
 * these, one after another (TAXONOMY.md D33). */
export const SECTION_VIEW: Record<InitiationSection, { heading: string; subtitle: string; View: ComponentType }> = {
  goals: { ...pc.align, View: AlignmentSection },
  beneficiaries: { ...pc.beneficiaries, View: BeneficiariesSection },
  aim: { ...pc.aim, View: AimSection },
  measures: { ...pc.measures, View: MeasuresSection },
  // Roles and funding, then the mandate the project works under: who
  // decides, who pays, and on whose authority.
  resources: {
    ...pc.resources,
    View: () => (
      <div className="flex flex-col gap-6">
        <ResourcesSection />
        <MandateSection />
      </div>
    ),
  },
  stakeholders: { ...pc.stakeholdersStep, View: StakeholdersSection },
  scope: { ...pc.scope, View: ScopeSection },
  deliverables: { ...pc.deliverables, View: DeliverablesSection },
  timeline: { ...pc.timeline, View: TimelineSection },
  data: { ...pc.data, View: DataSection },
  risks: { ...pc.risks, View: RisksSection },
  success: { ...pc.success, View: SuccessSection },
  landing: { ...pc.landing, View: () => <HandoverSection /> },
};

/** Checks a stage shows besides its own steps': the deliverables' closing
 * acceptance is settled where the deliverables are written. */
export const STAGE_ALSO_CHECKS: Partial<Record<Stage, string[]>> = { scope: ["closing"] };

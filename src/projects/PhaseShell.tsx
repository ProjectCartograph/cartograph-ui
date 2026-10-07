import { RequiredMarks } from "@/components/RequiredMarks";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { FlowBack, FlowNav, FlowNext } from "@/components/walker";
import { copy } from "@/copy";
import { CheckPanel } from "./CheckPanel";
import { ProjectSectionNotes } from "./SectionNotes";
import { ProjectHeaderBar } from "./Chrome";
import { ProjectScrubber } from "./InitiationShell";
import { useProjectStore } from "./store";
import { stepIcon } from "./steps";
import { STEPS } from "./types";

const pc = copy.projects;

/** Closing and Landing: one section each, no section sub-rail, just the
 * three-phase stepper (rule 3: "nothing else is a step"). */
export function PhaseShell({
  id,
  phase,
  heading,
  subtitle,
  children,
}: {
  id: string;
  phase: "closing" | "landing";
  heading: string;
  subtitle: string;
  children: ReactNode;
}) {
  const store = useProjectStore();
  // Closing is not one of the initiation steps: it follows the last of
  // them, in the Handover stage, so Back returns to Landing and Next is
  // the project's record.
  const idx = phase === "closing" ? STEPS.length : STEPS.findIndex((s) => s.section === phase);
  const prev = idx > 0 ? STEPS[idx - 1] : undefined;
  const next = idx >= 0 && idx < STEPS.length - 1 ? STEPS[idx + 1] : undefined;
  return (
    <div className="flex flex-col gap-4">
      <ProjectHeaderBar />
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground text-pretty">{subtitle}</p>
      </div>
      <ProjectScrubber id={id} section={phase} />
      <RequiredMarks kind="Project" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_18rem]">
        <div className="min-w-0 flex flex-col gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/5 sm:p-6" data-cartograph-region="section">
          {store.loadError ? (
            <p className="text-sm text-destructive">{pc.record.error}</p>
          ) : !store.loaded ? (
            <p className="text-sm text-muted-foreground">{pc.record.loading}</p>
          ) : (
            <>
              {/* The step arrives from the side the walk is heading (engine
                  DESIGN_RULES "The interface answers"). */}
              <div key={phase} className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-3 duration-250 ease-enter">
                {children}
              </div>
              {/* Closing and Landing are one section each, so the phase
                  name is the step the note belongs to. */}
              <ProjectSectionNotes section={phase} />
            </>
          )}
          {/* Closing and Landing are steps in the same walk as the rest
              (Refine ends on Closing, Polish ends on Landing), so Back and
              Next read their neighbours out of STEPS like every other
              step rather than naming them here. */}
          <FlowNav>
            <FlowBack
              label={pc.back}
              link={(c) =>
                prev ? (
                  <Link to={`/projects/$id${prev.path}`} params={{ id }}>
                    {c}
                  </Link>
                ) : (
                  <Link to="/projects/$id" params={{ id }}>
                    {c}
                  </Link>
                )
              }
            />
            {next ? (
              <FlowNext
                label={pc.nextTo(pc.sections[next.section] ?? next.section)}
                icon={stepIcon(next.section)}
                link={(c) => (
                  <Link to={`/projects/$id${next.path}`} params={{ id }}>
                    {c}
                  </Link>
                )}
              />
            ) : (
              <FlowNext
                label={pc.record.recordLink}
                link={(c) => (
                  <Link to="/projects/$id" params={{ id }}>
                    {c}
                  </Link>
                )}
              />
            )}
          </FlowNav>
        </div>
        <div className="flex flex-col gap-4">
          <CheckPanel id={id} draft scopePhase={phase} />
        </div>
      </div>
    </div>
  );
}

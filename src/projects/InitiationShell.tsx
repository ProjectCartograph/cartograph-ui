import { AssemblyStrip } from "./Assembly";
import type { ReactNode } from "react";
import { SectionPeers, sectionRing, usePeersOn } from "@/collab/SectionPeers";
import { ShowInGraph } from "@/graph/ShowInGraph";
import { Link } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileText, OctagonAlert, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { useProjectChecks } from "./api";
import { CheckPanel } from "./CheckPanel";
import { ProjectSectionNotes } from "./SectionNotes";
import { StageStepper, ProjectHeaderBar } from "./Chrome";
import { useProjectStore } from "./store";
import { STAGES, STEPS, stageOfSection, stepsOfStage, type InitiationSection } from "./types";
import { STAGE_ICON, stepIcon } from "./steps";

const pc = copy.projects;

/**
 * The left section rail for the Initiation phase: every section, its own
 * state dot (worst check state among that section's items, or a neutral
 * dot when nothing has been checked yet), the current section highlighted.
 * One section on screen at a time (rule 4); Back and Next below the main
 * pane walk the same fixed order.
 */
function SectionRail({ id, current }: { id: string; current: InitiationSection }) {
  const checksQuery = useProjectChecks(id, true);
  const bySection = new Map<string, string>();
  for (const item of checksQuery.data?.items ?? []) {
    const existing = bySection.get(item.section);
    const rank = (s: string) => (s === "block" ? 2 : s === "warn" ? 1 : 0);
    if (!existing || rank(item.state) > rank(existing)) bySection.set(item.section, item.state);
  }

  const here = stageOfSection(current);

  return (
    <div className="flex w-56 shrink-0 flex-col gap-1 rounded-xl p-2 bg-card ring-1 ring-foreground/10" data-cartograph-region="section-rail">
      {/* The whole walk, not the stage in hand. Somebody filling a
          definition in wants to see what there is to assemble before
          assembling it (Programme Lead, 2026-09-29), and a rail that
          shows four of twelve steps answers a question nobody asked. */}
      {STAGES.map((stage) => (
        <div key={stage} className="flex flex-col gap-1 pt-2 first:pt-0">
          <p
            className={`flex items-center gap-1.5 px-2 pb-1 text-xs font-medium uppercase ${
              stage === here ? "text-foreground" : "text-muted-foreground"
            }`}
            title={pc.stageQuestion[stage]}
          >
            {(() => {
              const StageIcon = STAGE_ICON[stage];
              return <StageIcon className="size-3.5 shrink-0" aria-hidden="true" />;
            })()}
            {pc.stages[stage]}
          </p>
          {stepsOfStage(stage).map((step) => (
            <ProjectStep key={step.section} id={id} path={step.path} section={step.section} isCurrent={step.section === current} state={bySection.get(step.section)} />
          ))}
        </div>
      ))}

      {/* Not steps of the walk: what the steps add up to, read from the
          definition every time either is opened. */}
      <Separator className="my-1" />
      <Link
        to="/projects/$id/charter"
        params={{ id }}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent/50"
      >
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{copy.charter.title}</span>
      </Link>
      <Link
        to="/projects/$id/framework"
        params={{ id }}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent/50"
      >
        <Table2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{copy.framework.title}</span>
      </Link>
    </div>
  );
}

/** Back and Next, as real buttons: Back a quiet outline, Next the primary
 * action naming where it goes, so the step a person is on always has one
 * obvious way forward. */
export function InitiationBackNext({ id, section }: { id: string; section: InitiationSection }) {
  const idx = STEPS.findIndex((s) => s.section === section);
  const prev = idx > 0 ? STEPS[idx - 1] : undefined;
  const next = idx >= 0 && idx < STEPS.length - 1 ? STEPS[idx + 1] : undefined;
  const NextIcon = next ? stepIcon(next.section) : undefined;

  return (
    <div className="flex items-center justify-between gap-2 pt-6">
      <Button asChild variant="ghost" size="lg">
        {prev ? (
          <Link to={`/projects/$id${prev.path}`} params={{ id }}>
            <ArrowLeft />
            {pc.back}
          </Link>
        ) : (
          <Link to="/projects/$id" params={{ id }}>
            <ArrowLeft />
            {pc.back}
          </Link>
        )}
      </Button>
      <Button asChild size="lg">
        {next ? (
          <Link to={`/projects/$id${next.path}`} params={{ id }}>
            {NextIcon ? <NextIcon /> : null}
            {pc.nextTo(pc.sections[next.section] ?? next.section)}
            <ArrowRight />
          </Link>
        ) : (
          <Link to="/projects/$id/closing" params={{ id }}>
            {pc.nextTo(pc.stepper.closing)}
            <ArrowRight />
          </Link>
        )}
      </Button>
    </div>
  );
}

export function InitiationShell({
  id,
  section,
  heading,
  subtitle,
  children,
}: {
  id: string;
  section: InitiationSection;
  heading: string;
  subtitle: string;
  children: ReactNode;
}) {
  const store = useProjectStore();
  return (
    <div className="flex flex-col gap-4">
      <ProjectHeaderBar />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <ShowInGraph kind="Project" id={id} />
          <StageStepper id={id} current={stageOfSection(section)} />
        </div>
      </div>
      <AssemblyStrip id={id} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[14rem_1fr_18rem]">
        <SectionRail id={id} current={section} />
        <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/5 sm:p-6" data-cartograph-region="section">
          {store.loadError ? (
            <p className="text-sm text-destructive">{pc.record.error}</p>
          ) : !store.loaded ? (
            <p className="text-sm text-muted-foreground">{pc.record.loading}</p>
          ) : (
            <>
              {/* The step arrives from the side the walk is heading (engine
                  DESIGN_RULES "The interface answers"). */}
              <div key={section} className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-3 duration-250 ease-enter">
                {children}
              </div>
              <ProjectSectionNotes section={section} />
            </>
          )}
          <InitiationBackNext id={id} section={section} />
        </div>
        <div className="flex flex-col gap-4">
          <CheckPanel id={id} draft scopeSection={section} scopePhase="initiation" />
        </div>
      </div>
    </div>
  );
}

/** One step of the project's walk: its state, and who else is on it. */
function ProjectStep({ id, path, section, isCurrent, state }: { id: string; path: string; section: string; isCurrent: boolean; state?: string }) {
  const Icon = stepIcon(section);
  const others = usePeersOn(`/projects/${id}${path}`);
  const shown = isCurrent ? [] : others;
  const at = shown.length ? "" : "ml-auto ";
  return (
    <Link
      to={`/projects/$id${path}` as never}
      params={{ id } as never}
      style={sectionRing(shown)}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ease-standard active:bg-muted ${
        isCurrent ? "bg-primary/10 font-medium text-primary shadow-[inset_2px_0_0_var(--color-primary)]" : "text-foreground hover:bg-accent/60"
      }`}
    >
      {Icon ? <Icon className={`size-4 shrink-0 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" /> : null}
      <span className="truncate">{pc.sections[section]}</span>
      <SectionPeers peers={shown} />
      {state === "ok" ? (
        <CheckCircle2 className={`${at}size-3.5 shrink-0 text-success/70`} aria-label={pc.checks.railDone} />
      ) : state === "block" ? (
        <OctagonAlert className={`${at}size-3.5 shrink-0 text-destructive`} aria-label={pc.checks.railBlocked} />
      ) : state === "warn" ? (
        <AlertTriangle className={`${at}size-3.5 shrink-0 text-warning`} aria-label={pc.checks.railWarn} />
      ) : null}
    </Link>
  );
}

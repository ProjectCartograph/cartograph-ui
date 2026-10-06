import { AssemblyStrip } from "./Assembly";
import { createElement, useEffect } from "react";
import { FromIdeaProvider } from "@/components/FromIdea";
import { SectionPeers, sectionRing, usePeersOn } from "@/collab/SectionPeers";
import { ShowInGraph } from "@/graph/ShowInGraph";
import { Link } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, FileText, OctagonAlert, Table2 } from "lucide-react";

import { RailSheet } from "@/components/RailSheet";
import { FlowBack, FlowNav, FlowNext } from "@/components/walker";
import { WorkTextProvider } from "@/components/relevance";
import { copy } from "@/copy";
import { useProjectChecks } from "./api";
import { CheckPanel } from "./CheckPanel";
import { ProjectSectionNotes } from "./SectionNotes";
import { StageStepper, ProjectHeaderBar } from "./Chrome";
import { useProjectStore } from "./store";
import { SECTION_VIEW, STAGE_ALSO_CHECKS } from "./sections/registry";
import { STAGES, stageOfSection, stepsOfStage, type InitiationSection, type Stage } from "./types";
import { STAGE_ICON, stepIcon } from "./steps";

const pc = copy.projects;

/**
 * The left rail for the Initiation phase: every stage and the steps in it,
 * each step with its own state dot (worst check state among that step's
 * items, or none when nothing has been checked yet), the stage on screen
 * highlighted. One stage on screen at a time (TAXONOMY.md D33); a step
 * opens its stage at that step, and Back and Next walk the stages.
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
    <div className="flex w-full shrink-0 flex-col gap-1 rounded-xl p-2 bg-card ring-1 ring-foreground/10 xl:w-56" data-cartograph-region="section-rail">
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
            <ProjectStep key={step.section} id={id} path={step.path} section={step.section} isCurrent={stage === here} state={bySection.get(step.section)} />
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
 * action naming the stage it goes to, so a stage always has one obvious
 * way forward. After the last stage, the closing page. */
export function InitiationBackNext({ id, stage }: { id: string; stage: Stage }) {
  const idx = STAGES.indexOf(stage);
  const prev = idx > 0 ? stepsOfStage(STAGES[idx - 1])[0] : undefined;
  const nextStage = idx < STAGES.length - 1 ? STAGES[idx + 1] : undefined;
  const next = nextStage ? stepsOfStage(nextStage)[0] : undefined;

  return (
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
      {next && nextStage ? (
        <FlowNext
          label={pc.nextTo(pc.stages[nextStage])}
          icon={STAGE_ICON[nextStage]}
          link={(c) => (
            <Link to={`/projects/$id${next.path}`} params={{ id }}>
              {c}
            </Link>
          )}
        />
      ) : (
        <FlowNext
          label={pc.nextTo(pc.stepper.closing)}
          link={(c) => (
            <Link to="/projects/$id/closing" params={{ id }}>
              {c}
            </Link>
          )}
        />
      )}
    </FlowNav>
  );
}

/**
 * One stage of the walk on one screen: its steps one after another, each
 * under its own heading, with the checks of all of them beside (TAXONOMY.md
 * D33). Opened at a step, the screen scrolls to it, so a link to any step
 * (a check's fix, a rail entry) lands where it points.
 */
export function InitiationShell({ id, section }: { id: string; section: InitiationSection }) {
  const store = useProjectStore();
  const stage = stageOfSection(section);
  // The project's own words so far, for every picker to rank the
  // workspace against (engine docs/adr/0023).
  const spec = store.spec;
  const workText = [
    store.name,
    spec.summary.about,
    ...(spec.summary.problems ?? []).flatMap((p) => [p.problem?.situation, p.change?.what]),
    ...(spec.objectives ?? []).map((o) => o.objective),
  ]
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .join(". ");
  const steps = stepsOfStage(stage);
  useEffect(() => {
    if (!store.loaded || steps[0]?.section === section) return;
    document.getElementById(`step-${section}`)?.scrollIntoView({ block: "start" });
  }, [section, store.loaded, steps]);
  return (
    <WorkTextProvider text={workText}>
    <FromIdeaProvider kind="Project" idea={spec.summary.idea}>
    <div className="flex flex-col gap-4">
      <ProjectHeaderBar />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{pc.stages[stage]}</h1>
          <p className="text-muted-foreground text-pretty">{pc.stageQuestion[stage]}</p>
        </div>
        <div className="shrink-0">
          <ShowInGraph kind="Project" id={id} />
        </div>
      </div>
      {/* The stages as every flow shows its progress, scrolled sideways
          when they do not fit; the rail beside the page lists their
          steps. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <StageStepper id={id} current={stage} />
      </div>
      <AssemblyStrip id={id} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[14rem_1fr_18rem]">
        {/* Beside the page on a wide screen; behind one small button on a
            narrow one, where the stages across the top show the way. */}
        <div className="hidden xl:block">
          <SectionRail id={id} current={section} />
        </div>
        <RailSheet current={pc.stages[stage]}>
          <SectionRail id={id} current={section} />
        </RailSheet>
        <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/5 sm:p-6" data-cartograph-region="section">
          {store.loadError ? (
            <p className="text-sm text-destructive">{pc.record.error}</p>
          ) : !store.loaded ? (
            <p className="text-sm text-muted-foreground">{pc.record.loading}</p>
          ) : (
            // The stage arrives from the side the walk is heading (engine
            // DESIGN_RULES "The interface answers").
            <div key={stage} className="flex flex-col gap-10 animate-in fade-in slide-in-from-right-3 duration-250 ease-enter">
              {steps.map((step) => {
                const { heading, subtitle, View } = SECTION_VIEW[step.section];
                return (
                  <section key={step.section} id={`step-${step.section}`} data-cartograph-step={step.section} className="flex scroll-mt-4 flex-col gap-4" aria-labelledby={`step-${step.section}-heading`}>
                    {steps.length > 1 ? (
                      <div>
                        <h2 id={`step-${step.section}-heading`} className="text-lg font-semibold tracking-tight">
                          {heading}
                        </h2>
                        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
                      </div>
                    ) : (
                      <h2 id={`step-${step.section}-heading`} className="sr-only">
                        {heading}
                      </h2>
                    )}
                    {createElement(View)}
                    <ProjectSectionNotes section={step.section} />
                  </section>
                );
              })}
            </div>
          )}
          <InitiationBackNext id={id} stage={stage} />
        </div>
        <div className="flex flex-col gap-4">
          <CheckPanel id={id} draft scopeSections={[...steps.map((s) => s.section), ...(STAGE_ALSO_CHECKS[stage] ?? [])]} />
        </div>
      </div>
    </div>
    </FromIdeaProvider>
    </WorkTextProvider>
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

import { RequiredMarks } from "@/components/RequiredMarks";
import { createElement, useEffect } from "react";
import { FromIdeaProvider } from "@/components/FromIdea";
import { ShowInGraph } from "@/graph/ShowInGraph";
import { Link, useNavigate } from "@tanstack/react-router";
import { sectionRing } from "@/collab/SectionPeers";
import { sameView } from "@/collab/presence";
import { usePresence } from "@/collab/presenceContext";
import { Scrubber, type ScrubStage } from "@/components/Scrubber";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";


import { FlowBack, FlowNav, FlowNext } from "@/components/walker";
import { WorkTextProvider } from "@/components/relevance";
import { copy } from "@/copy";
import { useProjectChecks } from "./api";
import { CheckPanel } from "./CheckPanel";
import { ProjectSectionNotes } from "./SectionNotes";
import { ProjectHeaderBar } from "./Chrome";
import { useProjectStore } from "./store";
import { SECTION_VIEW, STAGE_ALSO_CHECKS } from "./sections/registry";
import { STAGES, stageOfSection, stepsOfStage, type InitiationSection, type Stage } from "./types";
import { STAGE_ICON } from "./steps";

const pc = copy.projects;

/**
 * The project's walk as one scrubber: every stage, every step in it
 * coloured by its worst check, the step in hand raised, and anyone else on
 * a step ringed in their colour. It is the only navigation in the flow:
 * no rail beside it, no stepper or outline under it.
 */
function ProjectScrubber({ id, section }: { id: string; section: InitiationSection }) {
  const navigate = useNavigate();
  const checksQuery = useProjectChecks(id, true);
  const { peers } = usePresence();
  const bySection = new Map<string, "ok" | "warn" | "block">();
  const rank = (s: string) => (s === "block" ? 2 : s === "warn" ? 1 : 0);
  for (const item of checksQuery.data?.items ?? []) {
    const existing = bySection.get(item.section);
    if (!existing || rank(item.state) > rank(existing)) bySection.set(item.section, item.state as "ok" | "warn" | "block");
  }
  const stages: ScrubStage[] = STAGES.map((stage) => ({
    key: stage,
    label: pc.stages[stage],
    icon: STAGE_ICON[stage],
    steps: stepsOfStage(stage).map((st) => {
      const path = `/projects/${id}${st.path}`;
      const on = peers.filter((pr) => sameView(pr.route, path));
      return { key: st.section, label: pc.sections[st.section], state: bySection.get(st.section), ring: sectionRing(on) };
    }),
  }));
  const pathOf = new Map(STAGES.flatMap((stage) => stepsOfStage(stage).map((st) => [st.section, st.path] as const)));
  return (
    <Scrubber
      stages={stages}
      stage={stageOfSection(section)}
      step={section}
      label={pc.stepper.label}
      onGo={(_, step) => void navigate({ to: `/projects/$id${pathOf.get(step as InitiationSection) ?? ""}`, params: { id } })}
    />
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
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to="/projects/$id/charter" params={{ id }} aria-label={pc.openCharter} title={pc.openCharter}>
              <FileText />
              {copy.charter.title}
            </Link>
          </Button>
          <ShowInGraph kind="Project" id={id} />
        </div>
      </div>
      <ProjectScrubber id={id} section={section} />
      <RequiredMarks kind="Project" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_18rem]">
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

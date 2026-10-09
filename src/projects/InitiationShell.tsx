import { useFlowTrace } from "@/trace/useFlowTrace";
import { RequiredMarks } from "@/components/RequiredMarks";
import { createElement, useEffect, useRef, useState } from "react";
import { FromIdeaProvider } from "@/components/FromIdea";
import { ShowInGraph } from "@/graph/ShowInGraph";
import { Link, useNavigate } from "@tanstack/react-router";
import { sectionRing } from "@/collab/SectionPeers";
import { sameView } from "@/collab/presence";
import { usePresence } from "@/collab/presenceContext";
import { Scrubber, type ScrubStage } from "@/components/Scrubber";
import { Button } from "@/components/ui/button";
import { Activity, FileText, ListChecks, PanelRightClose, PanelRightOpen, Waypoints } from "lucide-react";


import { FlowBack, FlowNav, FlowNext } from "@/components/walker";
import { WorkTextProvider } from "@/components/relevance";
import { copy } from "@/copy";
import { useProjectChecks } from "./api";
import { CheckPanel } from "./CheckPanel";
import { ProjectSectionNotes } from "./SectionNotes";
import { ProjectHeaderBar } from "./Chrome";
import { ProjectMap } from "./canvas/ProjectMap";
import { useRecordDrawer } from "@/records/RecordDrawer";
import { CharterView } from "@/charter/CharterView";
import { useProjectStore } from "./store";
import { SECTION_VIEW, STAGE_ALSO_CHECKS } from "./sections/registry";
import { STAGES, stageOfSection, stepsOfStage, type InitiationSection, type ProjectSpec, type Stage } from "./types";
import { DMAICPanel } from "@/dmaic/DMAICPanel";
import { STAGE_ICON, STEP_ICON } from "./steps";

const pc = copy.projects;

/**
 * The project's walk as one scrubber: every stage, every step in it
 * coloured by its worst check, the step in hand raised, and anyone else on
 * a step ringed in their colour. It is the only navigation in the flow:
 * no rail beside it, no stepper or outline under it.
 */
export function ProjectScrubber({ id, section }: { id: string; section?: InitiationSection | "closing" }) {
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
  // Closure follows the walk: the one page of its phase, so the last
  // segment of the same scrubber rather than a bar of its own.
  stages.push({ key: "closing", label: pc.stepper.closing, steps: [{ key: "closing", label: pc.stepper.closing, state: bySection.get("closing") }] });
  const pathOf = new Map<string, string>([...STAGES.flatMap((stage) => stepsOfStage(stage).map((st) => [st.section, st.path] as const)), ["closing", "/closing"]]);
  useFlowTrace("Project", id, section ?? "", [...pathOf.keys()].indexOf(section ?? ""));
  return (
    <Scrubber
      stages={stages}
      stage={section === "closing" ? "closing" : section ? stageOfSection(section) : ""}
      step={section ?? ""}
      label={pc.stepper.label}
      onGo={(_, step) => void navigate({ to: `/projects/$id${pathOf.get(step) ?? ""}`, params: { id } })}
    />
  );
}

/** Back and Next, as real buttons: Back a quiet outline, Next the primary
 * action naming the stage it goes to, so a stage always has one obvious
 * way forward. After the last stage, the closing page. */
export function InitiationBackNext({ id, stage, section }: { id: string; stage: Stage; section?: InitiationSection }) {
  const idx = STAGES.indexOf(stage);
  const prev = idx > 0 ? stepsOfStage(STAGES[idx - 1])[0] : undefined;
  const nextStage = idx < STAGES.length - 1 ? STAGES[idx + 1] : undefined;
  const next = nextStage ? stepsOfStage(nextStage)[0] : undefined;
  // A stage walked one step at a time moves step by step inside it first.
  const steps = stepsOfStage(stage);
  const at = section ? steps.findIndex((s) => s.section === section) : -1;
  if (STEPWISE.has(stage) && at >= 0) {
    const before = at > 0 ? steps[at - 1] : prev;
    const after = at < steps.length - 1 ? steps[at + 1] : undefined;
    return (
      <FlowNav>
        <FlowBack
          label={pc.back}
          link={(c) =>
            before ? (
              <Link to={`/projects/$id${before.path}`} params={{ id }}>
                {c}
              </Link>
            ) : (
              <Link to="/projects/$id" params={{ id }}>
                {c}
              </Link>
            )
          }
        />
        {after ? (
          <FlowNext
            label={pc.nextTo(SECTION_VIEW[after.section].heading)}
            icon={STEP_ICON[after.section]}
            link={(c) => (
              <Link to={`/projects/$id${after.path}`} params={{ id }}>
                {c}
              </Link>
            )}
          />
        ) : next && nextStage ? (
          <FlowNext
            label={pc.nextTo(pc.stages[nextStage])}
            icon={STAGE_ICON[nextStage]}
            link={(c) => (
              <Link to={`/projects/$id${next.path}`} params={{ id }}>
                {c}
              </Link>
            )}
          />
        ) : null}
      </FlowNav>
    );
  }

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

/** Stages walked one step at a time, each step its own screen: a plan's
 * milestones grow long, and data and risks must not sit below them. */
const STEPWISE = new Set<Stage>(["plan"]);

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
  const allSteps = stepsOfStage(stage);
  const stepwise = STEPWISE.has(stage);
  const steps = stepwise ? allSteps.filter((s) => s.section === section) : allSteps;
  // Every role the project names can be picked where a role is asked for
  // (who verifies, who owns a risk): a role is picked by its id, so one
  // named without an id is given one, once.
  const resources = store.spec.resources ?? [];
  const missingIds = store.loaded && resources.some((r) => !r.id);
  useEffect(() => {
    if (!missingIds) return;
    store.updateSpec((s) => {
      const taken = new Set((s.resources ?? []).map((r) => r.id).filter(Boolean) as string[]);
      const next = (s.resources ?? []).map((r) => {
        if (r.id) return r;
        const base = `role-${r.role || "member"}`;
        let roleId = base;
        for (let n = 2; taken.has(roleId); n++) roleId = `${base}-${n}`;
        taken.add(roleId);
        return { ...r, id: roleId };
      });
      return { ...s, resources: next };
    });
  }, [missingIds, store]);
  // The side pane, open or closed, as the person last left it.
  const [paneOpen, setPaneOpen] = useState(() => {
    try {
      return localStorage.getItem("cartograph.sidePaneOpen") !== "0";
    } catch {
      return true;
    }
  });
  const setPane = (open: boolean) => {
    setPaneOpen(open);
    try {
      localStorage.setItem("cartograph.sidePaneOpen", open ? "1" : "0");
    } catch {
      // Private windows refuse storage; the pane just forgets.
    }
  };
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
          {paneOpen ? null : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setPane(true)} aria-label={copy.projectMap.openPane} title={copy.projectMap.openPane} data-cartograph-region="pane-open">
              <PanelRightOpen />
              {copy.projectMap.tabs.map}
            </Button>
          )}
        </div>
      </div>
      <ProjectScrubber id={id} section={section} />
      <RequiredMarks kind="Project" />
      <div className={`grid grid-cols-1 gap-6 ${paneOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
        <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/5 sm:p-6" data-cartograph-region="section">
          {store.loadError ? (
            <p className="text-sm text-destructive">{pc.record.error}</p>
          ) : !store.loaded ? (
            <p className="text-sm text-muted-foreground">{pc.record.loading}</p>
          ) : (
            // The stage arrives from the side the walk is heading (engine
            // DESIGN_RULES "The interface answers").
            <div key={stepwise ? section : stage} className="flex flex-col gap-10 animate-in fade-in slide-in-from-right-3 duration-250 ease-enter">
              {stepwise ? <StepTabs id={id} steps={allSteps} section={section} /> : null}
              {steps.map((step) => {
                const { heading, subtitle, View } = SECTION_VIEW[step.section];
                return (
                  <section key={step.section} id={`step-${step.section}`} data-cartograph-step={step.section} className="flex scroll-mt-4 flex-col gap-4" aria-labelledby={`step-${step.section}-heading`}>
                    {steps.length > 1 || stepwise ? (
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
          <InitiationBackNext id={id} stage={stage} section={section} />
        </div>
        {paneOpen ? (
          <SidePane id={id} onClose={() => setPane(false)} checks={<CheckPanel id={id} draft scopeSections={[...steps.map((s) => s.section), ...(stepwise ? [] : (STAGE_ALSO_CHECKS[stage] ?? []))]} />} />
        ) : null}
      </div>
    </div>
    </FromIdeaProvider>
    </WorkTextProvider>
  );
}

/**
 * Beside every step, whichever the person wants: the project's map, its
 * charter as it reads now, or the checks on this stage. The map is the
 * default: what the steps define appears there as it is defined.
 */
function SidePane({ id, checks, onClose }: { id: string; checks: React.ReactNode; onClose: () => void }) {
  const store = useProjectStore();
  const navigate = useNavigate();
  const drawer = useRecordDrawer();
  const mc = copy.projectMap;
  const [tab, setTab] = useState<"map" | "charter" | "checks" | "dmaic">(() => {
    try {
      return (localStorage.getItem("cartograph.sidePane") as "map" | "charter" | "checks" | "dmaic") || "map";
    } catch {
      return "map";
    }
  });
  const pick = (t: typeof tab) => {
    setTab(t);
    try {
      localStorage.setItem("cartograph.sidePane", t);
    } catch {
      // Private windows refuse storage; the pane just forgets.
    }
  };
  // Ends at the foot of the window wherever it starts, so the map's own
  // foot is always in view: lower at the top of the page, where the
  // walker sits above it, and the full height once it sticks.
  const pane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      const el = pane.current;
      if (!el) return;
      if (!window.matchMedia("(min-width: 80rem)").matches) {
        el.style.height = "";
        return;
      }
      // The change set's bar sits at the foot of the window; the pane
      // stops above it where the two would overlap.
      const box = el.getBoundingClientRect();
      const bar = document.querySelector('[data-cartograph-region="merge-bar"]')?.getBoundingClientRect();
      const under = bar && bar.right > box.left && bar.left < box.right ? bar.height + 12 : 0;
      el.style.height = `${Math.max(448, window.innerHeight - Math.max(16, box.top) - 16 - under)}px`;
    };
    fit();
    window.addEventListener("scroll", fit, { passive: true });
    window.addEventListener("resize", fit);
    // The bar comes and goes, and grows, as the change set does; read
    // once a frame however much the page changes.
    let frame = 0;
    const watch = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    watch.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
      watch.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div ref={pane} className="relative flex flex-col gap-2 xl:sticky xl:top-4 xl:h-[calc(100svh-6rem)]" data-cartograph-region="side-pane">
      <div role="tablist" aria-label={mc.tabsLabel} className="flex items-center gap-0.5 self-start rounded-md bg-muted p-0.5">
        {(["map", "charter", "checks", "dmaic"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => pick(t)}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors duration-150 ${tab === t ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "map" ? (
              <Waypoints className="size-3.5" aria-hidden="true" />
            ) : t === "charter" ? (
              <FileText className="size-3.5" aria-hidden="true" />
            ) : t === "checks" ? (
              <ListChecks className="size-3.5" aria-hidden="true" />
            ) : (
              <Activity className="size-3.5" aria-hidden="true" />
            )}
            {mc.tabs[t]}
          </button>
        ))}
      </div>
      <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 size-8" onClick={onClose} aria-label={mc.closePane} title={mc.closePane} data-cartograph-region="pane-close">
        <PanelRightClose />
      </Button>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "map" ? (
          <ProjectMap
            id={id}
            spec={store.spec}
            updateSpec={store.updateSpec}
            onSelect={(n) => {
              if (drawer && (n.kind === "Goal" || n.kind === "Gap" || n.kind === "KPI" || n.kind === "Operation")) drawer.open(n.kind, n.id);
            }}
          />
        ) : tab === "charter" ? (
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-cartograph-region="charter-pane">
            <CharterView
              kind="Project"
              id={id}
              working
              fileName={id}
              empty={copy.charter.empty}
              editable={{
                onStep: (step) => {
                  const path = pathOfStep(step);
                  if (path) void navigate({ to: `/projects/$id${path}`, params: { id } } as never);
                },
                onField: (pointer, value) => store.updateSpec((sp) => setAt(sp, pointer, value)),
              }}
            />
          </div>
        ) : tab === "dmaic" ? (
          <DMAICPanel id={id} />
        ) : (
          checks
        )}
      </div>
    </div>
  );
}

/** The route of a step of the walk, by its section key. */
function pathOfStep(step: string): string | undefined {
  for (const stage of STAGES) for (const st of stepsOfStage(stage)) if (st.section === step) return st.path;
  return undefined;
}

/** Sets one text value in the spec by its JSON pointer, as the charter
 * names it ("/spec/summary/problems/0/problem/situation"). */
function setAt(spec: ProjectSpec, pointer: string, value: string): ProjectSpec {
  const parts = pointer.split("/").filter(Boolean).slice(1);
  const copyOf = (v: unknown): unknown => (Array.isArray(v) ? [...v] : v && typeof v === "object" ? { ...(v as object) } : {});
  const root = copyOf(spec) as Record<string, unknown>;
  let at: Record<string, unknown> | unknown[] = root;
  parts.forEach((key, i) => {
    const k = /^\d+$/.test(key) ? Number(key) : key;
    const container = at as Record<string | number, unknown>;
    if (i === parts.length - 1) {
      container[k] = value;
      return;
    }
    container[k] = copyOf(container[k]);
    at = container[k] as Record<string, unknown>;
  });
  return root as unknown as ProjectSpec;
}

/** The steps of a stage walked one at a time, as tabs with their marks:
 * each its own screen, so the last is never a long scroll away. */
function StepTabs({ id, steps, section }: { id: string; steps: ReturnType<typeof stepsOfStage>; section: InitiationSection }) {
  return (
    <nav aria-label={pc.stepsOfStage} className="flex flex-wrap gap-1.5" data-cartograph-region="step-tabs">
      {steps.map((st) => {
        const Icon = STEP_ICON[st.section];
        const on = st.section === section;
        return (
          <Link
            key={st.section}
            to={`/projects/$id${st.path}`}
            params={{ id }}
            aria-current={on ? "step" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 transition-colors ${on ? "bg-primary text-primary-foreground ring-primary" : "ring-foreground/15 hover:bg-muted"}`}
          >
            {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
            {SECTION_VIEW[st.section].heading}
          </Link>
        );
      })}
    </nav>
  );
}

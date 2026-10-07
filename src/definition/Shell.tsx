import { ProposalNotice } from "@/proposals/ProposalNotice";
import { RequiredMarks } from "@/components/RequiredMarks";
import type { ComponentType, ReactNode } from "react";
import { Link, useNavigate, type LinkProps } from "@tanstack/react-router";
import { FileText, Table2 } from "lucide-react";
import { useOperationChecks } from "@/operations/api";
import { useProgrammeChecks } from "@/programmes/api";
import { useGapChecks } from "@/gaps/api";

import { Scrubber, type ScrubStep } from "@/components/Scrubber";
import { Button } from "@/components/ui/button";
import { sameView } from "@/collab/presence";
import { usePresence } from "@/collab/presenceContext";
import { FlowBack, FlowNav, FlowNext } from "@/components/walker";
import { WorkTextProvider } from "@/components/relevance";
import { copy } from "@/copy";
import { SaveStatus } from "@/projects/Chrome";
import { ConflictNotes } from "@/collab/ConflictNotes";
import { OfflineNote } from "@/collab/OfflineNote";
import { sectionRing } from "@/collab/SectionPeers";
import { ShowInGraph } from "@/graph/ShowInGraph";
import { useDefinitionStore } from "./store";
import { RecordBlocks } from "@/changesets/RecordBlocks";

export interface DefinitionStep {
  /** The section's own id, matched against the route's `current`. */
  section: string;
  label: string;
  /** The route this step links to, as a literal the router knows: a
   * computed path is a plain string and the router's `to` is a union of
   * the routes that actually exist, which is the point of it. Every step
   * route takes one `id` param, which is what the casts below assert. */
  to: LinkProps["to"];
  icon?: ComponentType<{ className?: string }>;
}

/**
 * The walk for a kind that is one manifest: a rail of its sections, one
 * section on screen, Back and Next along the same fixed order.
 *
 * The project flow's own shell, minus what a project alone has — stages, a
 * handoff, a blocking gate. Those stay there rather than being generalised
 * into something both have to pretend to want. Advisory checks are passed
 * in through `aside`, because what they say is per-kind but where they go
 * is not.
 */
/**
 * The one param every step route takes.
 *
 * `to` is a union of every route in the app, so the router widens `params`
 * to the intersection of what those routes accept — which is nothing. The
 * route literal itself stays checked, which is the half worth having; that
 * a step route takes `id` is asserted here, once, rather than at three
 * call sites.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ID_PARAM = (id: string) => ({ id }) as any;

/** The kinds whose definition adds up to a results framework, and where
 * theirs is drawn. A kind with no entry here simply shows no link. */
const FRAMEWORK_ROUTE: Record<string, LinkProps["to"]> = {
  Programme: "/programmes/$id/framework",
};

/** The whole definition as a document, for the kinds that render one. */
const CHARTER_ROUTE: Record<string, LinkProps["to"]> = {
  Programme: "/programmes/$id/charter",
  Operation: "/operations/$id/charter",
};

export function DefinitionShell({
  home,
  steps,
  current,
  heading,
  subtitle,
  aside,
  finish,
  children,
}: {
  /** Where Back goes from the first step. */
  home: LinkProps["to"];
  steps: DefinitionStep[];
  current: string;
  heading: string;
  subtitle: string;
  aside?: ReactNode;
  /** What the walk ends on, in place of the last step's note: a question
   * that leads to the next piece of work, where the kind has one. */
  finish?: ReactNode;
  children: ReactNode;
}) {
  const store = useDefinitionStore();
  const idx = steps.findIndex((s) => s.section === current);

  // The same two things the project flow shows: each step's state on the
  // rail, and the outline of what is being built (LSS_REVIEW.md, D22).
  const isProgramme = store.kind === "Programme";
  const isOperation = store.kind === "Operation";
  const isGap = store.kind === "Gap";
  const gapChecks = useGapChecks(store.id, isGap);
  const programmeChecks = useProgrammeChecks(store.id, isProgramme);
  const operationChecks = useOperationChecks(store.id, isOperation);
  const checks =
    (isProgramme ? programmeChecks.data : isOperation ? operationChecks.data : isGap ? gapChecks.data : undefined) ?? [];
  const bySection = new Map<string, string>();
  for (const c of checks) {
    if (bySection.get(c.section) !== "warn") bySection.set(c.section, c.state);
  }
  const navigate = useNavigate();
  const { peers } = usePresence();
  const peersOn = (st: DefinitionStep) => peers.filter((p) => sameView(p.route, String(st.to).replace("$id", store.id)));
  const prev = idx > 0 ? steps[idx - 1] : undefined;
  const next = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : undefined;

  // The definition's own words so far (its name, and what it is for), for
  // every picker inside to rank the workspace against (engine
  // docs/adr/0023).
  const spec = store.spec as Record<string, unknown>;
  const workText = [store.name, ...wordsOf(spec.aim), ...wordsOf(spec.statement), ...wordsOf(spec.purpose)].filter(Boolean).join(". ");

  return (
    <WorkTextProvider text={workText}>
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-muted-foreground text-pretty">{subtitle}</p>
        </div>
        {/* Under the title on a narrow screen, so a long status wraps
            rather than running past the edge. */}
        <span className="flex min-w-0 max-w-full flex-col gap-1 sm:items-end sm:pt-2">
          <span className="flex flex-wrap items-center gap-1">
            {CHARTER_ROUTE[store.kind] ? (
              <Button asChild variant="ghost" size="sm">
                <Link to={CHARTER_ROUTE[store.kind]} params={ID_PARAM(store.id)}>
                  <FileText />
                  {copy.charter.title}
                </Link>
              </Button>
            ) : null}
            {FRAMEWORK_ROUTE[store.kind] ? (
              <Button asChild variant="ghost" size="sm">
                <Link to={FRAMEWORK_ROUTE[store.kind]} params={ID_PARAM(store.id)}>
                  <Table2 />
                  {copy.framework.title}
                </Link>
              </Button>
            ) : null}
            {store.loaded ? <ShowInGraph kind={store.kind} id={store.id} /> : null}
          </span>
          <SaveStatus state={store.saveState} />
          <OfflineNote />
        </span>
      </div>
      <ProposalNotice kind={store.kind} id={store.id} />

      {/* The one way through the walk: each step a mark coloured by its
          checks, the one in hand raised. */}
      <Scrubber
        stages={steps.map((st) => ({
          key: st.section,
          label: st.label,
          icon: st.icon,
          steps: [{ key: st.section, label: st.label, state: bySection.get(st.section) as ScrubStep["state"], ring: sectionRing(peersOn(st)) }],
        }))}
        stage={current}
        step={current}
        onGo={(_, key) => {
          const st = steps.find((x) => x.section === key);
          if (st) void navigate({ to: st.to, params: ID_PARAM(store.id) });
        }}
        label={copy.definition.stepsLabel}
      />
      <RequiredMarks kind={store.kind} />

      <div className="flex flex-col gap-6">
        <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/5 sm:p-6" data-cartograph-region="step">
          {store.loadError ? (
            <p className="text-sm text-destructive">{copy.projects.record.error}</p>
          ) : !store.loaded ? (
            <p className="text-sm text-muted-foreground">{copy.projects.record.loading}</p>
          ) : (
            <>
              {/* The step arrives from the side the walk is heading (engine
                  DESIGN_RULES "The interface answers"). */}
              <div key={current} className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-3 duration-250 ease-enter">
                {children}
              </div>
              <ConflictNotes conflicts={store.conflicts} onResolve={store.resolveConflict} />
              <RecordBlocks kind={store.kind} id={store.id} />
              {aside}
              {/* The save sits under the step, once, so every kind this
                  shell drives gets the same moment of deciding without
                  each route remembering to host it. */}
              <FlowNav>
                <FlowBack
                  label={copy.projects.back}
                  link={(c) =>
                    prev ? (
                      <Link to={prev.to} params={ID_PARAM(store.id)}>
                        {c}
                      </Link>
                    ) : (
                      <Link to={home}>{c}</Link>
                    )
                  }
                />
                {next ? (
                  <FlowNext
                    label={copy.projects.nextTo(next.label)}
                    icon={next.icon}
                    link={(c) => (
                      <Link to={next.to} params={ID_PARAM(store.id)}>
                        {c}
                      </Link>
                    )}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">{copy.definition.lastStep}</span>
                )}
              </FlowNav>
              {!next && finish ? finish : null}
            </>
          )}
        </div>
      </div>
    </div>
    </WorkTextProvider>
  );
}

/** The text held in a field, whether a sentence or the parts of one. */
function wordsOf(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v] : [];
  if (v && typeof v === "object") return Object.values(v).flatMap((x) => (typeof x === "string" && x.trim() ? [x] : []));
  return [];
}

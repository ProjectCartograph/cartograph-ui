import { ProposalNotice } from "@/proposals/ProposalNotice";
import type { ComponentType, ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileText, Table2 } from "lucide-react";
import { OutlineStrip } from "@/components/OutlineStrip";
import { useOperationChecks } from "@/operations/api";
import type { OperationSpec } from "@/operations/types";
import { useProgrammeChecks, useProgrammeMembers } from "@/programmes/api";
import type { ProgrammeSpec } from "@/programmes/types";
import { useGapChecks } from "@/gaps/api";
import type { GapSpec } from "@/gaps/types";
import { gapOutline, operationOutline, programmeOutline } from "./outline";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { copy } from "@/copy";
import { SaveStatus } from "@/projects/Chrome";
import { ConflictNotes } from "@/collab/ConflictNotes";
import { OfflineNote } from "@/collab/OfflineNote";
import { SectionPeers, sectionRing, usePeersOn } from "@/collab/SectionPeers";
import { SaveBar } from "./SaveBar";
import { useDefinitionStore } from "./store";

/** One step on the rail: its state, and who else is on it. */
function StepLink({ step, id, isCurrent, state }: { step: DefinitionStep; id: string; isCurrent: boolean; state?: string }) {
  const Icon = step.icon;
  const others = usePeersOn(String(step.to).replace("$id", id));
  const shown = isCurrent ? [] : others;
  const at = shown.length ? "" : "ml-auto ";
  return (
    <Link
      to={step.to}
      params={ID_PARAM(id)}
      style={sectionRing(shown)}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
        isCurrent ? "bg-accent font-medium text-accent-foreground" : "text-foreground hover:bg-accent/50"
      }`}
    >
      {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
      <span className="truncate">{step.label}</span>
      <SectionPeers peers={shown} />
      {state === "ok" ? (
        <CheckCircle2 className={`${at}size-3.5 shrink-0 text-muted-foreground`} aria-label={copy.projects.checks.railDone} />
      ) : state === "warn" ? (
        <AlertTriangle className={`${at}size-3.5 shrink-0 text-muted-foreground`} aria-label={copy.projects.checks.railWarn} />
      ) : null}
    </Link>
  );
}

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
  children,
}: {
  /** Where Back goes from the first step. */
  home: LinkProps["to"];
  steps: DefinitionStep[];
  current: string;
  heading: string;
  subtitle: string;
  aside?: ReactNode;
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
  const members = useProgrammeMembers(store.id, isProgramme);
  const checks =
    (isProgramme ? programmeChecks.data : isOperation ? operationChecks.data : isGap ? gapChecks.data : undefined) ?? [];
  const bySection = new Map<string, string>();
  for (const c of checks) {
    if (bySection.get(c.section) !== "warn") bySection.set(c.section, c.state);
  }
  const outline = isProgramme
    ? programmeOutline(store.spec as ProgrammeSpec, (members.data ?? []).filter((m) => m.namesThisProgramme).length)
    : isOperation
      ? operationOutline(store.spec as OperationSpec)
      : isGap
        ? gapOutline(store.spec as GapSpec, store.name)
        : null;
  const prev = idx > 0 ? steps[idx - 1] : undefined;
  const next = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1 pt-2">
          <SaveStatus state={store.saveState} />
          <OfflineNote />
        </span>
      </div>
      <ProposalNotice kind={store.kind} id={store.id} />

      {outline ? <OutlineStrip id={store.id} parts={outline} loaded={store.loaded} /> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[14rem_1fr]">
        <div className="flex w-full shrink-0 flex-col gap-1 rounded-lg border p-2 xl:w-56" data-cartograph-region="step-rail">
          {steps.map((step) => (
            <StepLink key={step.section} step={step} id={store.id} isCurrent={step.section === current} state={bySection.get(step.section)} />
          ))}

          {/* Not a step: what the steps above add up to. It sat on one
              step's aside until 2026-09-29, where nobody found it
              (Programme Lead). */}
          {FRAMEWORK_ROUTE[store.kind] || CHARTER_ROUTE[store.kind] ? (
            <>
              <Separator className="my-1" />
              {CHARTER_ROUTE[store.kind] ? (
                <Link
                  to={CHARTER_ROUTE[store.kind]}
                  params={ID_PARAM(store.id)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent/50"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{copy.charter.title}</span>
                </Link>
              ) : null}
              {FRAMEWORK_ROUTE[store.kind] ? (
                <Link
                  to={FRAMEWORK_ROUTE[store.kind]}
                  params={ID_PARAM(store.id)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent/50"
                >
                  <Table2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{copy.framework.title}</span>
                </Link>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4" data-cartograph-region="step">
          {store.loadError ? (
            <p className="text-sm text-destructive">{copy.projects.record.error}</p>
          ) : !store.loaded ? (
            <p className="text-sm text-muted-foreground">{copy.projects.record.loading}</p>
          ) : (
            <>
              {children}
              <ConflictNotes conflicts={store.conflicts} onResolve={store.resolveConflict} />
              {aside}
              {/* The save sits under the step, once, so every kind this
                  shell drives gets the same moment of deciding without
                  each route remembering to host it. */}
              <SaveBar />
              <div className="flex items-center justify-between gap-2 pt-6">
                <Button asChild variant="outline" size="lg">
                  {prev ? (
                    <Link to={prev.to} params={ID_PARAM(store.id)}>
                      <ArrowLeft />
                      {copy.projects.back}
                    </Link>
                  ) : (
                    <Link to={home}>
                      <ArrowLeft />
                      {copy.projects.back}
                    </Link>
                  )}
                </Button>
                {next ? (
                  <Button asChild size="lg">
                    <Link to={next.to} params={ID_PARAM(store.id)}>
                      {next.icon ? <next.icon /> : null}
                      {copy.projects.nextTo(next.label)}
                      <ArrowRight />
                    </Link>
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">{copy.definition.lastStep}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

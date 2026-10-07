import { Link } from "@tanstack/react-router";
import { ArrowUpRight, TriangleAlert } from "lucide-react";

import { Label } from "@/components/ui/label";
import { copy } from "@/copy";
import { roleOptions, roleRefLabel, useResourceNames } from "../RoleRefPicker";
import { CriteriaSlice } from "./SuccessSection";
import { useSectionAutosave, useProjectStore } from "../store";

const cl = copy.projects.closing;

/**
 * What must be true before the work is accepted.
 *
 * This step used to be a blank authoring form, which asked a person to
 * re-state, in a different shape and a different store, what the
 * Deliverables step had already said. Two records of one fact, no link
 * between them, and a category list that invited an outcome nobody can
 * assess on the day. The result was a screen nobody could answer.
 *
 * It shows rather than authors now. Each deliverable's own acceptance
 * criteria are the closing test, read here as Scope wrote them and edited
 * only there, so one fact has one place.
 * Only the handful of conditions no deliverable can carry are written
 * here, and only four kinds of those exist.
 */
export function ClosingSection({ id }: { id: string }) {
  useSectionAutosave();
  const store = useProjectStore();
  const deliverables = store.spec.deliverables ?? [];
  const resourceName = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], resourceName);
  const dueOnTheDay = (store.spec.successCriteria ?? []).filter((k) => k.when === "atClosing");

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-3" data-cartograph-region="closing-deliverables">
        <div className="flex items-center justify-between gap-2">
          <Label>{cl.deliverablesTitle}</Label>
          <Link
            to="/projects/$id/initiation/deliverables"
            params={{ id }}
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {copy.projects.context.edit}
            <ArrowUpRight className="size-3" />
          </Link>
        </div>

        {deliverables.length === 0 ? (
          <p className="text-sm text-muted-foreground">{cl.noDeliverables}</p>
        ) : (
          deliverables.map((d, idx) => (
            <div
              key={d.id}
              data-slot="closing-deliverable"
              data-cartograph-region={`deliverable-${idx}`}
              className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                  D{idx + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {d.name || cl.unnamedDeliverable}
                </span>
                {/* A deliverable nobody can accept is the one thing this
                    screen has to surface, and it is a mark, not a
                    sentence. */}
                {(d.acceptance ?? []).length === 0 ? (
                  <span className="shrink-0 text-muted-foreground" title={cl.noTest}>
                    <TriangleAlert className="size-4" role="img" aria-label={cl.noTest} />
                  </span>
                ) : null}
              </div>
              {/* What was agreed, as Scope wrote it: read here, edited
                  there, so one fact has one place. */}
              <ul className="flex flex-col gap-1.5 pl-8 text-sm">
                {(d.acceptance ?? []).map((a, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2" data-slot="closing-criterion">
                    <span className="text-muted-foreground">{roleRefLabel(a.by, roles)}</span>
                    <span>{a.outcome}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* The criteria themselves are written on the Success step, so
          the whole standard is one thing; this is the slice due on the
          day, read-only, with a way back to where it is owned. */}
      <section className="flex flex-col gap-3" data-cartograph-region="closing-criteria">
        <div className="flex items-center justify-between gap-2">
          <Label>{cl.criteriaTitle}</Label>
          <Link
            to="/projects/$id/initiation/success"
            params={{ id }}
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {cl.editOnSuccess}
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
        {dueOnTheDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">{cl.criteriaEmpty}</p>
        ) : (
          <CriteriaSlice id={id} whens={["atClosing"]} />
        )}
      </section>
    </div>
  );
}

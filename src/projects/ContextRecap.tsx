import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { copy } from "@/copy";
import { useGoalTree } from "@/surfaces/goals/api";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { useProjectStore } from "./store";
import { stepIcon } from "./steps";
import type { InitiationSection } from "./types";

const cc = copy.projects.context;

/** One earlier step's answer, with a way back to it. */
function Block({
  id,
  title,
  step,
  children,
}: {
  id: string;
  title: string;
  step: InitiationSection;
  children: React.ReactNode;
}) {
  const { id: projectId } = useProjectStore();
  const Icon = stepIcon(step);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
          {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
          {title}
        </h3>
        <Link
          to={`/projects/$id/initiation/${step}`}
          params={{ id: projectId }}
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
          aria-label={`${cc.backTo} ${title}`}
        >
          {cc.edit}
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <div className="flex flex-col gap-1 text-sm" data-slot={`context-${id}`}>
        {children}
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">{cc.nothingYet}</p>;
}

/**
 * What the earlier steps already said, shown on a step that cannot be
 * answered well without them. Naming who benefits, or where the project
 * stops, is a judgement about the aim, the goals and the deliverables:
 * asking for it on a page that hides all three makes a person hold the
 * whole definition in their head, or leave the step to go and look.
 *
 * Read-only on purpose. Each block links back to the step that owns it,
 * so a correction is made where it belongs rather than twice.
 */
export function ContextRecap({ omit = [] }: { omit?: string[] }) {
  const store = useProjectStore();
  const treeQuery = useGoalTree();

  const summary = store.spec.summary;
  const goalIds = store.spec.alignment?.goals ?? [];
  const objective = store.spec.objectives?.[0]?.objective ?? "";
  const deliverables = store.spec.deliverables ?? [];
  const { data: groupOptions } = useReferenceOptions("BeneficiaryGroup");
  const groupNames = (summary.beneficiaries ?? [])
    .map((b) => groupOptions?.names.get(b.group) ?? b.group)
    .filter(Boolean);

  // The goal names, out of the tree the picker itself reads.
  const names = new Map<string, string>();
  for (const pillar of treeQuery.data?.nodes ?? []) {
    for (const strategic of pillar.children ?? []) {
      for (const functional of strategic.children ?? []) names.set(functional.id, functional.name);
      names.set(strategic.id, strategic.name);
    }
    names.set(pillar.id, pillar.name);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4" data-slot="context-recap">
      <p className="text-sm font-medium">{cc.title}</p>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {omit.includes("aim") ? null : (
        <Block id="aim" title={cc.blocks.aim} step="aim">
          {/* Every problem the project answers, not only the first: the
              recap is what a later step is answered against, and a step
              answered against half the aim is answered against the wrong
              thing. */}
          {/* A reminder, not a re-read: the recap exists so somebody
              returning after a week gets their train of thought back, and
              a wall of full statements is the thing they already left
              (Programme Lead, 2026-09-27). Each line is clamped and the
              block links back to the step that owns it. */}
          {(summary.problems ?? []).some((line) => line.problem?.situation || line.change?.what) ? (
            <ul className="flex flex-col gap-2">
              {(summary.problems ?? []).slice(0, 3).map((line, i) =>
                line.problem?.situation || line.change?.what ? (
                  <li key={i} className="flex flex-col gap-0.5">
                    {line.problem?.situation ? (
                      <p className="line-clamp-2 text-pretty">{line.problem?.situation}</p>
                    ) : null}
                    {line.change?.what ? (
                      <p className="line-clamp-1 text-pretty text-muted-foreground">
                        {line.change?.what}
                      </p>
                    ) : null}
                  </li>
                ) : null,
              )}
              {(summary.problems ?? []).length > 3 ? (
                <li className="text-muted-foreground">{cc.andMore((summary.problems ?? []).length - 3)}</li>
              ) : null}
            </ul>
          ) : (
            <Empty />
          )}
        </Block>
        )}

        {/* Two blocks since the split: what this project is part of, from
            Align, and what it will move, from Measures. Each links back to
            the step that owns it. */}
        {omit.includes("goals") ? null : (
        <Block id="goals" title={cc.blocks.goals} step="goals">
          {goalIds.length === 0 ? (
            <Empty />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {goalIds.map((gid) => (
                <li key={gid} className="text-pretty">
                  {names.get(gid) ?? gid}
                </li>
              ))}
            </ul>
          )}
        </Block>
        )}

        {omit.includes("measures") ? null : (
        <Block id="measures" title={cc.blocks.measures} step="measures">
          {objective ? <p className="line-clamp-3 text-pretty">{objective}</p> : <Empty />}
        </Block>
        )}

        {omit.includes("beneficiaries") ? null : (
        <Block id="beneficiaries" title={cc.blocks.beneficiaries} step="beneficiaries">
          {groupNames.length === 0 ? (
            <Empty />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {groupNames.map((name) => (
                <li key={name} className="text-pretty">
                  {name}
                </li>
              ))}
            </ul>
          )}
        </Block>
        )}

        {omit.includes("deliverables") ? null : (
        <Block id="deliverables" title={cc.blocks.deliverables} step="deliverables">
          {deliverables.length === 0 ? (
            <Empty />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {deliverables.map((d, i) => (
                <li key={d.id || i} className="text-pretty">
                  {d.name || cc.unnamedDeliverable}
                </li>
              ))}
            </ul>
          )}
        </Block>
        )}
      </div>
    </section>
  );
}

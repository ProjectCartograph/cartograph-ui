import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Boxes, FolderKanban, Plus, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Help } from "@/components/guidance";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { useProgrammeMembers, type MemberSummary } from "../api";
import type { ProgrammeSpec } from "../types";

const pc = copy.programmes;

/** A mark, not a word. "Projects" repeated down every row is the case the
 * text-is-the-last-resort rule covers: the kind is the same four letters
 * on four rows, and an icon with the kind as its accessible name says it
 * without spending the width. */
const KIND_MARK = { Project: FolderKanban, Operation: Settings2 } as const;

/**
 * What is inside the programme, read back rather than stored.
 *
 * A project names its programmes and an operation names its programmes, so
 * membership is declared by the work and derived here (TAXONOMY.md D1).
 * There is deliberately no picker that adds a project to a programme: that
 * would be a second place to change one fact, and the two would disagree.
 *
 * What this screen does do is the thing that was asked for — show the work
 * that shares a goal without naming this programme, and let a programme
 * adopt the goals of a member it shares nothing with.
 */
export function ComponentsSection() {
  useSectionAutosave();
  const store = useDefinitionStore<ProgrammeSpec>();
  const membersQuery = useProgrammeMembers(store.id);
  const goalSet = new Set(store.spec.goals ?? []);

  const members = membersQuery.data ?? [];
  const inside = members.filter((m) => m.namesThisProgramme);
  // A project's components sit under it: they belong to its programmes
  // through it, and name none themselves (TAXONOMY.md D15).
  const partsOf = (id: string) => members.filter((m) => m.parent === id);
  const candidates = members.filter(
    (m) => !m.namesThisProgramme && !m.parent && m.goals.some((g) => goalSet.has(g)),
  );
  // Inside the programme but sharing none of its goals. Advisory since
  // 2026-09-28: an enabling component can legitimately serve no goal the
  // programme lists, so this offers the adoption rather than refusing the
  // membership. Marked on the member's own row, not listed again below it.
  const unserved = new Set(
    inside.filter((m) => !m.goals.some((g) => goalSet.has(g))).map((m) => m.id),
  );

  function adoptFrom(member: MemberSummary) {
    store.updateSpec((s) => {
      const have = new Set(s.goals ?? []);
      for (const g of member.goals) have.add(g);
      return { ...s, goals: [...have] };
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-2" data-slot="programme-inside">
        {inside.length === 0 ? (
          <p className="text-sm text-muted-foreground">{pc.insideEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {inside.map((m) => (
              <li key={`${m.kind}-${m.id}`} className="flex flex-wrap items-center gap-2 text-sm">
                {(() => {
                  const Mark = KIND_MARK[m.kind];
                  const label = m.kind === "Project" ? pc.insideProjects : pc.insideOperations;
                  return (
                    <Mark
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-label={label}
                      role="img"
                    />
                  );
                })()}
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                {unserved.has(m.id) && m.goals.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => adoptFrom(m)}
                    title={pc.unservedHint}
                  >
                    <Plus />
                    {pc.adoptGoalsFrom(m.name)}
                  </Button>
                ) : null}
                {m.kind === "Project" ? (
                  <Button asChild variant="ghost" size="icon-sm" aria-label={m.name}>
                    <Link to="/projects/$id" params={{ id: m.id }}>
                      <ArrowUpRight />
                    </Link>
                  </Button>
                ) : null}
                {partsOf(m.id).length > 0 ? (
                  <ul className="flex w-full basis-full flex-col gap-1 pl-6" data-slot="project-components">
                    {partsOf(m.id).map((part) => (
                      <li key={part.id} className="flex items-center gap-2 text-sm">
                        <Boxes className="size-4 shrink-0 text-muted-foreground" aria-label={pc.componentMark} role="img" />
                        <span className="min-w-0 flex-1 truncate">{part.name}</span>
                        <Button asChild variant="ghost" size="icon-sm" aria-label={part.name}>
                          <Link to="/projects/$id" params={{ id: part.id }}>
                            <ArrowUpRight />
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>


      <section className="flex flex-col gap-2" data-slot="programme-candidates">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-medium">{pc.adoptTitle}</h3>
          <Help label={pc.adoptTitle} hint={pc.adoptHint} />
        </div>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{pc.adoptNone}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {candidates.map((m) => (
              <li key={`${m.kind}-${m.id}`} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{m.name}</span>
                {m.kind === "Project" ? (
                  <Button asChild variant="ghost" size="icon-sm" aria-label={m.name}>
                    <Link to="/projects/$id/initiation/goals" params={{ id: m.id }}>
                      <ArrowUpRight />
                    </Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

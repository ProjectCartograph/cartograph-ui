import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, ListChecks } from "lucide-react";
import { useState } from "react";

import { useClient } from "@/client/context";
import type { RoundTask } from "@/client/port";
import { copy } from "@/copy";
import { useProjectStore } from "./store";
import { STEPS } from "./types";

const nd = copy.projects.nextToDecide;

/** Focuses a field once its step is on screen. */
function focusField(field: string) {
  let tries = 0;
  const find = () => {
    const el = document.querySelector<HTMLElement>(`[data-cartograph-field="${CSS.escape(field)}"]`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      (el.matches("input, textarea, [role=combobox], button") ? el : el.querySelector<HTMLElement>("input, textarea, [role=combobox], button"))?.focus();
    } else if (tries++ < 20) setTimeout(find, 100);
  };
  find();
}

/**
 * What the walk can decide now (#60): the project's round, the same tree
 * the MCP server hands an agent (engine docs/adr/0032). Each item answers
 * a question nothing still open hangs on, and goes to the step and field
 * that answer it; what waits on these comes after. A person and an agent
 * walk a definition in the same order, and nobody is sent back to a step
 * to answer what a later one needed.
 */
export function NextToDecide({ id, section }: { id: string; section: string }) {
  const client = useClient();
  const store = useProjectStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const key = JSON.stringify(store.spec).length;
  const round = useQuery({ queryKey: ["round", id, key], queryFn: () => client.round(id), enabled: store.loaded, placeholderData: (p) => p });
  const items: RoundTask[] = [...(round.data?.settle ?? []), ...(round.data?.ask ?? [])].filter((t) => t.kind === "Project" && t.id === id);
  if (items.length === 0) return null;
  const go = (t: RoundTask) => {
    const step = STEPS.find((st) => st.section === t.step);
    if (step && step.section !== section) void navigate({ to: `/projects/$id${step.path}`, params: { id } } as never);
    if (t.field) focusField(t.field);
  };
  return (
    <section className="rounded-lg ring-1 ring-foreground/10" data-cartograph-region="next-to-decide" aria-label={nd.label}>
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ChevronRight className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
        <ListChecks className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">{nd.title(items.length)}</span>
        {round.data?.waiting ? <span className="text-xs text-muted-foreground">{nd.waiting(round.data.waiting)}</span> : null}
      </button>
      {open ? (
        <ol className="flex flex-col gap-0.5 px-3 pb-3">
          {items.map((t) => (
            <li key={`${t.check}-${t.question ?? ""}`}>
              <button type="button" onClick={() => go(t)} className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                <span className="min-w-0 flex-1 text-pretty">{t.do || t.message}</span>
                {t.step ? <span className="shrink-0 text-xs text-muted-foreground">{copy.projects.sections[t.step] ?? t.step}</span> : null}
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

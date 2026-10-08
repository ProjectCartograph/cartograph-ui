import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Blocks,
  FolderKanban,
  Layers,
  Mountain,
  Package,
  Settings2,
  SquareArrowOutUpRight,
  type LucideIcon,
} from "lucide-react";

import { useClient } from "@/client/context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copy } from "@/copy";

const c = copy.whichKind;

/** What each answer is, and where it starts: the engine's questions in
 * its order (GET /structure), each a tile with its kind's icon. */
const TILE: Record<
  string,
  {
    icon: LucideIcon;
    to?: string;
    search?: Record<string, string>;
    kind?: string;
  }
> = {
  outOfScope: { icon: SquareArrowOutUpRight },
  policy: {
    icon: Mountain,
    to: "/goals",
    search: { add: "goal" },
    kind: "Goal",
  },
  ongoing: { icon: Settings2, to: "/operations/new", kind: "Operation" },
  groupsForFunding: {
    icon: BriefcaseBusiness,
    to: "/portfolios/prepare",
    kind: "Portfolio",
  },
  coordinatesProjects: {
    icon: Layers,
    to: "/programmes/prepare",
    kind: "Programme",
  },
  outputOf: { icon: Package, to: "/projects" },
  changeOfItsOwn: { icon: Blocks, to: "/projects/start", kind: "Project" },
  "": { icon: FolderKanban, to: "/projects/start", kind: "Project" },
};

/**
 * Which kind a piece of work is, decided by the engine's questions rather
 * than by what the person's documents call it (engine TAXONOMY.md D56):
 * one ordered choice, read from the top, the first that fits. Picking one
 * says what follows and starts it, or says where it goes when it is not
 * a record of its own.
 */
export function WhichKind({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        data-cartograph-region="which-kind"
      >
        <DialogHeader>
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>{c.hint}</DialogDescription>
        </DialogHeader>
        {open ? <WhichKindChoice onStart={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** The choice itself, in a dialog or on a page. */
export function WhichKindChoice({ onStart }: { onStart?: () => void }) {
  const client = useClient();
  const navigate = useNavigate();
  const questions = useQuery({
    queryKey: ["structure-questions"],
    queryFn: () => client.structureQuestions(),
    staleTime: Infinity,
  });
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const picked = questions.data?.find((q) => q.field === chosen);
  const tile = chosen !== undefined ? TILE[chosen] : undefined;
  return (
    <>
      {questions.isLoading ? (
        <p className="text-sm text-muted-foreground">{c.loading}</p>
      ) : null}
      {picked && tile ? (
        <div
          className="flex flex-col gap-4"
          data-cartograph-region="which-kind-answer"
        >
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <tile.icon
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                {c.pick[picked.field] ?? picked.field}
              </p>
              <p className="text-sm text-muted-foreground">{picked.then}</p>
            </div>
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setChosen(undefined)}>
              <ArrowLeft />
              {c.back}
            </Button>
            {tile.to ? (
              <Button
                onClick={() => {
                  onStart?.();
                  void navigate({
                    to: tile.to,
                    search: (tile.search ?? {}) as never,
                  } as never);
                }}
                data-which-start={tile.kind ?? "deliverable"}
              >
                <tile.icon />
                {tile.kind
                  ? c.start(copy.createMenu.kinds[tile.kind] ?? tile.kind)
                  : c.openProjects}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {(questions.data ?? []).map((q) => {
            const t = TILE[q.field] ?? TILE[""];
            return (
              <li key={q.field || "none"}>
                <button
                  type="button"
                  onClick={() => setChosen(q.field)}
                  data-which={q.field || "project"}
                  className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-2"
                >
                  <t.icon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {c.pick[q.field] ?? q.field}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {q.question}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

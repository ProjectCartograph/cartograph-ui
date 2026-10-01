import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Boxes, Flag, FolderKanban, Layers, Repeat, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { kindOf, type Ends, type NewKind as Kind, type Size } from "@/definition/kindOf";

export const Route = createFileRoute("/new")({ component: NewPage });

const nc = copy.newWork;


/**
 * What are you describing? Two questions, answered by picking.
 *
 * Every standard separates work that finishes from work that keeps running
 * (PMI, GovS 002, PRINCE2, ITIL), and then asks whether one project can
 * deliver the change (MSP) under one sponsor and one budget (PMI's
 * subproject, the World Bank's component). Cartograph used to ask neither: a
 * person opened "New project" or "New programme" and the choice that
 * decides everything else was made with no help at all, which is how a
 * yearly assessment came to be defined as one project (TAXONOMY.md D14,
 * LSS_REVIEW.md).
 */
function NewPage() {
  const navigate = useNavigate();
  const [ends, setEnds] = useState<Ends | null>(null);
  const [size, setSize] = useState<Size | null>(null);

  const kind = kindOf(ends, size);

  function go() {
    if (kind === "operation") void navigate({ to: "/operations/new" });
    else if (kind === "programme") void navigate({ to: "/programmes/new" });
    else if (kind === "component") void navigate({ to: "/projects/new", search: { partOf: true } });
    else if (kind === "project") void navigate({ to: "/projects/new", search: {} });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{nc.title}</h1>
        <p className="text-muted-foreground">{nc.subtitle}</p>
      </div>

      <Question label={nc.endsQuestion} region="new-ends">
        <Choice icon={Flag} title={nc.finishes} detail={nc.finishesDetail} picked={ends === "finishes"} onPick={() => setEnds("finishes")} />
        <Choice
          icon={Repeat}
          title={nc.runs}
          detail={nc.runsDetail}
          picked={ends === "runs"}
          onPick={() => {
            setEnds("runs");
            setSize(null);
          }}
        />
      </Question>

      {ends === "finishes" ? (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none">
          <Question label={nc.sizeQuestion} region="new-size">
            <Choice icon={FolderKanban} title={nc.one} detail={nc.oneDetail} picked={size === "one"} onPick={() => setSize("one")} />
            <Choice icon={Boxes} title={nc.part} detail={nc.partDetail} picked={size === "part"} onPick={() => setSize("part")} />
            <Choice icon={Layers} title={nc.many} detail={nc.manyDetail} picked={size === "many"} onPick={() => setSize("many")} />
          </Question>
        </div>
      ) : null}

      {kind ? (
        <div
          className="flex flex-col gap-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/20 animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none"
          data-slot="new-verdict"
          data-cartograph-region="new-verdict"
          role="status"
        >
          <p className="flex items-center gap-2 font-medium">
            <KindMark kind={kind} />
            {nc.verdict[kind]}
          </p>
          <p className="text-sm text-muted-foreground">{nc.because[kind]}</p>
          <div>
            <Button type="button" onClick={go}>
              {nc.start[kind]}
              <ArrowRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KindMark({ kind }: { kind: Kind }) {
  const Icon = { project: FolderKanban, component: Boxes, programme: Layers, operation: Settings2 }[kind];
  return <Icon className="size-5 text-primary" aria-hidden="true" />;
}

function Question({ label, region, children }: { label: string; region: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3" data-cartograph-region={region}>
      <legend className="mb-3 text-base font-medium">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Choice({
  icon: Icon,
  title,
  detail,
  picked,
  onPick,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  picked: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={picked}
      onClick={onPick}
      className={`flex items-start gap-3 rounded-xl p-4 text-left ring-1 transition-all duration-200 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none motion-reduce:transition-none ${
        picked ? "bg-primary/5 ring-2 ring-primary" : "ring-foreground/10"
      }`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${picked ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
      <span className="flex flex-col gap-1">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

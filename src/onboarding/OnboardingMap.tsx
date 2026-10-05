import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { levelName } from "@/surfaces/goals/levels";
import type { Made } from "./Onboarding";

const oc = copy.onboarding;

/** Each thing unfolds a beat after the one above it. */
const BEAT = 220;

/**
 * The end of opening a workspace: a map of what was defined, from the
 * organisation and why it exists down to what will be true, unfolding in
 * the order it was defined, with the way in at its centre once it has
 * all arrived, as a game shows the player they made before play starts.
 */
export function OnboardingMap({
  org,
  vision,
  mission,
  goals,
  chosen,
  objectives,
  forObjective,
  outcomes,
  levels,
  onBegin,
}: {
  org: string;
  vision: string;
  mission: string;
  goals: Made[];
  chosen: string;
  objectives: Made[];
  forObjective: string;
  outcomes: Made[];
  levels?: string[];
  onBegin: () => void;
}) {
  let beat = 0;
  const next = () => ({ "--delay": `${beat++ * BEAT}ms` }) as CSSProperties;
  const rows: { level: "goal" | "objective" | "outcome"; items: Made[]; lit: string }[] = [
    { level: "goal" as const, items: goals, lit: chosen },
    { level: "objective" as const, items: objectives, lit: forObjective },
    { level: "outcome" as const, items: outcomes, lit: "" },
  ].filter((r) => r.items.length > 0);

  return (
    <div className="cartograph-map-ground -m-6 flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-12" data-cartograph-region="onboarding-map">
      <div className="cartograph-unfold flex flex-col items-center gap-1 text-center" style={next()}>
        <Compass className="size-6 text-primary" aria-hidden="true" />
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{oc.mapTitle(org)}</h1>
        <p className="max-w-md text-muted-foreground text-pretty">{oc.mapHint}</p>
      </div>

      <ol className="flex w-full max-w-3xl flex-col items-center" aria-label={oc.mapTitle(org)}>
        <li className="cartograph-unfold flex w-full flex-col items-center gap-3" style={next()}>
          <div className="flex items-center gap-3 rounded-2xl bg-card px-5 py-3 shadow-sm ring-1 ring-foreground/10">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">{org.slice(0, 1).toUpperCase()}</span>
            <span className="text-lg font-semibold">{org}</span>
          </div>
          {vision || mission ? (
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <Card term={oc.terms.vision} style={next()}>
                {vision || oc.notYet}
              </Card>
              <Card term={oc.terms.mission} style={next()}>
                {mission || oc.notYet}
              </Card>
            </div>
          ) : null}
        </li>
        {rows.map((row) => (
          <li key={row.level} className="flex w-full flex-col items-center">
            <span className="cartograph-grow block h-8 w-px bg-primary/40" style={next()} aria-hidden="true" />
            <div className="flex flex-col items-center gap-2">
              <span className="cartograph-unfold text-xs font-medium uppercase tracking-wide text-muted-foreground" style={next()}>
                {levelName(row.level, levels)}
              </span>
              <ul className="flex flex-wrap justify-center gap-2">
                {row.items.map((m) => (
                  <li
                    key={m.id}
                    className={`cartograph-unfold rounded-full px-3 py-1.5 text-sm ring-1 ${m.id === row.lit ? "bg-primary/10 font-medium text-primary ring-primary/40" : "bg-card ring-foreground/15"}`}
                    style={next()}
                  >
                    {m.name}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <Button type="button" size="lg" className="cartograph-beckon h-12 rounded-full px-8 text-base" style={next()} onClick={onBegin} autoFocus>
        {oc.begin}
        <ArrowRight />
      </Button>
    </div>
  );
}

function Card({ term, style, children }: { term: string; style: CSSProperties; children: ReactNode }) {
  return (
    <div className="cartograph-unfold flex flex-col gap-1 rounded-xl bg-card p-4 text-sm shadow-sm ring-1 ring-foreground/10" style={style}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{term}</span>
      <p className="text-pretty">{children}</p>
    </div>
  );
}

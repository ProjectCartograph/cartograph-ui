import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, Plus } from "lucide-react";

import { useClient } from "@/client/context";
import type { Client } from "@/client/port";
import { fieldGuide, useGuide } from "@/components/guide";
import { DidYouMean } from "@/components/DidYouMean";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FlowBack, FlowNav, FlowNext, WalkerProgress, WalkerQuestion, WalkerStep } from "@/components/walker";
import { copy } from "@/copy";
import { useSettings } from "@/surfaces/goals/api";
import { levelName } from "@/surfaces/goals/levels";
import { createGoal, saveGoalFields } from "@/surfaces/goals/mutations";
import type { GoalLevel } from "@/surfaces/goals/types";
import { slugify } from "@/surfaces/sheet/schema";
import { OnboardingMap } from "./OnboardingMap";
import { markOnboarded } from "./firstRun";

const oc = copy.onboarding;

const WHO = ["name", "vision", "mission", "review"] as const;
const HOW = ["goals", "pick", "aim", "objectives", "outcomes"] as const;
type Step = (typeof WHO)[number] | (typeof HOW)[number] | "map";

/** A record made here, by id and the name it was given. */
export type Made = { id: string; name: string };

/** A goal at any level, created under a free id: the name's own, or the
 * name's with a number when that is taken. */
async function createFree(client: Client, name: string, level: GoalLevel, parent?: string): Promise<Made | null> {
  const base = slugify(name) || level;
  for (let n = 1; n <= 9; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    const result = await createGoal(client, id, name, level, parent);
    if (result.ok) return { id, name };
    if (!result.conflict) return null;
  }
  return null;
}

/**
 * Opening a new workspace, walked like starting a project: one question
 * to a screen. First who the workspace is for and why it exists (the
 * organisation's name, its vision, its mission, read back to change or
 * keep), then how it gets there: a few goals, and one of them refined
 * into objectives and outcomes, to learn the way. Every screen says what
 * the thing asked for is, in the engine's words, so by the end the
 * person knows the taxonomy (engine TAXONOMY.md D24, D28, D37). Anything
 * may be skipped; what is left waits inside. It ends on a map of what was
 * defined, and a way in.
 */
export function Onboarding() {
  const client = useClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const levels = useSettings().data?.goalLevels;
  const word = (l: GoalLevel) => levelName(l, levels);
  const purposeGuide = useGuide("Purpose");
  const goalGuide = useGuide("Goal", "goal");
  const objectiveGuide = useGuide("Goal", "objective");
  const outcomeGuide = useGuide("Goal", "outcome");
  // The words for a person, where the guide's are for writing (the
  // glossary's summary and example).
  const glossary = useQuery({ queryKey: ["glossary"], queryFn: () => client.glossary(), retry: false, staleTime: Infinity });
  const purposeEntry = glossary.data?.find((e) => e.key === "purpose");
  // What is there already, when the walk is opened again.
  const stated = useQuery({
    queryKey: ["purpose"],
    queryFn: async () => (await client.get("Purpose", "default")).manifest.spec as { organisation?: string; vision?: string; mission?: string },
    retry: false,
  });

  const [step, setStep] = useState<Step>("name");
  const [forward, setForward] = useState(true);
  const [org, setOrg] = useState("");
  const [vision, setVision] = useState("");
  const [mission, setMission] = useState("");
  const [goalNames, setGoalNames] = useState<string[]>([""]);
  const [goals, setGoals] = useState<Made[]>([]);
  const [chosen, setChosen] = useState("");
  const [aim, setAim] = useState("");
  const [objectiveNames, setObjectiveNames] = useState<string[]>([""]);
  const [objectives, setObjectives] = useState<Made[]>([]);
  const [forObjective, setForObjective] = useState("");
  const [outcomeNames, setOutcomeNames] = useState<string[]>([""]);
  const [outcomes, setOutcomes] = useState<Made[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // What is there already fills the boxes once, when it arrives.
  const [seeded, setSeeded] = useState(false);
  if (!seeded && stated.data) {
    const s = stated.data;
    setSeeded(true);
    setOrg((v) => v || s.organisation || "");
    setVision((v) => v || s.vision || "");
    setMission((v) => v || s.mission || "");
  }

  const orgName = org.trim();
  const goal = goals.find((g) => g.id === chosen);
  const objective = objectives.find((o) => o.id === forObjective) ?? objectives[0];
  const part = (WHO as readonly string[]).includes(step) ? WHO : (HOW as readonly string[]).includes(step) ? HOW : null;

  function go(next: Step) {
    const order: Step[] = [...WHO, ...HOW, "map"];
    setForward(order.indexOf(next) >= order.indexOf(step));
    setFailed(false);
    setStep(next);
  }

  // Each screen saves what it asked for before moving on, so leaving at
  // any point keeps what was given.
  async function run(save: () => Promise<boolean>, next: Step) {
    setBusy(true);
    setFailed(false);
    try {
      if (await save()) go(next);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function savePurpose(): Promise<boolean> {
    const spec: Record<string, string> = { organisation: orgName };
    if (vision.trim()) spec.vision = vision.trim();
    if (mission.trim()) spec.mission = mission.trim();
    const kept = stated.data as Record<string, string> | undefined;
    if (kept?.source) spec.source = kept.source;
    await client.saveVersion("Purpose", "default", { apiVersion: "cartograph/v1", kind: "Purpose", metadata: { id: "default", name: "Purpose" }, spec }, oc.reason);
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["purpose"] }), queryClient.invalidateQueries({ queryKey: ["settings"] })]);
    return true;
  }

  // Only the names not yet made are made: going back and on again adds,
  // never duplicates.
  async function makeAll(names: string[], made: Made[], level: GoalLevel, parent?: string): Promise<Made[] | null> {
    const out = [...made];
    for (const name of names.map((n) => n.trim()).filter(Boolean)) {
      if (out.some((m) => m.name === name)) continue;
      const m = await createFree(client, name, level, parent);
      if (!m) return null;
      out.push(m);
    }
    void queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
    return out;
  }

  async function saveGoals() {
    const made = await makeAll(goalNames, goals, "goal");
    if (!made) return false;
    setGoals(made);
    setChosen((c) => c || made[0]?.id || "");
    return made.length > 0;
  }

  async function saveAim() {
    if (!goal || !aim.trim()) return true;
    const result = await saveGoalFields(client, goal.id, goal.name, { level: "goal", objective: aim.trim() }, oc.reason);
    return result.ok;
  }

  async function saveObjectives() {
    if (!goal) return true;
    const made = await makeAll(objectiveNames, objectives, "objective", goal.id);
    if (!made) return false;
    setObjectives(made);
    setForObjective((o) => o || made[0]?.id || "");
    return true;
  }

  async function saveOutcomes() {
    if (!objective) return true;
    const made = await makeAll(outcomeNames, outcomes, "outcome", objective.id);
    if (!made) return false;
    setOutcomes(made);
    return true;
  }

  function finish() {
    markOnboarded();
    void navigate({ to: "/" });
  }

  if (step === "map") {
    return (
      <OnboardingMap
        org={orgName}
        vision={vision.trim()}
        mission={mission.trim()}
        goals={goals}
        chosen={chosen}
        objectives={objectives}
        forObjective={objective?.id ?? ""}
        outcomes={outcomes}
        levels={levels}
        onBegin={finish}
      />
    );
  }

  const filled = (names: string[]) => names.some((n) => n.trim());
  const at = part ? part.indexOf(step as never) : 0;

  return (
    <div className="mx-auto flex min-h-[85vh] w-full max-w-2xl flex-col gap-8 pt-[6vh] pb-12" data-cartograph-region="onboarding">
      {part ? <WalkerProgress labels={part.map((s) => oc.steps[s])} at={at} label={oc.progress} onGo={(i) => (i <= at ? go(part[i]) : undefined)} /> : null}

      <WalkerStep key={step} step={step} forward={forward}>
        {step === "name" ? (
          <WalkerQuestion title={oc.nameQuestion} lead={oc.lead}>
            <Input
              value={org}
              onChange={(e) => setOrg(e.target.value.slice(0, 160))}
              aria-label={oc.nameLabel}
              data-cartograph-field="/spec/organisation"
              className="h-12 text-lg"
              autoFocus
            />
            <Definition term={oc.terms.organisation} text={fieldGuide(purposeGuide.data, "/spec/organisation")?.guide} example={fieldGuide(purposeGuide.data, "/spec/organisation")?.good?.[0]} />
          </WalkerQuestion>
        ) : step === "vision" ? (
          <WalkerQuestion title={oc.visionQuestion(orgName)}>
            <Textarea value={vision} onChange={(e) => setVision(e.target.value.slice(0, 600))} rows={3} aria-label={oc.terms.vision} data-cartograph-field="/spec/vision" className="text-base" autoFocus />
            <Definition term={oc.terms.vision} text={fieldGuide(purposeGuide.data, "/spec/vision")?.guide} example={fieldGuide(purposeGuide.data, "/spec/vision")?.good?.[0]} />
          </WalkerQuestion>
        ) : step === "mission" ? (
          <WalkerQuestion title={oc.missionQuestion(orgName)}>
            <Textarea value={mission} onChange={(e) => setMission(e.target.value.slice(0, 600))} rows={3} aria-label={oc.terms.mission} data-cartograph-field="/spec/mission" className="text-base" autoFocus />
            <Definition term={oc.terms.mission} text={fieldGuide(purposeGuide.data, "/spec/mission")?.guide} example={fieldGuide(purposeGuide.data, "/spec/mission")?.good?.[0]} />
          </WalkerQuestion>
        ) : step === "review" ? (
          <WalkerQuestion title={oc.reviewQuestion(orgName)} hint={oc.reviewHint}>
            <dl className="flex flex-col divide-y rounded-xl bg-card ring-1 ring-foreground/10" data-slot="review">
              {(
                [
                  ["name", oc.terms.organisation, orgName],
                  ["vision", oc.terms.vision, vision.trim()],
                  ["mission", oc.terms.mission, mission.trim()],
                ] as const
              ).map(([key, term, value], i) => (
                <div key={key} className="cartograph-unfold flex items-start gap-4 p-4" style={{ "--delay": `${i * 90}ms` } as React.CSSProperties}>
                  <dt className="w-24 shrink-0 text-sm text-muted-foreground">{term}</dt>
                  <dd className={`min-w-0 flex-1 text-pretty ${value ? "" : "italic text-muted-foreground"}`}>{value || oc.notYet}</dd>
                  <Button type="button" variant="ghost" size="sm" onClick={() => go(key)}>
                    {oc.change}
                  </Button>
                </div>
              ))}
            </dl>
            <Definition term={oc.terms.purpose} text={purposeEntry?.summary} example={purposeEntry?.example} />
          </WalkerQuestion>
        ) : step === "goals" ? (
          <WalkerQuestion
            title={oc.goalsQuestion}
            hint={oc.goalsHint}
            lead={
              <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-4 text-base font-normal text-foreground" data-slot="purpose-read-back">
                <p>
                  <span className="text-muted-foreground">{oc.visionIs(orgName)}: </span>
                  {vision.trim() || oc.notYet}
                </p>
                <p>
                  <span className="text-muted-foreground">{oc.missionIs}: </span>
                  {mission.trim() || oc.notYet}
                </p>
              </div>
            }
          >
            <Names names={goalNames} made={goals} onChange={setGoalNames} level="goal" onUse={(m) => (setGoals((p) => [...p, m]), setChosen((c) => c || m.id))} label={oc.goalLabel} add={oc.addGoal} field="/metadata/name" />
            <Definition term={word("goal")} text={goalGuide.data?.levelIs} example={fieldGuide(goalGuide.data, "/spec/objective")?.good?.[0]} />
          </WalkerQuestion>
        ) : step === "pick" ? (
          <WalkerQuestion title={oc.pickQuestion(goals.length)} hint={oc.pickHint}>
            <div role="radiogroup" aria-label={oc.pickQuestion(goals.length)} className="flex flex-col gap-2">
              {goals.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen === g.id}
                  onClick={() => setChosen(g.id)}
                  className={`cartograph-unfold cartograph-pick flex items-center gap-3 rounded-xl p-4 text-left ring-1 transition-colors duration-150 ease-standard ${chosen === g.id ? "bg-primary/10 font-medium ring-primary/40" : "bg-card ring-foreground/10 hover:bg-muted"}`}
                  style={{ "--delay": `${i * 80}ms` } as React.CSSProperties}
                >
                  <span className={`size-3 shrink-0 rounded-full ring-2 ${chosen === g.id ? "bg-primary ring-primary" : "ring-foreground/30"}`} aria-hidden="true" />
                  {g.name}
                </button>
              ))}
            </div>
          </WalkerQuestion>
        ) : step === "aim" ? (
          <WalkerQuestion title={oc.aimQuestion(goal?.name ?? "")} hint={fieldGuide(goalGuide.data, "/spec/objective")?.guide}>
            <Textarea value={aim} onChange={(e) => setAim(e.target.value.slice(0, 240))} rows={2} aria-label={oc.aimLabel} data-cartograph-field="/spec/objective" className="text-base" autoFocus />
            <Definition term={word("goal")} text={goalGuide.data?.levelIs} example={fieldGuide(goalGuide.data, "/spec/objective")?.good?.[0]} />
          </WalkerQuestion>
        ) : step === "objectives" ? (
          <WalkerQuestion title={oc.objectivesQuestion(goal?.name ?? "")} hint={oc.objectivesHint}>
            <Names names={objectiveNames} made={objectives} onChange={setObjectiveNames} level="objective" onUse={(m) => (setObjectives((p) => [...p, m]), setForObjective((o) => o || m.id))} label={oc.objectiveLabel} add={oc.addObjective} field="/metadata/name" />
            <Definition term={word("objective")} text={objectiveGuide.data?.levelIs} example={fieldGuide(objectiveGuide.data, "/spec/objective")?.good?.[0]} />
          </WalkerQuestion>
        ) : (
          <WalkerQuestion title={oc.outcomesQuestion(objective?.name ?? "")} hint={oc.outcomesHint}>
            {objectives.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">{oc.forObjective}</span>
                <ToggleGroup type="single" variant="outline" size="sm" value={objective?.id ?? ""} onValueChange={(v) => v && setForObjective(v)} aria-label={oc.forObjective} className="flex-wrap justify-start">
                  {objectives.map((o) => (
                    <ToggleGroupItem key={o.id} value={o.id}>
                      {o.name}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ) : null}
            <Names names={outcomeNames} made={outcomes} onChange={setOutcomeNames} level="outcome" onUse={(m) => setOutcomes((p) => [...p, m])} label={oc.outcomeLabel} add={oc.addOutcome} field="/metadata/name" />
            <Definition term={word("outcome")} text={outcomeGuide.data?.levelIs} example={fieldGuide(outcomeGuide.data, "/spec/objective")?.good?.[0]} />
          </WalkerQuestion>
        )}
        {failed ? (
          <p className="text-sm text-destructive" role="alert">
            {oc.failed}
          </p>
        ) : null}
      </WalkerStep>

      <FlowNav>
        {step === "name" ? (
          <Button type="button" variant="ghost" size="lg" onClick={finish}>
            {oc.notNow}
          </Button>
        ) : (
          <FlowBack label={oc.back} onClick={() => go(back(step, goals.length))} />
        )}
        <div className="flex items-center gap-2">
          {part === HOW ? (
            <Button type="button" variant="ghost" size="lg" onClick={() => go("map")} disabled={busy}>
              {oc.skip}
            </Button>
          ) : null}
          {step === "name" ? (
            <Forward onClick={() => go("vision")} disabled={!orgName} />
          ) : step === "vision" ? (
            <Forward onClick={() => go("mission")} />
          ) : step === "mission" ? (
            <Forward onClick={() => go("review")} />
          ) : step === "review" ? (
            <Forward onClick={() => void run(savePurpose, "goals")} disabled={busy || !orgName} />
          ) : step === "goals" ? (
            <Forward onClick={() => void run(saveGoals, goalNames.filter((n) => n.trim()).length > 1 || goals.length > 1 ? "pick" : "aim")} disabled={busy || (!filled(goalNames) && goals.length === 0)} />
          ) : step === "pick" ? (
            <Forward onClick={() => go("aim")} disabled={!chosen} />
          ) : step === "aim" ? (
            <Forward onClick={() => void run(saveAim, "objectives")} disabled={busy} />
          ) : step === "objectives" ? (
            <Forward onClick={() => void run(saveObjectives, objectives.length || filled(objectiveNames) ? "outcomes" : "map")} disabled={busy} />
          ) : (
            <Forward onClick={() => void run(saveOutcomes, "map")} disabled={busy} />
          )}
        </div>
      </FlowNav>
    </div>
  );
}

/** The screen before this one: the choice of goal is passed by when only
 * one was named. */
function back(step: Step, goals: number): Step {
  const order: Step[] = [...WHO, ...HOW];
  const prev = order[Math.max(0, order.indexOf(step) - 1)];
  return prev === "pick" && goals <= 1 ? "goals" : prev;
}

function Forward({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return <FlowNext label={oc.next} onClick={onClick} disabled={disabled} />;
}

/**
 * A few names, one to a box, with a box added on asking. Those already
 * made are shown as made, and stay.
 */
function Names({
  names,
  made,
  onChange,
  onUse,
  level,
  label,
  add,
  field,
}: {
  names: string[];
  made: Made[];
  onChange: (next: string[]) => void;
  /** One already in the tree, used instead of naming it again. */
  onUse: (m: Made) => void;
  level: GoalLevel;
  label: (n: number) => string;
  add: string;
  field: string;
}) {
  const madeNames = new Set(made.map((m) => m.name));
  const open = names.filter((n) => !madeNames.has(n.trim()));
  const boxes = open.length ? open : [""];
  const total = made.length + boxes.length;
  const set = (i: number, v: string) => onChange([...made.map((m) => m.name), ...boxes.map((b, j) => (j === i ? v.slice(0, 160) : b))]);
  return (
    <div className="flex flex-col gap-2">
      {made.map((m, i) => (
        <div key={m.id} className="cartograph-new flex h-11 items-center rounded-lg bg-card px-3 text-base" aria-label={label(i + 1)}>
          {m.name}
        </div>
      ))}
      {boxes.map((b, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Input value={b} onChange={(e) => set(i, e.target.value)} aria-label={label(made.length + i + 1)} data-cartograph-field={field} className="h-11 text-base" autoFocus={i === boxes.length - 1} />
          <DidYouMean
            kind="Goal"
            level={level}
            name={b}
            onUse={(m) => {
              onUse({ id: m.id, name: m.name });
              onChange([...made.map((x) => x.name), m.name, ...boxes.filter((_, j) => j !== i)]);
            }}
          />
        </div>
      ))}
      {total < 3 ? (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onChange([...made.map((m) => m.name), ...boxes, ""])} disabled={!boxes[boxes.length - 1].trim()}>
          <Plus />
          {add}
        </Button>
      ) : null}
    </div>
  );
}

/** What the thing asked for is, in the engine's words, with an example:
 * on every screen, so the taxonomy is learnt by using it. */
function Definition({ term, text, example }: { term: string; text?: string; example?: ReactNode }) {
  if (!text) return null;
  return (
    <aside className="cartograph-unfold flex gap-3 rounded-xl bg-muted/40 p-4 text-sm" style={{ "--delay": "150ms" } as React.CSSProperties} data-slot="definition" aria-label={oc.definition}>
      <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p>
          <span className="font-semibold">{term}.</span> <span className="text-muted-foreground">{text}</span>
        </p>
        {example ? (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground/80">{oc.example}: </span>
            {example}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

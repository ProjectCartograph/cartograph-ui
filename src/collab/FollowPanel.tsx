import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Bot, Eye, EyeOff, ListChecks, MapPin, PenLine, Send, X } from "lucide-react";

import { holds, useSession } from "@/access/access";
import { useClient } from "@/client/context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";

import { groupSteps, placeOf, useFollow, whereNow, type AgentLane, type AgentStep, type StepGroup } from "./follow";

const fc = copy.follow;
const MINE = "__mine__";

const icons = { guide: BookOpen, read: Eye, draft: PenLine, checks: ListChecks, propose: Send } as const;

function stepText(s: AgentStep): string {
  const name = s.name ?? s.id ?? "";
  switch (s.step) {
    case "guide":
      return fc.steps.guide(s.kind ?? "");
    case "read":
      return fc.steps.read(name);
    case "draft":
      return fc.steps.draft(name);
    case "checks":
      return fc.steps.checks(name);
    default:
      return fc.steps.propose(name, s.parts ?? 1);
  }
}

/** How far a draft is from meeting its checks, filling as it gets there. */
function CheckProgress({ met, open }: { met: number; open: number }) {
  const total = met + open;
  if (total === 0) return null;
  const done = open === 0;
  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${done ? "bg-success" : "bg-violet-500"}`}
          style={{ width: `${Math.round((met / total) * 100)}%` }}
        />
      </div>
      {done ? (
        <span className="flex items-center gap-1 text-success">
          <svg className="cartograph-draw size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <polyline points="3,8.5 6.5,12 13,4.5" />
          </svg>
          {fc.allMet}
        </span>
      ) : (
        <span>{fc.checksMet(met, total)}</span>
      )}
    </div>
  );
}

/** One record's activity: what the agent last did on it, how often it
 * edited it, every field it changed and where its checks stand now. */
function Step({ group, color }: { group: StepGroup; color: string }) {
  const f = useFollow();
  const step = group.last;
  const Icon = icons[step.step];
  const proposed = step.step === "propose";
  const there = placeOf(step) !== undefined;
  return (
    <li className="relative flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300" data-cartograph-step={step.step}>
      <span className="relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
        {proposed ? <span className="cartograph-burst absolute inset-0 rounded-full" style={{ backgroundColor: color }} aria-hidden /> : null}
        <Icon className="relative size-3.5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        {there ? (
          <button
            type="button"
            className="block max-w-full truncate text-left underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
            title={fc.goToStep}
            data-cartograph-follow
            onClick={() => f.go(step)}
          >
            {stepText(step)}
          </button>
        ) : (
          <p className="truncate">{stepText(step)}</p>
        )}
        {group.fields.length > 0 || group.edits > 1 ? (
          <p className="text-xs text-muted-foreground">
            {[group.edits > 1 ? fc.edits(group.edits) : "", group.fields.length > 0 ? fc.changed(group.fields.length) : ""].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {group.met !== undefined || group.open !== undefined ? <CheckProgress met={group.met ?? 0} open={group.open ?? 0} /> : null}
        {proposed && step.changeSet ? (
          <Button size="xs" className="mt-1" asChild data-cartograph-follow>
            <Link to="/changesets/$id" params={{ id: step.changeSet }}>
              {fc.review}
            </Link>
          </Button>
        ) : proposed && step.proposal ? (
          <Button size="xs" className="mt-1" asChild data-cartograph-follow>
            <Link to="/proposals/$id" params={{ id: step.proposal }}>
              {fc.review}
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function Lane({ lane }: { lane: AgentLane }) {
  const f = useFollow();
  const followed = f.following === lane.session;
  const hidden = f.hidden.has(lane.session);
  const now = whereNow(lane);
  return (
    <div className="flex items-center gap-2 py-1" data-cartograph-lane={lane.session}>
      <span className="relative flex size-2.5 shrink-0">
        {lane.active ? <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ backgroundColor: lane.color }} /> : null}
        <span className="relative inline-flex size-2.5 rounded-full" style={{ backgroundColor: lane.color }} />
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm ${hidden ? "text-muted-foreground line-through" : ""}`} title={lane.actor}>
        {lane.label}
      </span>
      <span className="text-xs text-muted-foreground">{lane.active ? fc.working : fc.idle}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={hidden ? fc.show(lane.label) : fc.hide(lane.label)}
        onClick={() => f.toggleLane(lane.session)}
      >
        {hidden ? <EyeOff /> : <Eye />}
      </Button>
      {hidden || !now ? null : (
        <Button variant="ghost" size="icon-xs" aria-label={fc.goThere(lane.label)} title={fc.goThere(lane.label)} data-cartograph-follow onClick={() => f.go(now)}>
          <MapPin />
        </Button>
      )}
      {hidden ? null : (
        <Button size="xs" variant={followed ? "secondary" : "default"} onClick={() => (followed ? f.unfollow() : f.follow(lane.session))}>
          {followed ? fc.stop : fc.follow}
        </Button>
      )}
    </div>
  );
}

/**
 * The agents working for this person, and the steps of the one they are
 * following, as they happen (engine docs/adr/0018). Docked beside the
 * page, so the person stays in Cartograph while the agent works in it.
 */
export function FollowPanel() {
  const f = useFollow();
  const client = useClient();
  const { data: session } = useSession();
  const admin = holds(session, "administrator");
  const people = useQuery({ queryKey: ["people"], queryFn: () => client.people(), enabled: admin && f.panelOpen, retry: false });
  if (!f.panelOpen) return null;

  const visible = f.lanes.filter((l) => !f.hidden.has(l.session));
  const shown = f.lanes.find((l) => l.session === f.following) ?? visible.find((l) => l.active) ?? visible[0];
  const groups = groupSteps(shown?.steps ?? []).slice(-30);
  return (
    <aside
      className="fixed inset-y-2 right-2 z-40 flex w-80 max-w-[calc(100vw-1rem)] flex-col rounded-xl border bg-background shadow-xl animate-in fade-in slide-in-from-right-8 duration-300"
      data-cartograph-region="follow"
      data-cartograph-follow
      aria-label={fc.title}
    >
      <header className="flex items-center gap-2 border-b p-3">
        <Bot className="size-4" style={shown ? { color: shown.color } : undefined} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{f.following && shown ? fc.following(shown.label) : fc.title}</h2>
        <Button variant="ghost" size="icon-xs" aria-label={fc.close} onClick={() => f.setPanelOpen(false)}>
          <X />
        </Button>
      </header>

      <div className="space-y-2 border-b p-3">
        {admin ? (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{fc.whose}</Label>
            <Select value={f.person ?? MINE} onValueChange={(v) => f.followPerson(v === MINE ? undefined : v)}>
              <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MINE}>{fc.mine}</SelectItem>
                {(people.data ?? [])
                  .filter((p) => p.email !== session?.email)
                  .map((p) => (
                    <SelectItem key={p.email} value={p.email}>
                      {p.name || p.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {f.lanes.length === 0 ? <p className="text-sm text-muted-foreground">{fc.none}</p> : null}
        {f.lanes.map((lane) => (
          <Lane key={lane.session} lane={lane} />
        ))}
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-muted-foreground">
          <Checkbox checked={f.othersOnDrafts} onCheckedChange={(on) => f.setOthersOnDrafts(on === true)} />
          {fc.othersOnDrafts}
        </label>
      </div>

      <ol className="flex-1 space-y-3 overflow-y-auto p-3" data-cartograph-region="follow-steps">
        {shown ? groups.map((g) => <Step key={g.key} group={g} color={shown.color} />) : null}
      </ol>
      {f.following ? <p className="border-t p-2 text-center text-xs text-muted-foreground">{fc.takeBack}</p> : null}
    </aside>
  );
}

/**
 * Following goes on with the panel closed: a small chip says whom, what
 * they last did, and gives the panel back or stops. Pressing it never
 * takes the view back.
 */
export function FollowChip() {
  const f = useFollow();
  if (f.panelOpen || !f.following) return null;
  const lane = f.lanes.find((l) => l.session === f.following);
  if (!lane) return null;
  const last = lane.steps.at(-1);
  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border bg-background/95 py-1 pr-1 pl-3 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
      data-cartograph-follow
      role="status"
      aria-label={fc.following(lane.label)}
    >
      <span className="relative flex size-2.5 shrink-0">
        {lane.active ? <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ backgroundColor: lane.color }} /> : null}
        <span className="relative inline-flex size-2.5 rounded-full" style={{ backgroundColor: lane.color }} />
      </span>
      <span className="min-w-0 truncate">
        <span className="font-medium">{fc.following(lane.label)}</span>
        {last ? <span className="text-muted-foreground"> · {stepText(last)}</span> : null}
      </span>
      <Button variant="ghost" size="xs" onClick={() => f.setPanelOpen(true)} aria-label={fc.openPanel} title={fc.openPanel}>
        <Bot />
      </Button>
      <Button variant="secondary" size="xs" className="rounded-full" onClick={() => f.unfollow()}>
        {fc.stop}
      </Button>
    </div>
  );
}

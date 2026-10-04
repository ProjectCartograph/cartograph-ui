// Following agents (engine docs/adr/0018). An agent holds no socket; the
// engine announces each step it takes (read a guide, drafted, ran the
// checks, proposed) as presence on the feed of the person it acts for,
// which only that person, or an administrator, may open. This listens to
// one feed without being seen, keeps a lane of steps per agent (a
// sub-agent is its own lane), and, while someone follows a lane, moves
// their view with it: to the manifest it drafts, to the fields it changed,
// to the review of what it proposed. Any input of theirs hands the view
// back.

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useClient } from "@/client/context";
import type { Peer, PresenceAgent } from "@/client/port";
import { EXPIRY_MS } from "@/client/presence";
import { manifestLink } from "@/proposals/links";

/** One step, as it was announced, and when it was heard here. */
export interface AgentStep extends PresenceAgent {
  heard: number;
}

/** One agent's steps on this feed. */
export interface AgentLane {
  session: string;
  /** How the agent is named: its person's name and its own. */
  label: string;
  color: string;
  /** The principal it acts as ("ada@example.org via Claude"). */
  actor: string;
  steps: AgentStep[];
  /** Heard from within the time presence lasts: working. Otherwise idle,
   * which costs nothing and changes nothing on screen until it moves. */
  active: boolean;
}

export interface FollowApi {
  /** Every lane heard on the feed, the hidden ones included. */
  lanes: AgentLane[];
  /** Lanes the viewer chose not to see. */
  hidden: ReadonlySet<string>;
  toggleLane: (session: string) => void;
  /** The lane being followed, if any. */
  following?: string;
  follow: (session: string) => void;
  unfollow: () => void;
  /** Whose agents: undefined for the viewer's own. */
  person?: string;
  followPerson: (person?: string) => void;
  /** Whether other people's agents are drawn on a draft. */
  othersOnDrafts: boolean;
  setOthersOnDrafts: (on: boolean) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  /** Takes the viewer to where a step happened, without following. */
  go: (step: AgentStep) => void;
  /** The last proposal a followed lane made, for the moment it lands. */
  landed?: AgentStep;
  /** The viewer, as an agent's for names them. */
  me: string;
}

const quiet: FollowApi = {
  lanes: [],
  hidden: new Set(),
  toggleLane: () => {},
  follow: () => {},
  unfollow: () => {},
  go: () => {},
  followPerson: () => {},
  othersOnDrafts: true,
  setOthersOnDrafts: () => {},
  panelOpen: false,
  setPanelOpen: () => {},
  me: "",
};

const FollowContext = createContext<FollowApi>(quiet);

/** The agents this person can follow, and how they are following them. */
export function useFollow(): FollowApi {
  return useContext(FollowContext);
}

/** At most this many steps are kept per lane. */
const KEEP = 200;
/** How long a changed field glows. */
const GLOW_MS = 2400;

// The viewer's choices are theirs alone and kept on this device: which
// lanes they hide, and whether other people's agents show on drafts.
const PREFS = "cartograph.follow";
function readPrefs(): { hidden: string[]; othersOnDrafts: boolean } {
  try {
    const raw = window.localStorage.getItem(PREFS);
    if (raw) {
      const p = JSON.parse(raw) as { hidden?: unknown; othersOnDrafts?: unknown };
      return {
        hidden: Array.isArray(p.hidden) ? p.hidden.filter((h): h is string => typeof h === "string") : [],
        othersOnDrafts: p.othersOnDrafts !== false,
      };
    }
  } catch {
    // A private window keeps nothing; the defaults stand.
  }
  return { hidden: [], othersOnDrafts: true };
}
function writePrefs(p: { hidden: string[]; othersOnDrafts: boolean }) {
  try {
    window.localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {
    // As above.
  }
}

/** Takes the peers a feed holds now into the lanes, each step once. */
export function mergeLanes(lanes: Map<string, AgentLane>, peers: Peer[], now: number): boolean {
  let changed = false;
  const heard = new Set<string>();
  for (const peer of peers) {
    if (!peer.agent) continue;
    heard.add(peer.session);
    let lane = lanes.get(peer.session);
    if (!lane) {
      lane = { session: peer.session, label: peer.name ?? peer.actor, color: peer.color, actor: peer.actor, steps: [], active: true };
      lanes.set(peer.session, lane);
      changed = true;
    }
    if (!lane.active) {
      lane.active = true;
      changed = true;
    }
    const last = lane.steps[lane.steps.length - 1];
    if (!last || peer.agent.seq > last.seq) {
      lane.steps = [...lane.steps, { ...peer.agent, heard: now }].slice(-KEEP);
      changed = true;
    }
  }
  for (const lane of lanes.values()) {
    const quietFor = now - (lane.steps[lane.steps.length - 1]?.heard ?? 0);
    if (lane.active && !heard.has(lane.session) && quietFor >= EXPIRY_MS) {
      lane.active = false;
      changed = true;
    }
  }
  return changed;
}

// Where each kind's records are listed: where an agent is while it reads
// how to define one, before it has a record to open.
const homes: Record<string, string> = {
  Goal: "/goals",
  Project: "/projects",
  Programme: "/programmes",
  Operation: "/operations",
  Gap: "/gaps",
  KPI: "/kpis",
  KPIReadings: "/kpis",
};

/** Where a step happened, if it happened anywhere a person can open. */
export function placeOf(step: Pick<AgentStep, "step" | "kind" | "id" | "proposal" | "changeSet">): { to: string; params?: Record<string, string> } | undefined {
  // Work in a change set is followed on its review, where every draft of
  // it shows as the agent writes it.
  if (step.changeSet && step.step !== "guide") return { to: "/changesets/$id", params: { id: step.changeSet } };
  if (step.step === "propose" && step.proposal) return { to: "/proposals/$id", params: { id: step.proposal } };
  if (!step.kind) return undefined;
  if (step.id && step.step !== "guide") return manifestLink({ kind: step.kind, manifestId: step.id });
  return homes[step.kind] ? { to: homes[step.kind] } : { to: "/sheets/$kind", params: { kind: step.kind } };
}

/** The latest step of a lane that happened somewhere, the place it is now. */
export function whereNow(lane: AgentLane | undefined): AgentStep | undefined {
  const steps = lane?.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i--) if (placeOf(steps[i])) return steps[i];
  return undefined;
}

/** One record's activity in a lane: every step the agent took on it, as
 * one entry where it last worked on it. */
export interface StepGroup {
  key: string;
  /** The latest step, which the entry reads as. */
  last: AgentStep;
  /** How many drafts it saved of this record. */
  edits: number;
  /** Every field it changed, across them all. */
  fields: string[];
  /** The latest checks it saw on this record. */
  met?: number;
  open?: number;
}

/** Steps grouped by what they were on, each group placed where its latest
 * step was: an agent working on one goal through many saves reads as one
 * entry that moves down as it returns to it. A proposal is its own. */
export function groupSteps(steps: readonly AgentStep[]): StepGroup[] {
  const groups = new Map<string, StepGroup>();
  for (const s of steps) {
    const key = s.step === "propose" && s.proposal ? `proposal:${s.proposal}` : s.id && s.kind ? `${s.kind}/${s.id}` : `${s.step}:${s.kind ?? ""}`;
    const g = groups.get(key) ?? { key, last: s, edits: 0, fields: [] };
    groups.delete(key);
    g.last = s;
    if (s.step === "draft") g.edits++;
    for (const f of s.fields ?? []) if (!g.fields.includes(f)) g.fields.push(f);
    if (s.met !== undefined || s.open !== undefined) {
      g.met = s.met;
      g.open = s.open;
    }
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Brings a change set's record into view and makes it glow. */
function glowItem(id: string) {
  const el = typeof document === "undefined" ? null : document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.remove("cartograph-agent-glow");
  void el.offsetWidth;
  el.classList.add("cartograph-agent-glow");
  window.setTimeout(() => el.classList.remove("cartograph-agent-glow"), GLOW_MS);
}

/** Makes the fields an agent changed glow, and brings the first into view. */
function glow(fields: string[]) {
  if (typeof document === "undefined") return;
  let first = true;
  for (const path of fields) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-cartograph-field="${CSS.escape(path)}"]`))) {
      if (first) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        first = false;
      }
      el.classList.remove("cartograph-agent-glow");
      // Restart the animation on an element that glowed a moment ago.
      void el.offsetWidth;
      el.classList.add("cartograph-agent-glow");
      window.setTimeout(() => el.classList.remove("cartograph-agent-glow"), GLOW_MS);
    }
  }
}

export function FollowProvider({ children }: { children?: ReactNode }) {
  const client = useClient();
  const navigate = useNavigate();
  const lanesRef = useRef(new Map<string, AgentLane>());
  const [lanes, setLanes] = useState<AgentLane[]>([]);
  const [person, setPerson] = useState<string | undefined>(undefined);
  const [following, setFollowing] = useState<string | undefined>(undefined);
  const [panelOpen, setPanelOpen] = useState(false);
  const [landed, setLanded] = useState<AgentStep | undefined>(undefined);
  const [prefs, setPrefs] = useState(readPrefs);
  const [me, setMe] = useState("");
  useEffect(() => {
    void client
      .session()
      .then((s) => setMe((s.email ?? "").toLowerCase()))
      .catch(() => {});
  }, [client]);
  const followingRef = useRef(following);
  followingRef.current = following;

  // A step of the followed lane moves the view: to the review of what it
  // proposed, to the manifest it worked on and the fields it changed, or,
  // while it reads how to define a kind, to where that kind is listed.
  const lead = useCallback(
    (step: AgentStep) => {
      const place = placeOf(step);
      if (!place) return;
      if (step.step === "propose") setLanded(step);
      void navigate({ to: place.to as never, params: place.params as never }).then(() => {
        if (step.changeSet && step.kind && step.id) {
          // On the change set's review: the record it worked on, in view.
          window.setTimeout(() => glowItem(`item-${step.kind}-${step.id}`), 350);
          return;
        }
        if (step.step === "draft" && step.fields?.length) window.setTimeout(() => glow(step.fields!), 350);
      });
    },
    [navigate],
  );

  useEffect(() => {
    let closed = false;
    let stop: (() => void) | undefined;
    let close: (() => void) | undefined;
    lanesRef.current = new Map();
    setLanes([]);
    void client
      .followAgents(person)
      .then((channel) => {
        if (closed) {
          channel.close();
          return;
        }
        close = () => channel.close();
        stop = channel.subscribe((peers) => {
          const now = Date.now();
          const before = followingRef.current ? lanesRef.current.get(followingRef.current)?.steps.at(-1)?.seq : undefined;
          if (!mergeLanes(lanesRef.current, peers, now)) return;
          setLanes([...lanesRef.current.values()].map((l) => ({ ...l })));
          const lane = followingRef.current ? lanesRef.current.get(followingRef.current) : undefined;
          const latest = lane?.steps.at(-1);
          if (latest && latest.seq !== before) lead(latest);
        });
      })
      .catch(() => {
        // No feed to follow (no shared drafts, or not allowed): nothing to show.
      });
    // Steps still age out when nothing new arrives.
    const sweep = window.setInterval(() => {
      if (mergeLanes(lanesRef.current, [], Date.now())) setLanes([...lanesRef.current.values()].map((l) => ({ ...l })));
    }, 2000);
    return () => {
      closed = true;
      stop?.();
      close?.();
      window.clearInterval(sweep);
    };
  }, [client, person, lead]);

  // Any input of the viewer's own, outside the follow controls, hands the
  // view back to them.
  useEffect(() => {
    if (!following) return;
    const takeBack = (e: Event) => {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-cartograph-follow]")) return;
      setFollowing(undefined);
    };
    window.addEventListener("pointerdown", takeBack, true);
    window.addEventListener("keydown", takeBack, true);
    return () => {
      window.removeEventListener("pointerdown", takeBack, true);
      window.removeEventListener("keydown", takeBack, true);
    };
  }, [following]);

  const hidden = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);
  const value: FollowApi = {
    lanes,
    hidden,
    toggleLane: (session) => {
      const next = hidden.has(session) ? prefs.hidden.filter((h) => h !== session) : [...prefs.hidden, session];
      const p = { ...prefs, hidden: next };
      setPrefs(p);
      writePrefs(p);
      if (following === session && !hidden.has(session)) setFollowing(undefined);
    },
    following,
    follow: (session) => {
      setFollowing(session);
      setPanelOpen(true);
      // Straight to where it is now, not only when it next moves.
      const now = whereNow(lanesRef.current.get(session));
      if (now) lead(now);
    },
    go: lead,
    unfollow: () => setFollowing(undefined),
    person,
    followPerson: (p) => {
      setFollowing(undefined);
      setPerson(p || undefined);
    },
    othersOnDrafts: prefs.othersOnDrafts,
    setOthersOnDrafts: (on) => {
      const p = { ...prefs, othersOnDrafts: on };
      setPrefs(p);
      writePrefs(p);
    },
    panelOpen,
    setPanelOpen,
    landed,
    me,
  };
  return createElement(FollowContext.Provider, { value }, children);
}

/** Hands a fixed follow state to everything below it, for tests. */
export function FollowFeed({ value, children }: { value: Partial<FollowApi>; children?: ReactNode }) {
  return createElement(FollowContext.Provider, { value: { ...quiet, ...value } }, children);
}

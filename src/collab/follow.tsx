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
  /** Heard from within the time presence lasts. */
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
  // proposed, or to the manifest it worked on and the fields it changed.
  const lead = useCallback(
    (step: AgentStep) => {
      if (step.step === "propose" && step.proposal) {
        setLanded(step);
        void navigate({ to: "/proposals/$id", params: { id: step.proposal } });
        return;
      }
      if (!step.kind || !step.id || step.step === "guide") return;
      const link = manifestLink({ kind: step.kind, manifestId: step.id });
      void navigate({ to: link.to as never, params: link.params as never }).then(() => {
        if (step.fields?.length) window.setTimeout(() => glow(step.fields!), 350);
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
      const latest = lanesRef.current.get(session)?.steps.at(-1);
      if (latest) lead(latest);
    },
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

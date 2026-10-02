import type { CSSProperties } from "react";

import type { Peer } from "@/client/port";
import { copy } from "@/copy";
import { sameView } from "./presence";
import { displayName, initials } from "./names";
import { usePresence } from "./presenceContext";

/** One per person, however many tabs they have open on that section. */
function people(peers: Peer[]): Peer[] {
  const seen = new Map<string, Peer>();
  for (const p of peers) if (!seen.has(p.actor)) seen.set(p.actor, p);
  return [...seen.values()];
}

/** The others on the section at path: its own view of the same manifest. */
export function usePeersOn(path: string): Peer[] {
  const { peers } = usePresence();
  return people(peers.filter((p) => sameView(p.route, path)));
}

/** A ring in the first one's colour around the step they are on, as a
 * spreadsheet marks the tab someone else is on. */
export function sectionRing(peers: Peer[]): CSSProperties | undefined {
  return peers.length > 0 ? { boxShadow: `inset 0 0 0 2px ${peers[0].color}` } : undefined;
}

/**
 * Who is on another section of this manifest, as small initials beside
 * its step. Their pointers and carets are drawn only on that section,
 * for the people on it; here they are a place, not a cursor.
 */
export function SectionPeers({ peers }: { peers: Peer[] }) {
  if (peers.length === 0) return null;
  const names = peers.map(displayName);
  return (
    <span
      className="ml-auto flex shrink-0 -space-x-1"
      data-slot="section-peers"
      role="img"
      aria-label={copy.collab.onSection(names)}
      title={copy.collab.onSection(names)}
    >
      {peers.slice(0, 3).map((p) => (
        <span
          key={p.actor}
          className="flex size-4 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-1 ring-background"
          style={{ backgroundColor: p.color }}
        >
          {initials(displayName(p))}
        </span>
      ))}
    </span>
  );
}

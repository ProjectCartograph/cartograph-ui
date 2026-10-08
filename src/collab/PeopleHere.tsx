import { Footprints, GitBranch } from "lucide-react";

import { activeChangeSet } from "@/client/active";
import type { Peer } from "@/client/port";
import { useActiveChangeSet } from "@/changesets/useActive";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copy } from "@/copy";
import { displayName, initials } from "./names";
import { usePresence } from "./presenceContext";
import { walkerOf } from "./walkers";

/** One avatar per person, however many tabs they have open here. */
function people(peers: Peer[]): Peer[] {
  const seen = new Map<string, Peer>();
  for (const p of peers) if (!seen.has(p.actor)) seen.set(p.actor, p);
  return [...seen.values()];
}

/**
 * The people on this screen, as initials in their colours; the name on
 * hover and on focus. Nothing at all when nobody else is here.
 */
export function PeopleHere() {
  const { peers, walking = [] } = usePresence();
  const mine = useActiveChangeSet();
  const here = people([...peers, ...walking]);
  if (here.length === 0) return null;
  return (
    <ul aria-label={copy.collab.peopleHere} data-slot="people-here" className="flex shrink-0 items-center -space-x-1.5">
      {here.map((peer) => {
        const walk = walkerOf(peer.route);
        // On this record in another change set: shown, and one press
        // joins them there, where their edits and carets are.
        const elsewhere = !walk && !peer.agent && peer.changeSet !== undefined && peer.changeSet !== mine;
        const name = walk ? copy.collab.walking(displayName(peer), walk) : elsewhere ? copy.collab.elsewhere(displayName(peer)) : displayName(peer);
        return (
          <li key={peer.actor}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  role={elsewhere ? "button" : "img"}
                  aria-label={elsewhere ? copy.collab.join(displayName(peer)) : name}
                  data-actor={peer.actor}
                  data-elsewhere={elsewhere ? "" : undefined}
                  onClick={elsewhere ? () => activeChangeSet.set(peer.changeSet) : undefined}
                  onKeyDown={elsewhere ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activeChangeSet.set(peer.changeSet); } } : undefined}
                  className={`relative flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-background outline-none focus-visible:ring-ring${elsewhere ? " cursor-pointer opacity-80" : ""}`}
                  style={{ backgroundColor: peer.color }}
                >
                  {initials(displayName(peer))}
                  {/* Walking a flow of their own: shown, never followed. */}
                  {elsewhere ? (
                    <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-border" data-slot="elsewhere">
                      <GitBranch className="size-2.5" aria-hidden="true" />
                    </span>
                  ) : null}
                  {walk ? (
                    <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-border" data-slot="walking">
                      <Footprints className="size-2.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
              </TooltipTrigger>
              <TooltipContent>{elsewhere ? copy.collab.join(displayName(peer)) : name}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

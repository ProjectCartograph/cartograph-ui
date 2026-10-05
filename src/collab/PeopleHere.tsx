import { Footprints } from "lucide-react";

import type { Peer } from "@/client/port";
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
  const here = people([...peers, ...walking]);
  if (here.length === 0) return null;
  return (
    <ul aria-label={copy.collab.peopleHere} data-slot="people-here" className="flex shrink-0 items-center -space-x-1.5">
      {here.map((peer) => {
        const walk = walkerOf(peer.route);
        const name = walk ? copy.collab.walking(displayName(peer), walk) : displayName(peer);
        return (
          <li key={peer.actor}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  role="img"
                  aria-label={name}
                  data-actor={peer.actor}
                  className="relative flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-background outline-none focus-visible:ring-ring"
                  style={{ backgroundColor: peer.color }}
                >
                  {initials(displayName(peer))}
                  {/* Walking a flow of their own: shown, never followed. */}
                  {walk ? (
                    <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-border" data-slot="walking">
                      <Footprints className="size-2.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
              </TooltipTrigger>
              <TooltipContent>{name}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

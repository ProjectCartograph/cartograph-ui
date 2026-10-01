import type { Peer } from "@/client/port";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copy } from "@/copy";
import { displayName, initials } from "./names";
import { usePresence } from "./presenceContext";

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
  const { peers } = usePresence();
  const here = people(peers);
  if (here.length === 0) return null;
  return (
    <ul aria-label={copy.collab.peopleHere} data-slot="people-here" className="flex shrink-0 items-center -space-x-1.5">
      {here.map((peer) => {
        const name = displayName(peer);
        return (
          <li key={peer.actor}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  role="img"
                  aria-label={name}
                  data-actor={peer.actor}
                  className="flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-background outline-none focus-visible:ring-ring"
                  style={{ backgroundColor: peer.color }}
                >
                  {initials(name)}
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

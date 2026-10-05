import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { copy } from "@/copy";
import { useLeftToDo } from "./leftToDo";

const lc = copy.home.left;

/** How many are listed; the rest are counted. */
const SHOWN = 4;

/**
 * What was started and not finished, under the question on the home page:
 * the first thing in view on arriving, never in the way of asking. Each
 * opens where it is finished; the list empties as they are.
 */
export function LeftToDo() {
  const items = useLeftToDo();
  if (items.length === 0) return null;
  return (
    <section className="flex w-full flex-col gap-2 rounded-xl bg-warning/5 p-4 ring-1 ring-warning/30" data-cartograph-region="left-to-do" aria-labelledby="left-to-do-title">
      <div>
        <h2 id="left-to-do-title" className="text-sm font-semibold">
          {lc.title}
        </h2>
        <p className="text-xs text-muted-foreground">{lc.hint}</p>
      </div>
      <ul className="flex flex-col">
        {items.slice(0, SHOWN).map((item, i) => (
          <li key={item.key} className="cartograph-arrive" style={{ animationDelay: `${i * 50}ms` }}>
            <Link
              to={item.to}
              params={item.params as never}
              className="group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ease-standard hover:bg-warning/10"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground"> · {item.why}</span>
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      {items.length > SHOWN ? <p className="px-2 text-xs text-muted-foreground">{lc.more(items.length - SHOWN)}</p> : null}
    </section>
  );
}

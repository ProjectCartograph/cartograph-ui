import { Fragment, useEffect, useRef, useState } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { ProgressRing } from "@/components/ProgressRing";
import { copy } from "@/copy";

const ac = copy.projects.assembly;

export interface OutlinePart {
  key: string;
  label: string;
  icon: LucideIcon;
  filled: boolean;
  /** In place through something else (a component's parent). */
  inherited?: boolean;
  count: number;
  to: LinkProps["to"];
}

/**
 * The outline of a definition, always in view: its parts in the order the
 * document reads, each lit as it is written, the line between two drawn
 * when both exist, and one short line when a part is filled in during this
 * visit (LSS_REVIEW.md, D22). Shared by projects, programmes and
 * operations so every flow shows what is being built the same way.
 */
export function OutlineStrip({ id, parts, loaded }: { id: string; parts: OutlinePart[]; loaded: boolean }) {
  const filled = parts.filter((p) => p.filled).length;
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const key = parts.map((p) => (p.filled ? "1" : "0")).join("");
  useEffect(() => {
    if (!loaded) return;
    const now = new Set(parts.filter((p) => p.filled).map((p) => p.key));
    if (seen.current) {
      const added = [...now].find((p) => !seen.current!.has(p));
      if (added) {
        setFresh(added);
        const t = setTimeout(() => setFresh(null), 2400);
        seen.current = now;
        return () => clearTimeout(t);
      }
    }
    seen.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loaded]);

  const freshLabel = parts.find((p) => p.key === fresh)?.label;

  return (
    <nav aria-label={ac.title} className="flex flex-col gap-2 rounded-xl bg-muted/30 px-3 py-2.5" data-slot="assembly" data-cartograph-region="outline">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ProgressRing value={filled / parts.length} size={16} label={ac.progress(filled, parts.length)} className="text-primary" />
        <span className="font-medium">{ac.title}</span>
        <span aria-live="polite" className="ml-auto min-h-4">
          {freshLabel ? (
            <span className="text-primary animate-in fade-in slide-in-from-right-1 duration-300 motion-reduce:animate-none">
              {ac.done(freshLabel)}
            </span>
          ) : null}
        </span>
      </div>
      <ol className="flex items-center">
        {parts.map((p, i) => {
          const Icon = p.icon;
          const joined = i > 0 && parts[i - 1].filled && p.filled;
          return (
            <Fragment key={p.key}>
              {i > 0 ? (
                <li aria-hidden="true" className="relative mx-1 h-0.5 min-w-3 flex-1 overflow-hidden rounded bg-border">
                  <span
                    className={`absolute inset-0 origin-left bg-primary transition-transform duration-500 ease-out motion-reduce:transition-none ${
                      joined ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </li>
              ) : null}
              <li>
                <Link
                  to={p.to}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  params={{ id } as any}
                  className="group flex flex-col items-center gap-1 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`${p.label}: ${p.inherited ? ac.inherited : p.filled ? ac.inPlace(p.count) : ac.notYet}`}
                  data-filled={p.filled}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-full ring-1 transition-colors duration-300 motion-reduce:transition-none ${
                      p.inherited
                        ? "bg-primary/15 text-primary ring-primary/40"
                        : p.filled
                          ? "bg-primary text-primary-foreground ring-primary"
                          : "bg-background text-muted-foreground ring-border group-hover:ring-primary/50"
                    } ${fresh === p.key ? "animate-in zoom-in-75 duration-500 motion-reduce:animate-none" : ""}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className={`text-[11px] ${p.filled ? "text-foreground" : "text-muted-foreground"}`}>{p.label}</span>
                </Link>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

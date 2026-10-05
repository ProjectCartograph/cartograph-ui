import { useEffect, useState } from "react";
import { Footprints } from "lucide-react";

import { copy } from "@/copy";

/** The example teammate's colour, as presence gives each person one. */
const COLOUR = "#db2777";

type Box = { left: number; top: number; width: number; height: number };

const boxOf = (selector: string): Box | null => {
  const r = document.querySelector(selector)?.getBoundingClientRect();
  return r && r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
};

/**
 * What a teammate on the same screen looks like, drawn for this person
 * only while the tour explains it: their initials beside the people on
 * the screen, and their pointer, named, roaming the page; walking a flow
 * of their own, only a walking mark, and no pointer (collab/walkers).
 * Nothing is sent to anyone; it is the tour's example, not presence.
 */
export function MultiplayerDemo({ walking = false }: { walking?: boolean }) {
  const [header, setHeader] = useState<Box | null>(null);
  const [main, setMain] = useState<Box | null>(null);
  useEffect(() => {
    const read = () => {
      setHeader(boxOf('[data-cartograph-region="header"]'));
      setMain(boxOf('[data-cartograph-region="main"]'));
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  const name = copy.tour.demoName;
  return (
    <div aria-hidden="true" data-slot="tour-demo">
      {header ? (
        <span
          className="absolute flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-background animate-in zoom-in duration-300"
          style={{ left: header.left + header.width - 52, top: header.top + (header.height - 28) / 2, backgroundColor: COLOUR }}
          data-slot="tour-demo-person"
        >
          S
          {walking ? (
            <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-border">
              <Footprints className="size-2.5" />
            </span>
          ) : null}
        </span>
      ) : null}
      {main && !walking ? (
        <div className="absolute overflow-hidden" style={{ left: main.left, top: main.top, width: main.width, height: main.height }}>
          <div className="cartograph-roam absolute inset-0">
            <span className="absolute left-0 top-0 flex items-start gap-0.5">
              <svg viewBox="0 0 16 16" className="size-4 drop-shadow" style={{ color: COLOUR }}>
                <path d="M1 1 L14 7 L8 8.5 L6 14 Z" fill="currentColor" stroke="white" strokeWidth="1" />
              </svg>
              <span className="mt-3 rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: COLOUR }}>
                {name}
              </span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

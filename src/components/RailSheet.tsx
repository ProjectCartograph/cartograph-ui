import { useEffect, useRef, useState, type ReactNode } from "react";
import { ListTree } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { copy } from "@/copy";

/** Whether a floating control should show: hidden while the page scrolls
 * down (the person is reading), back as soon as it scrolls up or stops at
 * the top (they are looking for somewhere to go). */
function useShownOnScroll(): boolean {
  const [shown, setShown] = useState(true);
  const last = useRef(0);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - last.current) > 8) {
          setShown(y < last.current || y < 48);
          last.current = y;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return shown;
}

/**
 * A walk's rail on a narrow screen: not a card the person scrolls to, but
 * one small button in the corner, out of the way while they read, that
 * slides the whole rail in from the side and away again once a step is
 * picked. The stages across the top already show where they are; this is
 * for going somewhere else. Wide screens keep the rail beside the page.
 */
export function RailSheet({ current, children }: { current: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const shown = useShownOnScroll();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={copy.common.allSteps}
          data-slot="rail-sheet-trigger"
          className={`fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 z-40 max-w-[60vw] rounded-full bg-card/95 shadow-md backdrop-blur transition-[translate,opacity] duration-200 ease-standard motion-reduce:transition-none xl:hidden ${
            shown || open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[calc(100%+2rem)] opacity-0"
          }`}
        >
          <ListTree aria-hidden="true" />
          <span className="truncate">{current}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 overflow-y-auto p-3 pt-10"
        // A step picked is somewhere to go: the rail gets out of the way.
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        <SheetTitle className="sr-only">{copy.common.allSteps}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

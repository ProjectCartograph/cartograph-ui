import { useState } from "react";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { markToured, toured, useTour } from "./tourContext";

const tc = copy.tour;

/**
 * The tour offered once, to someone arriving at a workspace others have
 * started: taken or put off, it is not offered again in this browser, and
 * the rail keeps it to hand.
 */
export function TourInvite() {
  const tour = useTour();
  const [shown, setShown] = useState(() => !toured());
  if (!shown || tour.at !== null) return null;
  return (
    <section className="cartograph-unfold flex w-full flex-wrap items-center gap-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/20" data-cartograph-region="tour-invite" aria-label={tc.start}>
      <Compass className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-[12rem] flex-1 text-sm text-pretty">{tc.invite}</p>
      <div className="ml-auto flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            markToured();
            setShown(false);
          }}
        >
          {tc.notNow}
        </Button>
        <Button type="button" size="sm" onClick={() => tour.start()}>
          {tc.start}
        </Button>
      </div>
    </section>
  );
}

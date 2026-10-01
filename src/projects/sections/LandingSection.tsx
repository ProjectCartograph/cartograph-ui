import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { Label } from "@/components/ui/label";
import { copy } from "@/copy";
import { CriteriaSlice } from "./SuccessSection";
import { useProjectStore } from "../store";

const lc = copy.projects.landingCriteria;

/**
 * What must be true once the work is in use, read-only.
 *
 * Landing used to author its own half of the standard while Closing
 * authored the other, so the two screens drifted and the standard was
 * never visible as one thing. Both are written on the Success step now
 * (Programme Lead, 2026-09-27); this shows the lines that fall due here
 * and links back to where they are owned.
 */
export function LandingSection({ id }: { id: string }) {
  const store = useProjectStore();
  const shown = (store.spec.successCriteria ?? []).filter(
    (k) => k.when === "atLanding" || k.when === "postClosingCycle",
  );

  return (
    <div className="flex max-w-3xl flex-col gap-3" data-cartograph-region="landing-criteria">
      <div className="flex items-center justify-between gap-2">
        <Label>{lc.title}</Label>
        <Link
          to="/projects/$id/initiation/success"
          params={{ id }}
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {lc.editOnSuccess}
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{lc.empty}</p>
      ) : (
        <CriteriaSlice id={id} whens={["atLanding", "postClosingCycle"]} />
      )}
    </div>
  );
}

import { FromIdea } from "@/components/FromIdea";
import { Help } from "@/components/guidance";
import { Label } from "@/components/ui/label";
import { copy } from "@/copy";
import { LandsInField } from "../LandsInField";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useProjectStore, useSectionAutosave } from "../store";

const lc = copy.projects.landing;

/**
 * Where the result lands: the service that runs it, and the role that
 * accepts the handover (TAXONOMY.md D23, D30). Asked at the end of the
 * walk, and again on the landing page when the project hands over.
 */
export function HandoverSection({ resolve }: { resolve?: string }) {
  useSectionAutosave();
  const store = useProjectStore();
  // The service owner accepts the handover, as the engine's landing-owner
  // check asks. A role, never a person.
  const owner = store.spec.resources?.find((r) => r.role === "serviceOwner");
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2" data-cartograph-region="landing-extras">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <Label>{lc.landsInTitle}</Label>
          <Help label={lc.landsInTitle} hint={lc.landsInHint} />
        </div>
        <FromIdea field="/spec/operation" />
        <LandsInField resolve={resolve} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <Label>{lc.confirmedByTitle}</Label>
          <Help label={lc.confirmedByTitle} hint={lc.confirmedByHint} />
        </div>
        {/* The service owner is named here, where the handover asks for
            one, rather than back in Resources (#92). */}
        <ReferencePicker
          data-cartograph-field="/spec/resources/-/resource"
          refKind="Resource"
          value={owner?.resource}
          onChange={(v) =>
            store.updateSpec((sp) => {
              const rest = (sp.resources ?? []).filter((r) => r.role !== "serviceOwner");
              return { ...sp, resources: v ? [...rest, { role: "serviceOwner", resource: v }] : rest };
            })
          }
          placeholder={lc.confirmedByPlaceholder}
          label={lc.confirmedByTitle}
        />
        {owner && !owner.resource ? <p className="text-sm font-medium">{copy.projects.resources.roleKind.serviceOwner}</p> : null}
      </div>
    </div>
  );
}

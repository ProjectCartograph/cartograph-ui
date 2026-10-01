import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { copy } from "@/copy";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import type { DependencyDirection, DependencyEdge, Ref, RefKind, TimelinePhase } from "./types";

const rc = copy.projects.risks;

/** The kinds a dependency can point at, plus the escape hatch. Narrower
 * than every kind a reference can name: a project waits on work, on data
 * and on the bodies that run them, not on a beneficiary group. */
const TARGETS: RefKind[] = ["Project", "Programme", "Operation", "DataSource", "Team"];
const EXTERNAL = "__external__";

const DIRECTIONS: DependencyDirection[] = ["needs", "neededBy"];

/**
 * The edge on a dependency: which way it runs, what is at the far end,
 * and the phase it has to land by.
 *
 * It is the whole reason the dependency type is worth keeping. A row
 * typed dependency with nothing but a sentence on it is a risk filed
 * under the wrong word, which is what every dependency in both vaults
 * was until this shape existed (Programme Lead, 2026-09-28): the word
 * alone never taught the category, so the fields do it instead.
 *
 * Direction is declared at one end only. If this project says it waits
 * on something, the far end can show "waiting on you" without anyone
 * writing the other half, which is what makes a tree out of a list.
 */
export function DependencyEdgeEditor({
  value,
  phases,
  onChange,
  "data-cartograph-field": field,
}: {
  /** The edge's own pointer; each part is named under it. */
  "data-cartograph-field"?: string;
  value: DependencyEdge | undefined;
  /** The phases a dependency may land by. Empty for a kind that
   * schedules nothing, where the control is left out rather than shown
   * with nothing in it. */
  phases: TimelinePhase[];
  onChange: (next: DependencyEdge | undefined) => void;
}) {
  const direction = value?.direction ?? "needs";
  const on = value?.on;
  const kind = on?.external !== undefined ? EXTERNAL : (on?.kind ?? "");

  function set(patch: Partial<DependencyEdge>) {
    onChange({ direction, on: on ?? { external: "" }, ...value, ...patch });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={direction}
          onValueChange={(v) => v && set({ direction: v as DependencyDirection })}
          aria-label={rc.dependsDirectionLabel}
          data-cartograph-field={field && `${field}/direction`}
        >
          {DIRECTIONS.map((d) => (
            <ToggleGroupItem key={d} value={d}>
              {rc.direction[d]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Select
          value={kind}
          onValueChange={(v) =>
            set({ on: v === EXTERNAL ? { external: "" } : { kind: v as RefKind, id: "" } })
          }
        >
          <SelectTrigger className="w-40" aria-label={rc.dependsKindLabel} data-cartograph-field={field && `${field}/on/kind`}>
            <SelectValue placeholder={rc.dependsKindLabel} />
          </SelectTrigger>
          <SelectContent>
            {TARGETS.map((k) => (
              <SelectItem key={k} value={k}>
                {copy.sheets.kindsSingular[k] ?? k}
              </SelectItem>
            ))}
            <SelectItem value={EXTERNAL}>{rc.dependsExternal}</SelectItem>
          </SelectContent>
        </Select>

        {/* The far end: a manifest picker per kind, or free text when the
            target is something Cartograph will never hold. Forcing a reference
            here would only make somebody invent a manifest for the board. */}
        {kind === EXTERNAL ? (
          <Input
            data-cartograph-field={field && `${field}/on/external`}
            value={on?.external ?? ""}
            onChange={(e) => set({ on: { external: e.target.value.slice(0, 80) } })}
            placeholder={rc.dependsExternalPlaceholder}
            aria-label={rc.dependsExternalLabel}
            maxLength={80}
            className="w-56"
          />
        ) : kind ? (
          <ReferencePicker
            refKind={kind}
            value={on?.id || undefined}
            onChange={(id) => set({ on: { kind: kind as RefKind, id: id ?? "" } as Ref })}
            label={rc.dependsOnLabel}
            data-cartograph-field={field && `${field}/on/id`}
            className="w-56"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">{rc.dependsNeedByLabel}</Label>
        {phases.length === 0 ? (
          <span className="text-xs text-muted-foreground">{rc.dependsNoPhases}</span>
        ) : (
          <Select
            value={value?.needBy ?? ""}
            onValueChange={(v) => set({ needBy: v || undefined })}
          >
            <SelectTrigger className="w-56" aria-label={rc.dependsNeedByLabel} data-cartograph-field={field && `${field}/needBy`}>
              <SelectValue placeholder={rc.dependsNeedByPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {phases
                .filter((p) => p.id)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id as string}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

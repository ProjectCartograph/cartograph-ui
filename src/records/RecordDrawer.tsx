import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { copy } from "@/copy";
import { DefinitionStoreProvider } from "@/definition/store";
import { EvidenceSection } from "@/gaps/sections/EvidenceSection";
import { ScopeSection } from "@/gaps/sections/ScopeSection";
import { ShortfallSection } from "@/gaps/sections/ShortfallSection";
import { blankGapSpec } from "@/gaps/types";
import { DefinitionSection } from "@/kpis/sections/DefinitionSection";
import { blankKPISpec } from "@/kpis/types";
import { AlignmentSection } from "@/operations/sections/AlignmentSection";
import { MeasuresSection } from "@/operations/sections/MeasuresSection";
import { ServiceSection } from "@/operations/sections/ServiceSection";
import { blankOperationSpec } from "@/operations/types";
import { GoalEditor } from "@/surfaces/goals/GoalEditor";

const rc = copy.recordDrawer;

/** The kinds a project's walk defines in place, without leaving it. */
export type DrawerKind = "Goal" | "Gap" | "KPI" | "Operation";

interface Opened {
  kind: DrawerKind;
  id: string;
  fix?: string;
}

interface DrawerApi {
  /** Opens a record to define it, over whatever is open, with the way
   * back to it. */
  open: (kind: DrawerKind, id: string, fix?: string) => void;
}

const DrawerContext = createContext<DrawerApi | null>(null);

/** The drawer, where there is one: a walk that hosts it defines records in
 * place; anywhere else, a record opens on its own page. */
export function useRecordDrawer(): DrawerApi | null {
  return useContext(DrawerContext);
}

// Each kind's sections, in the order its own walk asks them, read from the
// same components its pages use, so a record defined here is the record
// defined there.
const SECTIONS: Record<Exclude<DrawerKind, "Goal">, { key: string; heading: string; View: () => ReactNode }[]> = {
  Gap: [
    { key: "shortfall", heading: copy.gaps.sections.shortfall.heading, View: ShortfallSection },
    { key: "scope", heading: copy.gaps.sections.scope.heading, View: ScopeSection },
    { key: "evidence", heading: copy.gaps.sections.evidence.heading, View: EvidenceSection },
  ],
  KPI: [{ key: "definition", heading: copy.kpis.sections.definition.heading, View: DefinitionSection }],
  Operation: [
    { key: "service", heading: copy.operations.sections.service.heading, View: ServiceSection },
    { key: "alignment", heading: copy.operations.sections.alignment.heading, View: AlignmentSection },
    { key: "measures", heading: copy.operations.sections.measures.heading, View: MeasuresSection },
  ],
};

const BLANK = { Gap: blankGapSpec, KPI: blankKPISpec, Operation: blankOperationSpec } as const;

/**
 * Defines what a project needs without leaving its walk: a goal, gap,
 * indicator or service opens here, over the walk, with every part of its
 * own editor, and saves into the same change set. One opened from inside
 * another stacks, with the way back; closing returns to the step.
 */
export function RecordDrawerProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Opened[]>([]);
  const open = useCallback((kind: DrawerKind, id: string, fix?: string) => setStack((s) => [...s, { kind, id, fix }]), []);
  const api = useMemo(() => ({ open }), [open]);
  const top = stack[stack.length - 1];
  return (
    <DrawerContext.Provider value={api}>
      {children}
      <Sheet open={Boolean(top)} onOpenChange={(o) => !o && setStack([])}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-2xl" style={{ width: "min(42rem, 100vw)", maxWidth: "100vw" }} data-cartograph-region="record-drawer">
          {top ? (
            <>
              <SheetHeader className="border-b">
                {stack.length > 1 ? (
                  <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setStack((s) => s.slice(0, -1))}>
                    <ArrowLeft />
                    {rc.back}
                  </Button>
                ) : null}
                <SheetTitle>{rc.title(copy.sheets.kindsSingular[top.kind] ?? rc.kinds[top.kind] ?? top.kind)}</SheetTitle>
                <SheetDescription>{rc.hint}</SheetDescription>
              </SheetHeader>
              <div key={`${top.kind}/${top.id}`} className="flex flex-col gap-8 p-4">
                {top.kind === "Goal" ? (
                  <GoalEditor id={top.id} fix={top.fix} embedded />
                ) : (
                  <DefinitionStoreProvider kind={top.kind} id={top.id} blank={BLANK[top.kind] as () => never}>
                    {SECTIONS[top.kind].map(({ key, heading, View }) => (
                      <section key={key} id={`drawer-${key}`} className="flex flex-col gap-3" aria-label={heading}>
                        <h3 className="text-base font-semibold tracking-tight">{heading}</h3>
                        <View />
                      </section>
                    ))}
                  </DefinitionStoreProvider>
                )}
              </div>
              <div className="sticky bottom-0 flex justify-end border-t bg-background/95 p-3 backdrop-blur">
                <Button type="button" onClick={() => setStack((s) => s.slice(0, -1))}>
                  <Check />
                  {stack.length > 1 ? rc.doneBack : rc.done}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </DrawerContext.Provider>
  );
}

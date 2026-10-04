import { useMemo, useState } from "react";

import { ChipPicker, type ChipItem } from "@/components/ChipPicker";
import { copy } from "@/copy";
import { SheetAddDialog } from "@/surfaces/sheet/InlineSheetAdd";
import { Suggested } from "@/components/relevance";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { useSectionAutosave, useProjectStore } from "../store";

const bc = copy.projects.beneficiaries;

/**
 * Who this project is for.
 *
 * Qualitative, by the Programme Lead's rule of 2026-09-26: a beneficiary
 * is a group of people the problem is later targeted at, so the step
 * identifies groups and counts nothing. The count, its basis and its
 * "why it is not known yet" reason are gone from the contract, and with
 * them the three-column grid, the progress bar and the paragraph that
 * tried to explain what a beneficiary was.
 *
 * What is left is the register as chips. A group the register does not
 * hold is added through the same dialog the directory uses.
 */
export function BeneficiariesSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const { data: groups } = useReferenceOptions("BeneficiaryGroup");
  const [addOpen, setAddOpen] = useState(false);

  const picked = (store.spec.summary.beneficiaries ?? []).map((b) => b.group).filter(Boolean);

  const chips = useMemo<ChipItem[]>(
    () => (groups?.options ?? []).map((o) => ({ id: o.value, label: o.label })),
    [groups],
  );

  function toggle(groupId: string) {
    store.updateSpec((s) => {
      const current = s.summary.beneficiaries ?? [];
      const next = current.some((b) => b.group === groupId)
        ? current.filter((b) => b.group !== groupId)
        : [...current, { group: groupId }];
      return { ...s, summary: { ...s.summary, beneficiaries: next } };
    });
  }

  return (
    <>
      <Suggested kind="BeneficiaryGroup" selected={picked} onPick={toggle} />
      <ChipPicker
        slot="beneficiary-chips"
        data-cartograph-field="/spec/summary/beneficiaries"
        items={chips}
        selected={picked}
        onToggle={toggle}
        placeholder={bc.searchPlaceholder}
        addLabel={bc.add}
        onAdd={() => setAddOpen(true)}
        empty={bc.empty}
      />
      <SheetAddDialog
        kind="BeneficiaryGroup"
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={(id) => toggle(id)}
      />
    </>
  );
}

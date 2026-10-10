import { ShieldCheck } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { copy } from "@/copy";
import { DefinitionStoreProvider, useDefinitionStore } from "@/definition/store";

/** The workspace's change-control policy, as Settings holds it (engine
 * docs/adr/0024): whether every change goes through a change set, and what
 * a change set needs before it is rolled in. */
interface RollIn {
  checksMet?: boolean;
  nothingLeftOpen?: boolean;
  secondReviewer?: boolean;
}
interface SettingsSpec {
  changeControl?: { changeSetsRequired?: boolean; rollIn?: RollIn };
  [field: string]: unknown;
}

type Policy = "changeSetsRequired" | keyof RollIn;
const policies: Policy[] = ["changeSetsRequired", "checksMet", "nothingLeftOpen", "secondReviewer"];

/** The policy, edited like any record: in the person's change set, and in
 * force once it is rolled in. */
export function ChangeControl() {
  return (
    <DefinitionStoreProvider<SettingsSpec> kind="Settings" id="default" blank={() => ({})}>
      <Policies />
    </DefinitionStoreProvider>
  );
}

function Policies() {
  const store = useDefinitionStore<SettingsSpec>();
  const cc = store.spec.changeControl ?? {};
  const on = (p: Policy) => (p === "changeSetsRequired" ? !!cc.changeSetsRequired : !!cc.rollIn?.[p]);
  const set = (p: Policy, value: boolean) =>
    store.updateSpec((spec) => {
      const now = spec.changeControl ?? {};
      if (p === "changeSetsRequired") return { ...spec, changeControl: { ...now, changeSetsRequired: value } };
      return { ...spec, changeControl: { ...now, rollIn: { ...now.rollIn, [p]: value } } };
    });
  const words = copy.access.changeControl;
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-labelledby="change-control-title" data-cartograph-region="change-control">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
        <h2 id="change-control-title" className="text-sm font-semibold">
          {words.title}
        </h2>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">{words.intro}</p>
      {store.loadError ? <p className="text-sm text-destructive">{words.loadFailed}</p> : null}
      <ul className="space-y-3">
        {policies.map((p) => (
          <li key={p} className="flex items-start gap-3">
            <Checkbox
              id={`policy-${p}`}
              checked={on(p)}
              disabled={!store.loaded}
              onCheckedChange={(v) => set(p, v === true)}
              aria-describedby={`policy-${p}-does`}
            />
            <div className="grid gap-0.5">
              <Label htmlFor={`policy-${p}`}>{words.policy[p].name}</Label>
              <span id={`policy-${p}-does`} className="text-xs text-muted-foreground">
                {words.policy[p].does}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {store.staged ? words.staged : words.inForce}
      </p>
    </section>
  );
}

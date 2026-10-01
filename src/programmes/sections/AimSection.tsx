import { Input } from "@/components/ui/input";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { AimEditor } from "../AimStatement";
import type { ProgrammeSpec } from "../types";

const pc = copy.programmes;

/** What the programme is for, in its own words and the plan's. */
export function AimSection() {
  useSectionAutosave();
  const store = useDefinitionStore<ProgrammeSpec>();
  const spec = store.spec;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <FieldHeading label={pc.nameLabel} htmlFor="programme-name" />
        <Input
          id="programme-name"
          value={spec.name ?? store.name}
          onChange={(e) => {
            const v = e.target.value.slice(0, 160);
            store.setName(v);
            store.updateSpec((s) => ({ ...s, name: v }));
          }}
          placeholder={pc.namePlaceholder}
          maxLength={160}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldHeading label={copy.alias.label} hint={copy.alias.hint} htmlFor="programme-alias" />
        <Input
          id="programme-alias"
          value={store.alias}
          onChange={(e) => store.setAlias(e.target.value.slice(0, 80))}
          placeholder={copy.alias.placeholder}
          maxLength={80}
          className="max-w-sm font-mono text-xs"
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldHeading label={pc.aimLabel} hint={pc.aimHint} />
        <AimEditor
          value={spec.aim}
          onChange={(next) => store.updateSpec((s) => ({ ...s, aim: next }))}
        />
        {spec.aim?.change && !spec.aim?.gain ? (
          <p className="text-xs text-muted-foreground text-pretty">{pc.aimQuoted}</p>
        ) : null}
      </div>


      <div className="flex flex-col gap-2">
        <FieldHeading label={pc.sourceLabel} htmlFor="programme-source" />
        <Input
          id="programme-source"
          value={spec.source ?? ""}
          onChange={(e) => store.updateSpec((s) => ({ ...s, source: e.target.value.slice(0, 160) || undefined }))}
          placeholder={pc.sourcePlaceholder}
          maxLength={160}
        />
      </div>
    </div>
  );
}

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy, plusNoun } from "@/copy";
import { NameRoleDialog } from "./NameRoleDialog";
import { RoleRefPicker, roleOptions, type RoleOption, useResourceNames } from "./RoleRefPicker";
import { useProjectStore } from "./store";
import type { Deliverable, Ref, Task } from "./types";
import { seg } from "./field";

const dc = copy.projects.deliverables;

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * One task: the work, then the role that does it where one is known. A
 * top-level component, so its input keeps focus between keystrokes.
 */
function TaskRow({
  task,
  code,
  field,
  options,
  onUpdate,
  onRemove,
  onAddRole,
}: {
  task: Task;
  /** The task's place in the work breakdown, as the charter prints it. */
  code: string;
  /** The task's own pointer. */
  field: string;
  options: RoleOption[];
  onUpdate: (patch: Partial<Task>) => void;
  onRemove: () => void;
  onAddRole: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 shrink-0 items-center justify-center rounded-md bg-muted px-1 text-[11px] tabular-nums text-muted-foreground">
        {code}
      </span>
      <Input
        data-cartograph-field={`${field}/name`}
        value={task.name}
        onChange={(e) => onUpdate({ name: e.target.value.slice(0, 120) })}
        aria-label={`${dc.taskNameLabel} ${code}`}
        maxLength={120}
        className="min-w-0 flex-1"
      />
      <RoleRefPicker
        data-cartograph-field={`${field}/role`}
        value={task.role}
        options={options}
        onChange={(role) => onUpdate({ role })}
        onAddRole={onAddRole}
        label={dc.taskRoleLabel}
        placeholder={dc.taskRoleLabel}
        className="w-44 shrink-0"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        onClick={onRemove}
        aria-label={copy.projects.common.remove}
      >
        <X />
      </Button>
    </div>
  );
}

/**
 * The tasks that produce one deliverable: a loose list, added in place,
 * with no order and no dates (TAXONOMY.md D38). Numbered D1.1, D1.2 as
 * the charter's work breakdown numbers them. No check asks for tasks.
 */
export function TaskEditor({ index }: { index: number }) {
  const store = useProjectStore();
  const deliverables = store.spec.deliverables ?? [];
  const resourceName = useResourceNames();
  const options = roleOptions(store.spec.resources ?? [], resourceName);
  const tasks = deliverables[index]?.tasks ?? [];
  const [addRoleFor, setAddRoleFor] = useState<number | null>(null);

  function update(patch: Partial<Deliverable>) {
    store.updateSpec((s) => {
      const next = [...(s.deliverables ?? [])];
      next[index] = { ...next[index], ...patch };
      return { ...s, deliverables: next };
    });
  }

  function setTasks(next: Task[]) {
    update({ tasks: next.length > 0 ? next : undefined });
  }

  function selectNamed(role: Ref) {
    const taskIndex = addRoleFor;
    if (taskIndex === null) return;
    setTasks(tasks.map((t, ti) => (ti === taskIndex ? { ...t, role } : t)));
    setAddRoleFor(null);
  }

  return (
    <div className="flex flex-col gap-2" data-cartograph-region={`tasks-${index}`}>
      {tasks.map((t, tIdx) => (
        <TaskRow
          key={t.id}
          task={t}
          code={`D${index + 1}.${tIdx + 1}`}
          field={`/spec/deliverables/${seg(deliverables[index], index)}/tasks/${seg(t, tIdx)}`}
          options={options}
          onUpdate={(patch) => setTasks(tasks.map((x, i) => (i === tIdx ? { ...x, ...patch } : x)))}
          onRemove={() => setTasks(tasks.filter((_, i) => i !== tIdx))}
          onAddRole={() => setAddRoleFor(tIdx)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start border-dashed"
        onClick={() => setTasks([...tasks, { id: `t-${randomSuffix()}`, name: "" }])}
        title={dc.addTask}
        aria-label={dc.addTask}
      >
        <Plus />
        {plusNoun(dc.addTaskShort)}
      </Button>
      <NameRoleDialog
        open={addRoleFor !== null}
        onOpenChange={(o) => !o && setAddRoleFor(null)}
        onNamed={selectNamed}
      />
    </div>
  );
}

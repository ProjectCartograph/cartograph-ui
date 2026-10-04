import { createFileRoute } from "@tanstack/react-router";

import { WriteGate } from "@/access/WriteGate";
import { copy } from "@/copy";
import { Sheet } from "@/surfaces/sheet/Sheet";
import { isSheetKind } from "@/surfaces/sheet/schema";
import { UnappliedBar } from "@/surfaces/sheet/Unapplied";

export const Route = createFileRoute("/sheets/$kind")({
  component: SheetPage,
  // From the home page: open a new entry with the name (engine docs/adr/0023).
  validateSearch: (search: Record<string, unknown>): { add?: string; name?: string } => ({
    ...(search.add ? { add: "1" } : {}),
    ...(typeof search.name === "string" && search.name ? { name: search.name } : {}),
  }),
});

function SheetPage() {
  const { kind } = Route.useParams();
  const { add, name } = Route.useSearch();

  if (!isSheetKind(kind)) {
    return <p className="text-muted-foreground">{copy.sheets.kindNotASheet}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Before the table, because a table that is missing rows is worse
          than a table that says so. */}
      <UnappliedBar kind={kind} />
      <WriteGate kind={kind}>
        <Sheet key={kind} kind={kind} adding={!!add} initialName={name} />
      </WriteGate>
    </div>
  );
}

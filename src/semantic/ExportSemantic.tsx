import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { useClient } from "@/client/context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/copy";

const mc = copy.kpis.metric;

/**
 * Exports the KPIs as dbt's semantic layer (engine TAXONOMY.md D57): the
 * file downloads to drop into a dbt project, and what the record leaves to
 * the analytics engineer is listed. Absent when the deployment has the
 * export off.
 */
export function ExportSemantic() {
  const client = useClient();
  const [notes, setNotes] = useState<string[]>([]);
  const exp = useMutation({
    mutationFn: () => client.semanticLayer("dbt"),
    onSuccess: (out) => {
      if (!out) return;
      for (const f of out.files) {
        const url = URL.createObjectURL(new Blob([f.content], { type: "text/yaml" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = f.path.split("/").pop() ?? "cartograph.yml";
        a.click();
        URL.revokeObjectURL(url);
      }
      setNotes(out.notes);
    },
  });
  return (
    <>
      <Button type="button" variant="outline" onClick={() => exp.mutate()} disabled={exp.isPending} aria-label={mc.exportLabel} title={mc.exportLabel} data-cartograph-action="export-semantic">
        <Download />
        {mc.export}
      </Button>
      <Dialog open={notes.length > 0} onOpenChange={(open) => !open && setNotes([])}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mc.exportLabel}</DialogTitle>
            <DialogDescription>{mc.exportNotes}</DialogDescription>
          </DialogHeader>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

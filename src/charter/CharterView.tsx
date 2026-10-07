import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Printer } from "lucide-react";
import { useRef } from "react";

import { useClient } from "@/client/context";
import type { CharterKind } from "@/client/port";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy";

const cc = copy.charter;

/**
 * The definition as the document it adds up to.
 *
 * The record page shows a line per step, which answers "what is in this
 * definition" and not "what does this definition say". A reader who wants
 * the second one wants prose, in order, with nothing folded away
 * (Programme Lead, 2026-09-29).
 *
 * The document is rendered by the server, not here: the charter already
 * existed as HTML for the handoff pack, and one definition of it is what
 * keeps the screen, the export and the pack saying the same thing. It is
 * shown in an iframe so the charter's own stylesheet cannot reach the
 * interface around it, and printing prints the document rather than the
 * page it sits in.
 */
export function CharterView({
  kind,
  id,
  working = false,
  fileName,
  empty,
  editable,
}: {
  kind: CharterKind;
  id: string;
  /** Render the working copy rather than the last version. */
  working?: boolean;
  fileName?: string;
  empty: string;
  /** Beside a walk: a section opens its step, and a value written as one
   * field is edited in place. */
  editable?: { onStep: (step: string) => void; onField: (path: string, value: string) => void };
}) {
  const client = useClient();
  const frame = useRef<HTMLIFrameElement>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["charter", kind, id, working],
    queryFn: () => client.charter(kind, id, { working }),
  });
  const url = client.charterLink(kind, id, "html", { working });
  // The same charter printed to PDF by the server.
  const pdfUrl = client.charterLink(kind, id, "pdf", { working });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !data) return <p className="text-sm text-muted-foreground">{empty}</p>;

  return (
    <div className="flex flex-col gap-3" data-cartograph-region="charter">
      <div className="flex justify-end gap-2">
        {pdfUrl ? (
          <Button asChild size="sm">
            <a href={pdfUrl} download={`${fileName ?? "charter"}.pdf`}>
              <Download />
              {cc.pdf}
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink />
            {cc.openTab}
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => frame.current?.contentWindow?.print()}
        >
          <Printer />
          {cc.print}
        </Button>
      </div>
      <iframe
        ref={frame}
        title={cc.title}
        srcDoc={data}
        // Its own document, so the charter's styles stay inside it. No
        // scripts to run: the server writes prose and tables.
        sandbox="allow-same-origin allow-modals"
        onLoad={() => editable && frame.current?.contentDocument && wire(frame.current.contentDocument, editable)}
        className="h-[calc(100vh-16rem)] w-full rounded-xl border bg-background"
      />
    </div>
  );
}

/**
 * Makes the charter's document answer the walk beside it: each section
 * heading opens the step that defines it, and each value printed as one
 * field's text is edited where it stands, saved as any edit is. Wired from
 * outside the frame, which runs no scripts of its own.
 */
function wire(doc: Document, editable: { onStep: (step: string) => void; onField: (path: string, value: string) => void }) {
  const style = doc.createElement("style");
  style.textContent = `
    h2[data-step] { cursor: pointer; border-radius: 6px; }
    h2[data-step]:hover { background: color-mix(in oklab, currentColor 6%, transparent); }
    dd[data-field] { cursor: text; border-radius: 4px; outline: 1px dashed transparent; outline-offset: 2px; }
    dd[data-field]:hover { outline-color: color-mix(in oklab, currentColor 30%, transparent); }
    dd[data-field][contenteditable="true"] { outline: 2px solid #3b82f6; background: color-mix(in oklab, #3b82f6 6%, transparent); }
  `;
  doc.head.appendChild(style);
  for (const h of Array.from(doc.querySelectorAll<HTMLElement>("h2[data-step]"))) {
    h.title = cc.openStep;
    h.addEventListener("click", () => editable.onStep(h.dataset.step as string));
  }
  for (const dd of Array.from(doc.querySelectorAll<HTMLElement>("dd[data-field]"))) {
    dd.title = cc.editHere;
    dd.addEventListener("click", () => {
      if (dd.isContentEditable) return;
      const before = dd.textContent ?? "";
      dd.contentEditable = "true";
      dd.focus();
      const done = () => {
        dd.contentEditable = "false";
        const after = (dd.textContent ?? "").trim();
        if (after && after !== before.trim()) editable.onField(dd.dataset.field as string, after);
      };
      dd.addEventListener("blur", done, { once: true });
      dd.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          dd.blur();
        }
        if (e.key === "Escape") {
          dd.textContent = before;
          dd.blur();
        }
      });
    });
  }
}

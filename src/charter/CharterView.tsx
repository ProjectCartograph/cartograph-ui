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
  live,
}: {
  kind: CharterKind;
  id: string;
  /** Render the working copy rather than the last version. */
  working?: boolean;
  fileName?: string;
  empty: string;
  /** The charter as a document of parts, drawn in place of the frame
   * (LiveCharter); the PDF and the tab still print the same renderer. */
  live?: React.ReactNode;
}) {
  const client = useClient();
  const frame = useRef<HTMLIFrameElement>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["charter", kind, id, working],
    queryFn: () => client.charter(kind, id, { working }),
    enabled: !live,
  });
  const url = client.charterLink(kind, id, "html", { working });
  // The same charter printed to PDF by the server.
  const pdfUrl = client.charterLink(kind, id, "pdf", { working });

  if (live) {
    // The parts in place of the frame; the tab prints the renderer's HTML.
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
        </div>
        {live}
      </div>
    );
  }
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
        className="h-[calc(100vh-16rem)] w-full rounded-xl border bg-background"
      />
    </div>
  );
}

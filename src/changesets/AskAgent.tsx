import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Check, Copy, Plug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";

const c = copy.askAgent;

/**
 * Hands a change set to the person's agent (engine docs/adr/0025): the
 * request to paste names it, so the agent works in it beside them, meets
 * its checks, asks what only they can answer, and leaves merging to them.
 */
export function AskAgent({ set, title }: { set: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const request = c.request(title, set);
  return (
    <Popover onOpenChange={() => setCopied(false)}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={c.label} title={c.label} data-cartograph-action="ask-agent">
          <Bot />
          {c.button}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-80 flex-col gap-3" align="end">
        <PopoverHeader>
          <PopoverTitle>{c.title}</PopoverTitle>
          <PopoverDescription>{c.how}</PopoverDescription>
        </PopoverHeader>
        <Textarea readOnly value={request} rows={4} aria-label={c.requestLabel} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/agents" aria-label={c.connectLabel} title={c.connectLabel}>
              <Plug />
              {c.connect}
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            aria-label={c.copyLabel}
            title={c.copyLabel}
            onClick={() => {
              void navigator.clipboard?.writeText(request).then(
                () => setCopied(true),
                () => undefined,
              );
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? c.copied : c.copy}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

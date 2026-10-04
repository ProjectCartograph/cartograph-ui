import { BookOpen } from "lucide-react";

import type { GlossaryEntry } from "@/client/port";
import { entryFor, termOf, useGlossary } from "@/components/glossary";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { copy } from "@/copy";

const gc = copy.glossary;

/** The definition and its example, as the glossary and every "?" show it. */
export function Definition({ entry, headword }: { entry: GlossaryEntry; headword?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5" data-glossary-entry={entry.key}>
      {headword ? <p className="font-medium">{termOf(entry.key)}</p> : null}
      <p className="text-pretty">{entry.summary}</p>
      {entry.example ? (
        <p className="text-pretty text-muted-foreground">
          <span className="font-medium">{gc.example}: </span>
          {entry.example}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What a word means, behind a mark beside it, where the word is
 * introduced: the word, one plain sentence and an example, as Google and
 * Notion put a definition beside a term. Nothing is rendered until the
 * glossary has the word.
 */
export function Term({ word }: { word: string }) {
  const glossary = useGlossary();
  const entry = entryFor(glossary.data, word);
  if (!entry) return null;
  const name = termOf(word);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-5 text-muted-foreground hover:text-foreground"
          aria-label={gc.whatIs(name)}
          title={gc.whatIs(name)}
          data-slot="term-help"
        >
          <BookOpen className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-sm">
        <Definition entry={entry} headword />
      </PopoverContent>
    </Popover>
  );
}

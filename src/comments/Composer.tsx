import { useQuery } from "@tanstack/react-query";
import { AtSign, Send, Users, X } from "lucide-react";
import { useRef, useState } from "react";

import { useClient } from "@/client/context";
import type { Mention, Mentionable } from "@/client/port";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";

const cc = copy.comments;

/** The "@word" being typed just before the caret, if any. */
function typingMention(text: string, caret: number): { at: number; q: string } | null {
  const m = /(^|\s)@([^\s@]{0,40})$/.exec(text.slice(0, caret));
  return m ? { at: caret - m[2].length - 1, q: m[2] } : null;
}

/**
 * Writing a comment, with @ to ask someone: typing @ lists the people on
 * the access list and the teams whose names hold what follows, and
 * choosing one writes their name and asks them. A mention is kept as who
 * it is, not as the words, so a renamed team is still asked; one whose
 * name is taken out of the text is no longer asked.
 */
export function Composer({ label, onSend, busy, autoFocus }: { label: string; onSend: (body: string, mentions: Mention[]) => Promise<unknown>; busy?: boolean; autoFocus?: boolean }) {
  const client = useClient();
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [asked, setAsked] = useState<Mentionable[]>([]);
  const [typing, setTyping] = useState<{ at: number; q: string } | null>(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);
  const found = useQuery({
    queryKey: ["mentionables", typing?.q ?? ""],
    queryFn: () => client.mentionables(typing?.q ?? ""),
    enabled: typing !== null,
    staleTime: 30_000,
  });
  const options = (found.data ?? []).slice(0, 8);

  function read(el: HTMLTextAreaElement) {
    setText(el.value);
    const t = typingMention(el.value, el.selectionStart ?? el.value.length);
    setTyping(t);
    setActive(0);
  }
  function choose(m: Mentionable) {
    if (!typing) return;
    const before = text.slice(0, typing.at);
    const after = text.slice(typing.at + 1 + typing.q.length);
    const next = `${before}@${m.name} ${after.replace(/^\s/, "")}`;
    setText(next);
    setAsked((a) => (a.some((x) => x.kind === m.kind && x.id === m.id) ? a : [...a, m]));
    setTyping(null);
    requestAnimationFrame(() => {
      const caret = before.length + m.name.length + 2;
      box.current?.focus();
      box.current?.setSelectionRange(caret, caret);
    });
  }
  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    // Only who is still named in the words is asked.
    const mentions = asked.filter((m) => body.includes(`@${m.name}`)).map((m) => ({ kind: m.kind, id: m.id }));
    setFailed(false);
    try {
      await onSend(body, mentions);
      setText("");
      setAsked([]);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-1.5" data-slot="comment-composer">
      <div className="relative">
        <Textarea
          ref={box}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => read(e.target)}
          onClick={(e) => read(e.currentTarget)}
          onKeyDown={(e) => {
            if (typing && options.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % options.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(options[active]); return; }
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setTyping(null); return; }
            }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); }
          }}
          aria-label={label}
          rows={2}
          maxLength={4000}
          className="min-h-16 rounded-none text-sm"
        />
        {typing ? (
          <ul role="listbox" aria-label={cc.asks} className="mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-sm" data-slot="mention-list">
            {options.length === 0 ? <li className="px-2 py-1.5 text-muted-foreground">{found.isLoading ? "" : cc.noOne}</li> : null}
            {options.map((m, i) => (
              <li
                key={`${m.kind}:${m.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(m);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-default items-center gap-2 rounded px-2 py-1.5 ${i === active ? "bg-accent" : ""}`}
              >
                {m.kind === "team" ? <Users className="size-3.5 text-muted-foreground" aria-hidden /> : <AtSign className="size-3.5 text-muted-foreground" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.kind === "team" ? cc.team : cc.person}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {asked.filter((m) => text.includes(`@${m.name}`)).map((m) => (
          <span key={`${m.kind}:${m.id}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs" data-slot="mention-chip">
            {m.kind === "team" ? <Users className="size-3" aria-hidden /> : <AtSign className="size-3" aria-hidden />}
            {m.name}
            <button type="button" className="rounded-full hover:text-foreground" aria-label={cc.removeMention(m.name)} title={cc.removeMention(m.name)} onClick={() => setAsked((a) => a.filter((x) => x !== m))}>
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <Button type="button" size="sm" className="ml-auto" onClick={() => void send()} disabled={!text.trim() || busy} title={cc.sendTitle} aria-label={cc.sendTitle}>
          <Send />
          {cc.send}
        </Button>
      </div>
      {failed ? <p className="text-xs text-destructive">{cc.failed}</p> : null}
    </div>
  );
}

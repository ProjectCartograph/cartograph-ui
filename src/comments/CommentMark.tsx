import { Check, MessageSquare, MessageSquareText, Reply, RotateCcw } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/access/access";
import type { Comment } from "@/client/port";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { copy } from "@/copy";
import { Composer } from "./Composer";
import { threadsAt, useComments, type Thread } from "./useComments";

const cc = copy.comments;
const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Who wrote a comment, in words: "You", their name as the engine gives
 * it, their address. */
function useAuthorName(): (c: Comment) => string {
  const { data: session } = useSession();
  const me = (session as { email?: string; actor?: string } | undefined)?.email ?? (session as { actor?: string } | undefined)?.actor;
  return (c) => {
    // Where nobody signs in, every comment is the one operator's.
    if (!c.author) return session && !(session as { access?: unknown }).access ? cc.you : cc.someone;
    if (c.author === me) return cc.you;
    return c.authorName ?? c.author;
  };
}

/**
 * The comments on one part of a record, beside it (engine TAXONOMY.md
 * D72): a mark that says how many threads are open there and opens them,
 * each with its replies, a way to answer and to resolve it, and a box to
 * start another. The conversation is not the record: nothing here is
 * saved into it or held to its checks.
 */
export function CommentMark({ kind, id, anchor, what }: { kind: string; id: string; anchor: string; what: string }) {
  const { comments, available, add, resolve } = useComments(kind, id);
  const [showResolved, setShowResolved] = useState(false);
  const name = useAuthorName();
  if (!available || !id) return null;
  const threads = threadsAt(comments, anchor);
  const open = threads.filter((t) => !t.first.resolved);
  const closed = threads.filter((t) => t.first.resolved);
  const label = cc.markLabel(what, open.length);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={open.length > 0 ? "xs" : "icon-xs"}
          className={open.length > 0 ? "gap-1 text-foreground" : "text-muted-foreground opacity-60 hover:opacity-100 focus-visible:opacity-100"}
          aria-label={label}
          title={label}
          data-slot="comment-mark"
          data-anchor={anchor}
        >
          {open.length > 0 ? <MessageSquareText /> : <MessageSquare />}
          {cc.mark(open.length)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex max-h-[70svh] w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto" data-cartograph-region="comments">
        <p className="text-sm font-medium">{cc.heading(what)}</p>
        {open.length === 0 && closed.length === 0 ? <p className="text-sm text-muted-foreground">{cc.none}</p> : null}
        {open.map((t) => (
          <ThreadView key={t.first.id} thread={t} name={name} onReply={(body, mentions) => add.mutateAsync({ reply: t.first.id, body, mentions })} onResolve={(r) => resolve.mutate({ comment: t.first.id, resolved: r })} busy={add.isPending} />
        ))}
        {closed.length > 0 ? (
          <Button type="button" variant="link" size="sm" className="h-auto self-start p-0 text-xs" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? cc.hideResolved : cc.showResolved(closed.length)}
          </Button>
        ) : null}
        {showResolved
          ? closed.map((t) => (
              <ThreadView key={t.first.id} thread={t} name={name} onReply={(body, mentions) => add.mutateAsync({ reply: t.first.id, body, mentions })} onResolve={(r) => resolve.mutate({ comment: t.first.id, resolved: r })} busy={add.isPending} />
            ))
          : null}
        <Composer label={cc.writeLabel} autoFocus={threads.length === 0} busy={add.isPending} onSend={(body, mentions) => add.mutateAsync({ anchor, body, mentions })} />
      </PopoverContent>
    </Popover>
  );
}

function ThreadView({
  thread,
  name,
  onReply,
  onResolve,
  busy,
}: {
  thread: Thread;
  name: (c: Comment) => string;
  onReply: (body: string, mentions: { kind: "person" | "team"; id: string }[]) => Promise<unknown>;
  onResolve: (resolved: boolean) => void;
  busy: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const resolved = thread.first.resolved;
  return (
    <article className={`flex flex-col gap-2 rounded-lg border p-2.5 ${resolved ? "opacity-70" : ""}`} data-slot="comment-thread" data-resolved={resolved || undefined}>
      {[thread.first, ...thread.replies].map((c) => (
        <CommentView key={c.id} c={c} name={name} />
      ))}
      <div className="flex items-center gap-1">
        {!resolved ? (
          <Button type="button" variant="ghost" size="xs" onClick={() => setReplying((v) => !v)} aria-expanded={replying}>
            <Reply />
            {cc.reply}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{cc.resolved}</span>
        )}
        <Button type="button" variant="ghost" size="xs" className="ml-auto" onClick={() => onResolve(!resolved)} title={resolved ? cc.reopenTitle : cc.resolveTitle} aria-label={resolved ? cc.reopenTitle : cc.resolveTitle}>
          {resolved ? <RotateCcw /> : <Check />}
          {resolved ? cc.reopen : cc.resolve}
        </Button>
      </div>
      {replying ? (
        <Composer
          label={cc.replyLabel}
          autoFocus
          busy={busy}
          onSend={async (body, mentions) => {
            await onReply(body, mentions);
            setReplying(false);
          }}
        />
      ) : null}
    </article>
  );
}

/** The words of a comment, each party it asks shown as asked, by the name
 * the engine gives it now. */
function Body({ c }: { c: Comment }) {
  const names = c.mentions
    .map((m) => m.name)
    .filter((n): n is string => !!n)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return <>{c.body}</>;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = c.body.split(new RegExp(`(@(?:${escaped.join("|")}))`, "g"));
  return (
    <>
      {parts.map((p, i) =>
        names.some((n) => p === `@${n}`) ? (
          <span key={i} className="font-medium text-primary" data-slot="comment-mention">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

function CommentView({ c, name }: { c: Comment; name: (c: Comment) => string }) {
  return (
    <div className="flex flex-col gap-0.5" data-slot="comment">
      <div className="flex items-baseline gap-2 text-xs">
        <span className="font-medium">{name(c)}</span>
        <span className="text-muted-foreground">{when.format(new Date(c.at))}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap text-pretty">
        <Body c={c} />
      </p>
    </div>
  );
}

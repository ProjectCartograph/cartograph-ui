import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AtSign, MessageSquareText } from "lucide-react";
import { useEffect } from "react";

import { useManifestName } from "@/api/names";
import { useClient } from "@/client/context";
import type { Comment } from "@/client/port";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/copy";
import { mentionsSeen, whereOf } from "./where";

const mc = copy.mentions;
const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * What asks you (engine TAXONOMY.md D72): every comment that names you or
 * a team you are on, newest first, each opening where it was asked so it
 * is answered there.
 */
export function MentionsPage() {
  const client = useClient();
  const list = useQuery({ queryKey: ["mentions"], queryFn: () => client.myMentions(), refetchInterval: 30_000, retry: false });
  useEffect(() => {
    if (list.isSuccess) mentionsSeen.now();
  }, [list.isSuccess, list.dataUpdatedAt]);
  const mentions = list.data ?? [];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" data-cartograph-region="mentions">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <AtSign className="size-6 text-muted-foreground" aria-hidden="true" />
          {mc.title}
        </h1>
        <p className="text-muted-foreground">{mc.intro}</p>
      </div>
      {list.isSuccess && mentions.length === 0 ? <p className="text-sm text-muted-foreground">{mc.none}</p> : null}
      {list.isError ? <p className="text-sm text-muted-foreground">{copy.comments.unavailable}</p> : null}
      {mentions.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {mentions.map((c) => (
            <MentionRow key={c.id} c={c} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MentionRow({ c }: { c: Comment }) {
  const { data: name } = useManifestName(c.kind, c.manifest);
  const link = whereOf(c);
  return (
    <li data-cartograph-comment={c.id}>
      <Link to={link.to} params={link.params as never} className="flex min-w-0 items-start gap-3 p-3 hover:bg-accent">
        <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xs text-muted-foreground">{mc.on(copy.sheets.kindsSingular[c.kind] ?? c.kind, name ?? c.manifest)}</span>
          <span className="line-clamp-2 text-sm text-pretty">{c.body}</span>
          <span className="text-xs text-muted-foreground">
            {mc.by(c.authorName ?? (c.author || copy.comments.someone))} · {when.format(new Date(c.at))}
          </span>
        </span>
        {c.resolved ? (
          <Badge variant="outline" className="shrink-0 font-normal">
            {mc.resolved}
          </Badge>
        ) : null}
      </Link>
    </li>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import type { Comment, CommentDraft } from "@/client/port";

/** A thread: the comment that starts it and its replies, oldest first. */
export interface Thread {
  first: Comment;
  replies: Comment[];
}

/** The threads on one anchor, oldest first. */
export function threadsAt(comments: readonly Comment[], anchor: string): Thread[] {
  const roots = comments.filter((c) => !c.reply && c.anchor === anchor);
  return roots.map((first) => ({ first, replies: comments.filter((c) => c.reply === first.id) }));
}

/**
 * A record's comments (engine TAXONOMY.md D72), read again every little
 * while so another person's comment shows without a reload, with adding
 * and resolving. One query per record, shared by every mark on its page.
 */
export function useComments(kind: string, id: string) {
  const client = useClient();
  const queries = useQueryClient();
  const key = ["comments", kind, id];
  const list = useQuery({ queryKey: key, queryFn: () => client.comments(kind, id), enabled: !!id, refetchInterval: 15_000, retry: false });
  const refresh = () => queries.invalidateQueries({ queryKey: key });
  const add = useMutation({ mutationFn: (d: CommentDraft) => client.addComment(kind, id, d), onSuccess: refresh });
  const resolve = useMutation({ mutationFn: (v: { comment: string; resolved: boolean }) => client.resolveComment(v.comment, v.resolved), onSuccess: refresh });
  return { comments: list.data ?? [], available: !list.isError, add, resolve };
}

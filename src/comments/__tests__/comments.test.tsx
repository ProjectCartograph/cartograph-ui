/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Comment, CommentDraft } from "@/client/port";
import { copy } from "@/copy";
import { CommentMark } from "../CommentMark";

const cc = copy.comments;

// A comment sits beside the part it is about, asks a person or a team
// with @, and its thread is answered and resolved there (engine D72).
describe("comments beside a section", () => {
  it("writes a comment that asks a team, answers it and resolves it", async () => {
    const user = userEvent.setup();
    const kept: Comment[] = [];
    const addComment = vi.fn(async (kind: string, id: string, d: CommentDraft) => {
      // The engine names each party asked, as it is now.
      const mentions = (d.mentions ?? []).map((m) => ({ ...m, name: m.id === "quality-team" ? "Quality team" : undefined }));
      const c = { id: `c${kept.length + 1}`, kind, manifest: id, anchor: d.anchor ?? "", reply: d.reply, body: d.body, mentions, author: "", at: "2026-10-12T10:00:00Z", resolved: false } as Comment;
      kept.push(c);
      return c;
    });
    const client = fakeClient({
      session: async () => ({ actor: "local", canWrite: true }) as never,
      comments: async () => [...kept],
      addComment,
      resolveComment: async (comment, resolved) => {
        const c = kept.find((x) => x.id === comment)!;
        c.resolved = resolved;
        return c;
      },
      mentionables: async (q) => [{ kind: "team" as const, id: "quality-team", name: "Quality team" }].filter((m) => m.name.toLowerCase().includes(q.toLowerCase())),
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <CommentMark kind="Project" id="p1" anchor="section:scope" what="Scope" />
        </QueryClientProvider>
      </ClientProvider>,
    );
    await user.click(await screen.findByRole("button", { name: cc.markLabel("Scope", 0) }));
    const box = await screen.findByRole("textbox", { name: cc.writeLabel });
    await user.type(box, "Is the pilot in scope? @qual");
    await user.click(await screen.findByRole("option", { name: /Quality team/ }));
    expect(box).toHaveValue("Is the pilot in scope? @Quality team ");
    await user.click(screen.getByRole("button", { name: cc.sendTitle }));
    await waitFor(() => expect(addComment).toHaveBeenCalled());
    expect(addComment.mock.calls[0][2]).toEqual({ anchor: "section:scope", body: "Is the pilot in scope? @Quality team", mentions: [{ kind: "team", id: "quality-team" }] });

    // The party asked reads as asked.
    const asked = await screen.findByText("@Quality team", { selector: "[data-slot=comment-mention]" });
    const article = asked.closest("article") as HTMLElement;
    await user.click(within(article).getByRole("button", { name: cc.reply }));
    await user.type(within(article).getByRole("textbox", { name: cc.replyLabel }), "Yes, the first depot.");
    await user.click(within(article).getByRole("button", { name: cc.sendTitle }));
    await waitFor(() => expect(addComment).toHaveBeenCalledTimes(2));
    expect(addComment.mock.calls[1][2]).toMatchObject({ reply: "c1", body: "Yes, the first depot." });
    expect(await screen.findByText("Yes, the first depot.")).toBeInTheDocument();
    expect(screen.getAllByText(cc.you).length).toBeGreaterThan(0);

    await user.click(within(article).getByRole("button", { name: cc.resolveTitle }));
    expect(await screen.findByRole("button", { name: cc.showResolved(1) })).toBeInTheDocument();
  });
});

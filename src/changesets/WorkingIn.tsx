import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye, EyeOff, GitBranch, GitPullRequest, LogOut, Pencil, Plus } from "lucide-react";

import { activeChangeSet } from "@/client/active";
import { useClient } from "@/client/context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";
import { useActiveChangeSet, useAsItIs } from "./useActive";

const c = copy.workingIn;

/**
 * Which change set every edit goes into (engine docs/adr/0024), in the
 * top bar like a branch: its name and how many records it changes, and a
 * menu to rename it, switch to another, review it, or stop working in it.
 * Switching reads every screen again, since each shows the workspace as
 * the active change set would leave it.
 */
export function WorkingIn() {
  const client = useClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const active = useActiveChangeSet();
  const asItIs = useAsItIs();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");

  const review = useQuery({
    queryKey: ["changeSet", active],
    queryFn: () => client.changeSet(active as string),
    enabled: Boolean(active),
    refetchInterval: 10_000,
  });
  const open = useQuery({
    queryKey: ["changeSets", "open"],
    queryFn: () => client.changeSets({ status: "open" }),
  });

  const switchTo = (id: string | undefined) => {
    activeChangeSet.set(id);
    void queryClient.invalidateQueries();
  };

  // A change set that was rolled in or closed elsewhere is no longer one
  // to work in.
  const status = review.data?.changeSet.status;
  useEffect(() => {
    if (active && status && status !== "open") {
      activeChangeSet.set(undefined);
      void queryClient.invalidateQueries();
    }
  }, [active, status, queryClient]);

  const rename = useMutation({
    mutationFn: (t: string) => client.retitleChangeSet(active as string, t),
    onSuccess: () => {
      setRenaming(false);
      void queryClient.invalidateQueries({ queryKey: ["changeSet", active] });
      void queryClient.invalidateQueries({ queryKey: ["changeSets"] });
    },
  });
  const start = useMutation({
    mutationFn: () => client.startChangeSet(c.startTitle),
    onSuccess: (cs) => {
      switchTo(cs.id);
      setTitle(cs.title);
      setRenaming(true);
    },
  });

  const others = (open.data ?? []).filter((cs) => cs.id !== active);
  const name = review.data?.changeSet.title;
  const count = review.data?.items.length ?? 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={active ? "secondary" : "ghost"}
            size="sm"
            className="max-w-72 shrink-0 gap-1.5"
            aria-label={c.menu}
            data-cartograph-region="working-in"
          >
            <GitPullRequest className="size-3.5 shrink-0" aria-hidden="true" />
            {/* On a phone the icon and the count say it; the name is in the menu. */}
            <span className="hidden truncate sm:inline">{active ? (name ?? c.label) : c.label}</span>
            {active ? <span className="shrink-0 text-xs text-muted-foreground">{c.items(count)}</span> : null}
            <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {active ? (
            <>
              <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => void navigate({ to: "/changesets/$id", params: { id: active } })}>
                <Eye />
                {c.review}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  activeChangeSet.setAsItIs(!asItIs);
                  void queryClient.invalidateQueries();
                }}
              >
                {asItIs ? <GitPullRequest /> : <EyeOff />}
                {asItIs ? c.asProposed : c.asItIs}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setTitle(name ?? "");
                  setRenaming(true);
                }}
              >
                <Pencil />
                {c.rename}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => switchTo(undefined)} title={c.leaveHint}>
                <LogOut />
                {c.leave}
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuLabel className="font-normal text-muted-foreground">{c.none}</DropdownMenuLabel>
          )}
          {others.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{c.switchTo}</DropdownMenuLabel>
              {others.map((cs) => (
                <DropdownMenuItem key={cs.id} onSelect={() => switchTo(cs.id)}>
                  <GitBranch />
                  <span className="truncate">{cs.title}</span>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => start.mutate()}>
            <Plus />
            {c.start}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{c.renameLabel}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) rename.mutate(title.trim());
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label={c.renameLabel} autoFocus />
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={!title.trim() || rename.isPending}>
                {c.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

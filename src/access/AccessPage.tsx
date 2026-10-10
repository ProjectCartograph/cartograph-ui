import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, UserCog } from "lucide-react";

import { useClient } from "@/client/context";
import type { Person, Role } from "@/client/port";
import { ClientError } from "@/client/port";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { copy, plusNoun } from "@/copy";

import { holds, roles, useSession } from "./access";
import { ChangeControl } from "./ChangeControl";

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** What a person holds: what an administrator granted and what their
 * directory groups gave, together. */
function held<T extends string>(granted: T[], directory: T[]): T[] {
  return [...new Set([...granted, ...directory])];
}

/**
 * The access list (docs/adr/0011 in cartograph-engine): who may sign in,
 * what roles they hold, and which teams they act for. Only an
 * administrator reaches it.
 */
export function AccessPage() {
  const client = useClient();
  const queries = useQueryClient();
  const { data: session } = useSession();
  const people = useQuery({ queryKey: ["people"], queryFn: () => client.people() });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => client.list("Team") });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ person?: Person } | undefined>(undefined);
  const [removing, setRemoving] = useState<Person | undefined>(undefined);

  const teamName = useMemo(() => new Map((teams.data ?? []).map((t) => [t.id, t.name])), [teams.data]);
  const shown = (people.data ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    return !q || p.email.includes(q) || p.name.toLowerCase().includes(q);
  });
  const me = session?.email;

  const remove = useMutation({
    mutationFn: (email: string) => client.removePerson(email),
    onSuccess: () => queries.invalidateQueries({ queryKey: ["people"] }),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5" data-cartograph-region="access">
      <div className="flex items-start justify-between gap-6">
        <p className="max-w-2xl text-sm text-muted-foreground">{copy.access.intro}</p>
        <Button onClick={() => setEditing({})} aria-label={copy.access.add}>
          <Plus />
          {plusNoun(copy.access.add)}
        </Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-8" aria-label={copy.access.search} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {people.isError ? (
        <p className="text-sm text-destructive">{copy.access.loadFailed}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.access.person}</TableHead>
                <TableHead>{copy.access.roles}</TableHead>
                <TableHead>{copy.access.teams}</TableHead>
                <TableHead>{copy.access.lastSignedIn}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p) => (
                <TableRow key={p.email} data-cartograph-region={`person:${p.email}`}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {p.name || p.email}
                      {p.email === me ? <Badge variant="outline">{copy.access.you}</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {held(p.roles, p.directoryRoles).map((r) => (
                        <Badge key={r} variant="secondary" title={p.roles.includes(r) ? undefined : copy.access.fromDirectory}>
                          {copy.access.role[r].name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-56">
                    <div className="flex flex-wrap gap-1">
                      {held(p.teams, p.directoryTeams).map((t) => (
                        <Badge key={t} variant="outline" title={p.teams.includes(t) ? undefined : copy.access.fromDirectory}>
                          {teamName.get(t) ?? t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.lastSignedIn ? day.format(new Date(p.lastSignedIn)) : copy.access.never}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={copy.access.edit(p.name || p.email)} onClick={() => setEditing({ person: p })}>
                        <UserCog />
                      </Button>
                      {p.email !== me ? (
                        <Button variant="ghost" size="icon" aria-label={copy.access.remove(p.name || p.email)} onClick={() => setRemoving(p)}>
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {holds(session, "administrator") ? <ChangeControl /> : null}
      {editing ? (
        <PersonDialog
          person={editing.person}
          teams={teams.data ?? []}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.access.removeTitle(removing?.name || removing?.email || "")}</AlertDialogTitle>
            <AlertDialogDescription>{copy.access.removeBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.access.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) remove.mutate(removing.email);
                setRemoving(undefined);
              }}
            >
              {copy.access.removeConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Adding a person, or changing what an administrator grants one. What
 * their directory groups give is shown, and changes only in the
 * directory. */
function PersonDialog({
  person,
  teams,
  onClose,
}: {
  person?: Person;
  teams: { id: string; name: string }[];
  onClose: () => void;
}) {
  const client = useClient();
  const queries = useQueryClient();
  const [email, setEmail] = useState(person?.email ?? "");
  const [chosenRoles, setChosenRoles] = useState<Role[]>(person?.roles ?? []);
  const [chosenTeams, setChosenTeams] = useState<string[]>(person?.teams ?? []);
  const [agentsOff, setAgentsOff] = useState<boolean>(person?.agentsOff ?? false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const save = useMutation({
    mutationFn: () => client.grantPerson(email.trim(), { roles: chosenRoles, teams: chosenTeams, agentsOff }),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ["people"] });
      void queries.invalidateQueries({ queryKey: ["session"] });
      onClose();
    },
    onError: (e) => setProblem(e instanceof ClientError && e.problems[0] ? e.problems[0].message : copy.access.saveFailed),
  });
  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" data-cartograph-region="access-person">
        <DialogHeader>
          <DialogTitle>{person ? copy.access.accessFor(person.name || person.email) : copy.access.add}</DialogTitle>
          <DialogDescription>{person ? person.email : copy.access.addHint}</DialogDescription>
        </DialogHeader>
        {person ? null : (
          <div className="space-y-1.5">
            <Label htmlFor="access-email">{copy.access.email}</Label>
            <Input id="access-email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} data-cartograph-field="/email" />
          </div>
        )}
        <div className="space-y-2">
          {roles.map((r) => {
            const fromDirectory = !!person?.directoryRoles.includes(r);
            return (
              <label key={r} className="flex cursor-pointer gap-3 rounded-lg border p-3" data-cartograph-field={`/roles/${r}`}>
                <Checkbox
                  checked={chosenRoles.includes(r) || fromDirectory}
                  disabled={fromDirectory}
                  onCheckedChange={(on) => setChosenRoles(toggle(chosenRoles, r, on === true))}
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">
                    {copy.access.role[r].name}
                    {fromDirectory ? <span className="ml-2 text-xs font-normal text-muted-foreground">{copy.access.fromDirectory}</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{copy.access.role[r].does}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <div className="text-sm font-medium">{copy.access.teams}</div>
          <p className="text-xs text-muted-foreground">{copy.access.teamsHint}</p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
            {sortedTeams.length === 0 ? <p className="p-1 text-xs text-muted-foreground">{copy.access.noTeams}</p> : null}
            {sortedTeams.map((t) => {
              const fromDirectory = !!person?.directoryTeams.includes(t.id);
              return (
                <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted" data-cartograph-field={`/teams/${t.id}`}>
                  <Checkbox
                    checked={chosenTeams.includes(t.id) || fromDirectory}
                    disabled={fromDirectory}
                    onCheckedChange={(on) => setChosenTeams(toggle(chosenTeams, t.id, on === true))}
                  />
                  {t.name}
                  {fromDirectory ? <span className="text-xs text-muted-foreground">{copy.access.fromDirectory}</span> : null}
                </label>
              );
            })}
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm" data-cartograph-field="/agentsOff">
          <Checkbox className="mt-0.5" checked={!agentsOff} onCheckedChange={(on) => setAgentsOff(on !== true)} />
          <span>
            {copy.access.agents}
            <span className="block text-xs text-muted-foreground">{copy.access.agentsHint}</span>
          </span>
        </label>
        {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {copy.access.cancel}
          </Button>
          <Button disabled={save.isPending || (!person && !email.includes("@"))} onClick={() => save.mutate()}>
            {copy.access.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// One project store per open project: the working copy is loaded once
// (draft, falling back to the current version), every section reads and
// writes the same in-memory manifest, and saving is debounced 800ms after
// the last edit and flushed immediately on every navigation away from a
// section (each section calls useSectionAutosave, below, whose cleanup
// effect flushes on unmount) and before any client-side route change (see
// the useBlocker call below). No screen ever holds state the store does
// not; switching screens re-renders from the store, never from a
// component's own state.
//
// Since 2026-09-28 the store carries a second manifest as well: the
// StakeholderMap bound to this project, which holds how much power each
// stakeholder has over it. That is a fact about the link, so it lives on
// neither the project nor the Resource catalogue -- but it is edited on
// the project's Resources step, so it has to share the project's draft.
// One debounce, one flush chain, one save indicator, one discard: a map
// saving on its own cadence would sit outside "Discard draft" and quietly
// survive it. The map is created lazily, by the first flush that has
// something to score, so a vault does not fill with empty maps for
// projects nobody assessed.
//
// The project's own working copy is a real server-side draft
// (X-Cartograph-Draft: true; see cartograph/HANDOFF-I0.md's I3a section). I3.2 (the
// delta on top of the goals-as-root card) removed RoleBinding from the
// interface entirely: the People and resources section is now an ordinary
// part of the project's own spec (spec.resources), so it saves through
// this exact same rhythm as every other section -- no second working
// copy, no RoleBinding draft, no carried-along commit. It also removed the
// actor concept: every write here carries the literal actor "local"
// (lib/actor.ts), never asked of the person using the interface.
//
// Since 2.0 both manifests are edited on their shared drafts where they have
// one (docs/adr/0007): an edit is a change to the fields it touched, synced
// at once, and other people's edits arrive as they make them. A map nobody
// has scored has no draft yet, so it keeps the working copy until its first
// save creates one; so does any manifest the engine has no draft for.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { stringify as stringifyYAML } from "yaml";

import { aliasAfterRename } from "@/alias";
import { useClient } from "@/client/context";
import {
  ClientError,
  Refused,
  orUndefined,
  type Client,
  type FieldConflict,
  type SharedDraft,
} from "@/client/port";
import { openDraft, partsOf, useDraftSubscription } from "@/collab/draft";
import { settled } from "@/definition/store";
import {
  blankProjectSpec,
  type ProjectManifest,
  type ProjectSpec,
  type StakeholderMapSpec,
} from "./types";

/** The map bound to a project, by the convention the corpus already uses
 * (examples/minimal/StakeholderMap/quality-check-rollout-stakeholders.yaml).
 * Derived rather than looked up: the store needs an id to write to before
 * the manifest exists. */
function stakeholderMapID(projectID: string): string {
  return `${projectID}-stakeholders`;
}

function blankStakeholderMap(projectID: string): StakeholderMapSpec {
  return { scope: { kind: "Project", id: projectID }, entries: [] };
}

/** A manifest with no entries is one nobody has scored. It is never
 * written, so a project whose stakeholders were never assessed leaves no
 * empty manifest behind in the vault. */
function mapIsEmpty(spec: StakeholderMapSpec): boolean {
  return (spec.entries ?? []).length === 0;
}

interface RevertedManifest {
  number: number;
  manifest?: { metadata?: { name?: string }; spec?: unknown };
}

/**
 * Throws one manifest's draft away and returns whatever the vault holds.
 *
 * Discard first cleared the dirty flag and re-read, which discarded nothing:
 * a read answers with the draft when there is one, so it came straight back
 * (Programme Lead, 2026-09-28). The fix then was to overwrite the draft with
 * the last version's text, because nothing on the server removed a draft --
 * the draft *was* the file.
 *
 * Drafts are staged now, so there is a real answer: delete the draft, and
 * read back the file the vault has been holding all along, untouched. A
 * manifest that was never saved has nothing to hold, so the caller falls
 * back to a blank -- which is the honest result rather than a version that
 * does not exist.
 */
async function discardWorkingCopy(client: Client, kind: string, id: string): Promise<RevertedManifest | null> {
  await orUndefined(client.discardWorking(kind, id));
  const read = await orUndefined(client.get(kind, id));
  if (!read) return null;
  const view = read as unknown as RevertedManifest;
  return { number: view.number ?? 0, manifest: view.manifest };
}

export type SaveState = "idle" | "saving" | "saved" | "unsaved" | "error";

export interface Problem {
  path: string;
  message: string;
}

export type SaveVersionResult = { ok: true } | { ok: false; conflict?: boolean; problems: Problem[] };
/** What a refused write answers: the problems on their fields when the
 * engine named them (422), none otherwise. A transport failure is not an
 * answer, and still throws. */
function refusedProblems(e: unknown): Problem[] {
  if (e instanceof Refused) return e.problems;
  if (e instanceof ClientError) return [];
  throw e;
}

export type HandoffResult = { ok: true; snapshot: number; bundle: string } | { ok: false; problems: Problem[] };

const DEBOUNCE_MS = 800;

interface ProjectStoreApi {
  id: string;
  loaded: boolean;
  loadError: boolean;
  name: string;
  setName: (v: string) => void;
  /** metadata.alias: the short reference people quote this by, which
   * follows the name until somebody changes it (see @/alias). */
  alias: string;
  setAlias: (v: string) => void;
  spec: ProjectSpec;
  updateSpec: (updater: (spec: ProjectSpec) => ProjectSpec) => void;
  /** The StakeholderMap bound to this project. Always present to read;
   * only written to the server once something is scored. */
  mapSpec: StakeholderMapSpec;
  updateMap: (updater: (spec: StakeholderMapSpec) => StakeholderMapSpec) => void;
  version: number;
  saveState: SaveState;
  flushNow: () => Promise<void>;
  saveVersion: (reason: string) => Promise<SaveVersionResult>;
  handoff: () => Promise<HandoffResult>;
  discardDraft: () => Promise<void>;
  /** Fields two people set at once in the project's shared draft. */
  conflicts: FieldConflict[];
  /** Settles a conflict on the value given. */
  resolveConflict: (path: string, value: unknown) => void;
}

const ProjectStoreContext = createContext<ProjectStoreApi | null>(null);

export function useProjectStore(): ProjectStoreApi {
  const ctx = useContext(ProjectStoreContext);
  if (!ctx) throw new Error("useProjectStore must be used inside a ProjectStoreProvider");
  return ctx;
}

/**
 * Every section calls this once. Its cleanup effect flushes any pending
 * debounced save immediately when the section unmounts, i.e. on every
 * navigation away from a section, per the card's own save rhythm.
 */
export function useSectionAutosave() {
  const { flushNow } = useProjectStore();
  useEffect(() => {
    return () => {
      void flushNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function ProjectStoreProvider({ id, children }: { id: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const client = useClient();

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [name, setNameState] = useState("");
  const [alias, setAliasState] = useState("");
  const [spec, setSpec] = useState<ProjectSpec>(blankProjectSpec());
  const [mapSpec, setMapSpec] = useState<StakeholderMapSpec>(() => blankStakeholderMap(id));
  const [version, setVersion] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const specDirty = useRef(false);
  const mapDirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A mirror of spec/name, updated synchronously alongside their setState
  // calls (never lagging a render behind). flushNow and saveVersion read
  // these, not the state variables directly: a useCallback-memoized
  // flushNow that instead closed over the spec/name *state values* would
  // capture whichever version was current when scheduleSave() last
  // rescheduled the timer, which is one render behind the edit that
  // triggered that very reschedule (setSpec and scheduleSave both run
  // synchronously in the same handler, before React re-renders) -- the
  // debounced save would then always silently drop the most recent edit
  // in a section unless a further, unrelated edit happened to "carry it
  // forward" through a later flush. Refs sidestep this: they are mutated
  // at the same point as the state update, so they are always current
  // regardless of which render's closure flushNow happens to be.
  const specRef = useRef(spec);
  const nameRef = useRef(name);
  const aliasRef = useRef(alias);
  // The same ref discipline as specRef, for the same reason: a debounced
  // flush must read the edit that scheduled it, not the render before it.
  const mapSpecRef = useRef(mapSpec);
  // The last committed version number, shown in the header ("version N")
  // and used to pick "Draft, unsaved as a version" (0) vs a real version.
  const versionRef = useRef(0);
  // Every flush (debounced, on-navigation, or the useBlocker guard below)
  // runs through this chain so two flushes never have their PUTs in
  // flight at once: each call is queued after whichever is currently
  // running, so an edit made in a brand-new section immediately after
  // navigating away from a previous one can never have its PUT's response
  // overtake and be overwritten by the previous section's own, still
  // in-flight, flush.
  const flushChain = useRef<Promise<void>>(Promise.resolve());

  // The shared drafts, once open: the project's and, where it has one, its
  // map's. Read through refs by every edit, as the specs are.
  const [draft, setDraft] = useState<SharedDraft | undefined>(undefined);
  const draftRef = useRef<SharedDraft | undefined>(undefined);
  const [mapDraft, setMapDraft] = useState<SharedDraft | undefined>(undefined);
  const mapDraftRef = useRef<SharedDraft | undefined>(undefined);

  const hydrate = useCallback((doc: Record<string, unknown>) => {
    const read = partsOf<ProjectSpec>(doc, blankProjectSpec);
    setSpec(read.spec);
    specRef.current = read.spec;
    setNameState(read.name);
    nameRef.current = read.name;
    setAliasState(read.alias);
    aliasRef.current = read.alias;
  }, []);

  const hydrateMap = useCallback(
    (doc: Record<string, unknown>) => {
      const next = (doc.spec as StakeholderMapSpec | undefined) ?? blankStakeholderMap(id);
      setMapSpec(next);
      mapSpecRef.current = next;
    },
    [id],
  );

  const project = useDraftSubscription(draft, hydrate);
  const map = useDraftSubscription(mapDraft, hydrateMap);
  // One list of notes for the step: the map's fields (its entries) are
  // edited on the project's own screens.
  const conflicts = [...project.conflicts, ...map.conflicts];
  const resolveConflict = useCallback(
    (path: string, value: unknown) =>
      (map.conflicts.some((c) => c.path === path) ? map.resolve : project.resolve)(path, value),
    [map, project],
  );

  // Initial hydration: load the current committed version.
  useEffect(() => {
    let cancelled = false;
    const opened: SharedDraft[] = [];
    async function load() {
      setLoaded(false);
      setLoadError(false);
      try {
        let loadedSpec: ProjectSpec | undefined;
        let loadedName = "";
        let loadedAlias = "";
        let loadedVersion = 0;

        const [manifest, shared, sharedMap] = await Promise.all([
          orUndefined(client.get("Project", id)).catch(() => undefined),
          openDraft(client, "Project", id),
          openDraft(client, "StakeholderMap", stakeholderMapID(id)),
        ]);
        for (const d of [shared, sharedMap]) if (d) opened.push(d);
        if (cancelled) {
          for (const d of opened) d.release();
          return;
        }
        if (shared) {
          const read = partsOf<ProjectSpec>(shared.doc(), blankProjectSpec);
          loadedSpec = read.spec;
          loadedName = read.name;
          loadedAlias = read.alias;
          loadedVersion = (manifest as unknown as { version?: { number: number } } | undefined)?.version?.number ?? 0;
          draftRef.current = shared;
          setDraft(shared);
        } else if (manifest) {
          const view = manifest as unknown as { version: { number: number }; manifest: ProjectManifest };
          loadedSpec = view.manifest.spec ?? blankProjectSpec();
          loadedName = view.manifest.metadata?.name ?? "";
          loadedAlias = view.manifest.metadata?.alias ?? "";
          loadedVersion = view.version.number;
        }

        if (cancelled) return;
        if (!loadedSpec) {
          setLoadError(true);
          setLoaded(true);
          return;
        }
        setSpec(loadedSpec);
        specRef.current = loadedSpec;
        setNameState(loadedName);
        nameRef.current = loadedName;
        setAliasState(loadedAlias);
        aliasRef.current = loadedAlias;
        setVersion(loadedVersion);
        versionRef.current = loadedVersion;

        // The map is optional: most projects have never been scored, and a
        // 404 here is that ordinary state, not a failure to load the
        // project. Its absence leaves the blank one already in state.
        if (sharedMap) {
          hydrateMap(sharedMap.doc());
          mapDraftRef.current = sharedMap;
          setMapDraft(sharedMap);
          if (!cancelled) setLoaded(true);
          return;
        }
        const map = await orUndefined(client.get("StakeholderMap", stakeholderMapID(id)));
        if (cancelled) return;
        if (map) {
          const mapView = map as unknown as {
            manifest?: { spec?: StakeholderMapSpec };
          };
          const loadedMap = mapView.manifest?.spec;
          if (loadedMap?.scope) {
            setMapSpec(loadedMap);
            mapSpecRef.current = loadedMap;
          }
        }

        if (!cancelled) setLoaded(true);
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setLoaded(true);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
      for (const d of opened) d.release();
      draftRef.current = undefined;
      mapDraftRef.current = undefined;
      setDraft(undefined);
      setMapDraft(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The actual flush body; always invoked through flushNow's own chain
  // (below), never directly, so two flushes never race each other's PUTs.
  const flushOnce = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!specDirty.current && !mapDirty.current) return;
    setSaveState("saving");
    try {
      // Both PUTs happen inside this one chain link, so "at most one
      // working-copy write in flight" stays true across the pair. The map
      // goes first: it is the smaller write, and if it is refused the
      // project has not been touched yet.
      if (mapDirty.current) {
        // mapSpecRef, not the mapSpec state: same stale-closure reason as
        // specRef, which the refs' own comment sets out above.
        const mapBody = {
          apiVersion: "cartograph/v1",
          kind: "StakeholderMap",
          metadata: { id: stakeholderMapID(id), name: `${nameRef.current.trim() || id} stakeholders` },
          spec: mapSpecRef.current,
        };
        await client.saveWorking("StakeholderMap", stakeholderMapID(id), stringifyYAML(mapBody));
        mapDirty.current = false;
      }
      if (specDirty.current) {
        // specRef/nameRef, not the spec/name state variables: see the refs'
        // own doc comment above for why (avoids a stale closure silently
        // dropping the most recent edit).
        const body: ProjectManifest = {
          apiVersion: "cartograph/v1",
          kind: "Project",
          metadata: {
            id,
            name: nameRef.current.trim() || id,
            ...(aliasRef.current.trim() ? { alias: aliasRef.current.trim() } : {}),
          },
          spec: specRef.current,
        };
        await client.saveWorking("Project", id, stringifyYAML(body));
        specDirty.current = false;
      }
      queryClient.invalidateQueries({ queryKey: ["project-checks", id] });
      queryClient.invalidateQueries({ queryKey: ["project-proposed-criteria", id] });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [id, queryClient, client]);

  /** Every caller (the 800ms debounce, a section's own unmount, the
   * beforeunload handler and the router's own useBlocker guard below) goes
   * through this: chained after whatever flush is already in flight, so
   * awaiting it always means "every edit made up to the moment this was
   * called has reached the server", never "started reaching the server". */
  const flushNow = useCallback((): Promise<void> => {
    const next = flushChain.current.then(flushOnce, flushOnce);
    flushChain.current = next;
    return next;
  }, [flushOnce]);

  const scheduleSave = useCallback(() => {
    setSaveState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flushNow();
    }, DEBOUNCE_MS);
  }, [flushNow]);

  /** One edit to the project's shared draft. Nothing to debounce: the
   * change is kept on this device and synced as it is made. */
  const share = useCallback((target: SharedDraft, edit: Parameters<SharedDraft["change"]>[0]) => {
    target.change(edit);
    setSaveState("saved");
  }, []);

  const updateSpec = useCallback(
    (updater: (s: ProjectSpec) => ProjectSpec) => {
      // From the ref: a remote edit lands there at once, and the updater
      // must build on it.
      const next = updater(specRef.current);
      specRef.current = next;
      setSpec(next);
      if (draftRef.current) {
        share(draftRef.current, (e) => e.set("/spec", next));
        return;
      }
      specDirty.current = true;
      scheduleSave();
    },
    [scheduleSave, share],
  );

  /** Scores a stakeholder. Rides the project's own debounce and flush
   * chain, so one edit anywhere in the step produces one "Saved". */
  const updateMap = useCallback(
    (updater: (m: StakeholderMapSpec) => StakeholderMapSpec) => {
      const next = updater(mapSpecRef.current);
      mapSpecRef.current = next;
      setMapSpec(next);
      if (mapDraftRef.current) {
        share(mapDraftRef.current, (e) => e.set("/spec", next));
        return;
      }
      mapDirty.current = true;
      scheduleSave();
    },
    [scheduleSave, share],
  );

  const setAlias = useCallback(
    (v: string) => {
      setAliasState(v);
      aliasRef.current = v;
      if (draftRef.current) {
        share(draftRef.current, (e) => e.set("/metadata/alias", v));
        return;
      }
      specDirty.current = true;
      scheduleSave();
    },
    [scheduleSave, share],
  );

  const setName = useCallback(
    (v: string) => {
      // The alias follows the name until somebody changes it, which is
      // what makes it a default rather than a second thing to maintain.
      const nextAlias = aliasAfterRename(aliasRef.current, nameRef.current, v);
      const aliasMoved = nextAlias !== aliasRef.current;
      if (aliasMoved) {
        setAliasState(nextAlias);
        aliasRef.current = nextAlias;
      }
      setNameState(v);
      nameRef.current = v;
      if (draftRef.current) {
        share(draftRef.current, (e) => {
          e.set("/metadata/name", v);
          if (aliasMoved) e.set("/metadata/alias", nextAlias);
        });
        return;
      }
      specDirty.current = true;
      scheduleSave();
    },
    [scheduleSave, share],
  );

  const saveVersion = useCallback(
    async (reason: string): Promise<SaveVersionResult> => {
      // Two snapshots cannot be atomic, so the order is chosen to fail
      // safely: the map goes first, and if it is refused nothing has been
      // versioned yet. The reverse would leave a versioned project whose
      // map is not. A map nobody has scored is skipped entirely rather
      // than versioned empty.
      await flushNow();
      // Always a snapshot: it is what starts a project's lifecycle (its
      // first "defined" state), which a plain versioned write does not. On
      // a shared draft the document as this screen holds it goes first as
      // the working copy, which the engine folds into the draft as one
      // change (nothing, when already synced), so the snapshot carries
      // edits that have not reached the engine yet.
      const version = async (kind: string, ref: string, shared: SharedDraft | undefined) => {
        if (shared) await client.saveWorking(kind, ref, stringifyYAML(shared.doc()));
        return client.snapshot(kind, ref, reason);
      };
      if (!mapIsEmpty(mapSpecRef.current)) {
        try {
          await version("StakeholderMap", stakeholderMapID(id), mapDraftRef.current);
        } catch (e) {
          return { ok: false, problems: refusedProblems(e) };
        }
      }
      let data;
      try {
        data = await version("Project", id, draftRef.current);
      } catch (e) {
        return { ok: false, problems: refusedProblems(e) };
      }
      specDirty.current = false;
      if (data?.number) {
        setVersion(data.number);
        versionRef.current = data.number;
      }
      setSaveState("saved");

      queryClient.invalidateQueries({ queryKey: ["project-manifest", id] });
      queryClient.invalidateQueries({ queryKey: ["project-checks", id] });
      queryClient.invalidateQueries({ queryKey: ["project-proposed-criteria", id] });
      queryClient.invalidateQueries({ queryKey: ["project-state", id] });
      queryClient.invalidateQueries({ queryKey: ["project-versions", id] });
      return { ok: true };
    },
    [id, queryClient, flushNow, client],
  );

  const handoff = useCallback(
    async (): Promise<HandoffResult> => {
      let data;
      try {
        data = await client.transition(id, "handed off");
      } catch (e) {
        return { ok: false, problems: refusedProblems(e) };
      }
      queryClient.invalidateQueries({ queryKey: ["project-state", id] });
      const history = data?.history ?? [];
      if (history.length > 0) {
        const lastEntry = history[history.length - 1];
        return { ok: true, snapshot: lastEntry.snapshot ?? 0, bundle: lastEntry.bundle ?? "" };
      }
      return { ok: true, snapshot: 0, bundle: "" };
    },
    [id, queryClient, client],
  );

  const discardDraft = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    specDirty.current = false;
    mapDirty.current = false;

    const [project, map] = await Promise.all([
      discardWorkingCopy(client, "Project", id),
      discardWorkingCopy(client, "StakeholderMap", stakeholderMapID(id)),
    ]);
    // The engine resets a shared draft for everyone; what it has not sent
    // yet is brought back here, so the draft reads as the vault does.
    for (const [shared, read] of [
      [draftRef.current, project],
      [mapDraftRef.current, map],
    ] as const) {
      if (!shared) continue;
      await settled(shared);
      if (read?.manifest) shared.change((e) => e.set("", read.manifest as Record<string, unknown>));
    }

    const nextSpec = (project?.manifest?.spec as ProjectSpec | undefined) ?? blankProjectSpec();
    const nextName = project?.manifest?.metadata?.name ?? "";
    setSpec(nextSpec);
    specRef.current = nextSpec;
    setNameState(nextName);
    nameRef.current = nextName;
    setVersion(project?.number ?? 0);
    versionRef.current = project?.number ?? 0;

    const nextMap = (map?.manifest?.spec as StakeholderMapSpec | undefined) ?? blankStakeholderMap(id);
    setMapSpec(nextMap);
    mapSpecRef.current = nextMap;

    setSaveState("saved");
    queryClient.invalidateQueries({ queryKey: ["project-manifest", id] });
    queryClient.invalidateQueries({ queryKey: ["project-checks", id] });
    queryClient.invalidateQueries({ queryKey: ["project-proposed-criteria", id] });
  }, [id, queryClient, client]);

  // Ask once before leaving the app entirely with unsaved changes.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (saveState === "unsaved" || saveState === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  // Flush on final unmount too (leaving the project subtree entirely),
  // belt and suspenders alongside each section's own useSectionAutosave.
  useEffect(() => {
    return () => {
      void flushNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every client-side route change inside this project (Back/Next, a rail
  // link, a check's "Fix" link, the breadcrumb, a browser back/forward)
  // flushes any pending debounced save first and awaits it before the
  // navigation actually proceeds: shouldBlockFn's own promise return is
  // exactly "wait for this, then decide", so returning false here after
  // the await means "never actually block, just never leave before the
  // save has landed" -- the literal "flushes it first (await), never
  // drops it" the card asks for. flushNow is idempotent when nothing is
  // dirty (flushOnce's own first check returns immediately), so this runs
  // on every navigation, not only ones known in advance to matter.
  useBlocker({
    shouldBlockFn: async () => {
      await flushNow();
      return false;
    },
    enableBeforeUnload: false,
  });

  const value: ProjectStoreApi = {
    id,
    loaded,
    loadError,
    name,
    setName,
    alias,
    setAlias,
    spec,
    updateSpec,
    mapSpec,
    updateMap,
    version,
    saveState,
    flushNow,
    saveVersion,
    handoff,
    discardDraft,
    conflicts,
    resolveConflict,
  };

  return <ProjectStoreContext.Provider value={value}>{children}</ProjectStoreContext.Provider>;
}

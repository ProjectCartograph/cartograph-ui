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
import { isCollection, parseDocument, parse as parseYAML, stringify as stringifyYAML } from "yaml";

import { useClient } from "@/client/context";
import {
  ClientError,
  Conflict,
  orUndefined,
  type FieldConflict,
  type ManifestDocument,
  type SharedDraft,
} from "@/client/port";
import { openDraft, partsOf, useDraftSubscription } from "@/collab/draft";
import { aliasAfterRename } from "@/alias";
import { copy } from "@/copy";

/**
 * One manifest, edited and autosaved — the same rhythm the project store
 * keeps, for the kinds that need nothing more.
 *
 * A project's store carries phases, a second manifest for its stakeholder
 * map, a handoff and a version history. A programme and an operation carry
 * none of that: one document, a few sections, saved as you go. Rather than
 * bend the project store around two shapes it does not have, this is the
 * plain case, and the invariants that matter are kept identically:
 *
 *   - Refs, not state values, are what a flush reads. A debounced save that
 *     closed over the `spec` state would capture the render before the edit
 *     that scheduled it and silently drop the most recent keystroke.
 *   - Flushes are serialised through one chain, so two PUTs are never in
 *     flight and a later response cannot be overtaken by an earlier one.
 *   - Autosave uses the working-copy path, never the validating PUT, so a
 *     half-finished definition is never refused mid-sentence.
 *
 * Where the manifest has a shared draft (docs/adr/0007) the store edits that
 * instead: each edit is one change to the fields it touched, applied at once
 * and synced, so there is nothing to debounce or flush, and other people's
 * edits arrive here as they make them. A manifest with no draft to open
 * keeps the working copy above.
 */

export type SaveState = "idle" | "saving" | "saved" | "unsaved" | "error";

const DEBOUNCE_MS = 800;

export interface DefinitionStoreApi<S> {
  id: string;
  kind: string;
  loaded: boolean;
  loadError: boolean;
  name: string;
  setName: (v: string) => void;
  /** metadata.alias: the short reference people quote this by. Follows
   * the name until somebody changes it (see @/alias). */
  alias: string;
  setAlias: (v: string) => void;
  /** metadata.labels: free-form key and value pairs for the cuts somebody
   * wants to make later. Held here beside the name because they belong to
   * the manifest rather than to its spec, and every kind has them. */
  labels: Record<string, string>;
  setLabels: (next: Record<string, string>) => void;
  spec: S;
  updateSpec: (updater: (spec: S) => S) => void;
  saveState: SaveState;
  flushNow: () => Promise<void>;
  /** Whether there is a staged draft, i.e. anything a save would promote
   * or a discard would throw away. */
  staged: boolean;
  /** Promote the draft into the vault. Returns the problems the server
   * refused it with, if any; an empty list means it saved. */
  save: () => Promise<{ ok: boolean; problems: { path?: string; message: string }[] }>;
  /** Throw the draft away and reload whatever the vault holds. */
  discardDraft: () => Promise<void>;
  /** Fields two people set at once in the shared draft. */
  conflicts: FieldConflict[];
  /** Settles a conflict on the value given. */
  resolveConflict: (path: string, value: unknown) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DefinitionStoreContext = createContext<DefinitionStoreApi<any> | null>(null);

/**
 * The spec and name out of a manifest read, from the file's own text.
 *
 * A read carries both the parsed manifest and the YAML it came from. The
 * parsed one has been through a Go map, which has no order, so it comes
 * back alphabetised — and writing that back reordered every key in the
 * file and turned a one-line edit into a whole-file diff. The text has the
 * order its author wrote (Programme Lead, 2026-09-29).
 */
interface Meta {
  name?: string;
  alias?: string;
  labels?: Record<string, string>;
}

function readManifest<S>(
  data: unknown,
  blank: () => S,
): { spec: S; name: string; alias: string; labels: Record<string, string>; yaml?: string } {
  const view = data as
    | { manifest?: { metadata?: Meta; spec?: S }; yaml?: string }
    | undefined;
  if (view?.yaml) {
    try {
      const doc = parseYAML(view.yaml) as { metadata?: Meta; spec?: S } | null;
      if (doc?.spec)
        return {
          spec: doc.spec,
          name: doc.metadata?.name ?? "",
          alias: doc.metadata?.alias ?? "",
          labels: doc.metadata?.labels ?? {},
          yaml: view.yaml,
        };
    } catch {
      // A file Cartograph cannot parse is one the server would have refused;
      // fall through to the parsed manifest rather than lose the read.
    }
  }
  return {
    spec: view?.manifest?.spec ?? blank(),
    name: view?.manifest?.metadata?.name ?? "",
    alias: view?.manifest?.metadata?.alias ?? "",
    labels: view?.manifest?.metadata?.labels ?? {},
  };
}

/** The interface writes YAML the way the vaults are written: two spaces,
 * and no wrapping, because a wrapped line is a diff nobody asked for. */
export function toYAML(doc: unknown): string {
  return stringifyYAML(doc, { indent: 2, lineWidth: 0 });
}

/** The metadata a save writes. An empty label map is left out rather
 * than written as `labels: {}`, so a file that never had labels keeps its
 * own shape. */
function metadataBody(
  id: string,
  name: string,
  alias: string,
  labels: Record<string, string>,
) {
  const base: Record<string, unknown> = { id, name: name.trim() || id };
  if (alias.trim()) base.alias = alias.trim();
  if (Object.keys(labels).length > 0) base.labels = labels;
  return base;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The manifest rewritten over the file it came from, touching only what
 * changed.
 *
 * Writing a whole document from a plain object loses everything the object
 * cannot carry: `[a, b]` becomes a block list, a quoted scalar loses its
 * quotes, a comment vanishes. None of that is an edit anybody made, and
 * all of it lands in the diff. So each key is compared against what the
 * file already says and only written when it differs — an edit to one
 * field then changes one line, which is what a save should do.
 *
 * Falls back to writing the whole document when there is no original to
 * merge into, which is every manifest being created for the first time.
 */
export function mergeIntoYAML(original: string | undefined, next: Record<string, unknown>): string {
  if (!original?.trim()) return toYAML(next);
  let doc;
  try {
    doc = parseDocument(original);
    if (doc.errors.length > 0) return toYAML(next);
  } catch {
    return toYAML(next);
  }

  for (const [section, value] of Object.entries(next)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      if (!sameValue(doc.get(section, false), value)) doc.set(section, value);
      continue;
    }
    // metadata and spec are compared key by key, so an untouched key keeps
    // the node it was written as.
    const current = doc.get(section, true);
    if (!isCollection(current)) {
      doc.set(section, value);
      continue;
    }
    const fields = value as Record<string, unknown>;
    for (const [key, v] of Object.entries(fields)) {
      if (v === undefined) {
        doc.deleteIn([section, key]);
        continue;
      }
      const held = doc.getIn([section, key], true);
      const asJSON = isCollection(held) || held === undefined ? doc.getIn([section, key]) : held;
      if (!sameValue(asJSON, v)) doc.setIn([section, key], v);
    }
    // A key the spec no longer has is a key somebody removed.
    for (const item of current.items as { key?: { value?: string } }[]) {
      const key = item?.key?.value;
      if (key !== undefined && !(key in fields)) doc.deleteIn([section, key]);
    }
  }
  // flowCollectionPadding writes [ a, b ]; every vault here writes
  // [a, b], and a space either side of every flow list is a diff nobody
  // asked for.
  return doc.toString({ indent: 2, lineWidth: 0, flowCollectionPadding: false });
}

/** Waits for the engine's own change to a draft after a write that makes
 * one, or a moment, whichever comes first. */
export function settled(draft: SharedDraft, ms = 1500): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    const stop = draft.subscribe((c) => {
      if (!c.local) done();
    });
    function done() {
      clearTimeout(timer);
      stop();
      resolve();
    }
  });
}

export function useDefinitionStore<S>(): DefinitionStoreApi<S> {
  const ctx = useContext(DefinitionStoreContext);
  if (!ctx) throw new Error("useDefinitionStore must be used inside a DefinitionStoreProvider");
  return ctx as DefinitionStoreApi<S>;
}

/** Every section calls this once; its cleanup flushes on unmount, so
 * navigating away from a section always lands what was typed in it. */
export function useSectionAutosave() {
  const { flushNow } = useDefinitionStore();

  useEffect(() => {
    return () => {
      void flushNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function DefinitionStoreProvider<S>({
  kind,
  id,
  blank,
  children,
}: {
  kind: string;
  id: string;
  blank: () => S;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const client = useClient();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [name, setNameState] = useState("");
  const [alias, setAliasState] = useState("");
  const [labels, setLabelsState] = useState<Record<string, string>>({});
  const [spec, setSpec] = useState<S>(blank);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const dirty = useRef(false);
  // A draft exists from the first autosave until a save or a discard. It
  // starts false rather than unknown: the load below reads the manifest,
  // which answers with the draft if there is one, and either way nothing is
  // promotable until somebody edits something.
  const [staged, setStaged] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const specRef = useRef(spec);
  const nameRef = useRef(name);
  const aliasRef = useRef(alias);
  const labelsRef = useRef(labels);
  const flushChain = useRef<Promise<void>>(Promise.resolve());
  // Held in a ref so discardDraft does not change identity whenever the
  // caller passes a fresh arrow function for `blank`.
  // The file's own text, as it was read. A save writes over this rather
  // than rewriting the document from the spec object.
  const originalYAML = useRef<string | undefined>(undefined);
  const blankRef = useRef(blank);
  blankRef.current = blank;
  // The shared draft, once open. Read through the ref by every edit, for
  // the same reason as specRef.
  const [draft, setDraft] = useState<SharedDraft | undefined>(undefined);
  const draftRef = useRef<SharedDraft | undefined>(undefined);

  /** Takes the manifest a draft holds into state. */
  const hydrate = useCallback((doc: ManifestDocument) => {
    const read = partsOf<S>(doc, blankRef.current);
    setSpec(read.spec);
    specRef.current = read.spec;
    setNameState(read.name);
    nameRef.current = read.name;
    setAliasState(read.alias);
    aliasRef.current = read.alias;
    setLabelsState(read.labels);
    labelsRef.current = read.labels;
  }, []);

  const { conflicts, resolve: resolveConflict } = useDraftSubscription(draft, (doc) => {
    hydrate(doc);
    setStaged(true);
  });

  useEffect(() => {
    let cancelled = false;
    let opened: SharedDraft | undefined;
    async function load() {
      setLoaded(false);
      setLoadError(false);
      try {
        const [view, shared] = await Promise.all([
          orUndefined(client.get(kind, id)).catch(() => undefined),
          openDraft(client, kind, id),
        ]);
        opened = shared;
        if (cancelled) {
          shared?.release();
          return;
        }
        if (shared) {
          // The draft is what everyone edits; the file's text is kept only
          // so a save writes over it in the author's order.
          originalYAML.current = readManifest<S>(view, blank).yaml;
          hydrate(shared.doc());
          draftRef.current = shared;
          setDraft(shared);
          setLoaded(true);
          return;
        }
        if (!view) {
          setLoadError(true);
          setLoaded(true);
          return;
        }
        const read = readManifest<S>(view, blank);
        const nextSpec = read.spec;
        const nextName = read.name;
        originalYAML.current = read.yaml;
        setSpec(nextSpec);
        specRef.current = nextSpec;
        setNameState(nextName);
        nameRef.current = nextName;
        setAliasState(read.alias);
        aliasRef.current = read.alias;
        setLabelsState(read.labels);
        labelsRef.current = read.labels;
        setLoaded(true);
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
      if (opened) {
        opened.release();
        if (draftRef.current === opened) draftRef.current = undefined;
        setDraft(undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  /** One edit to the shared draft, and what it means for the save. */
  const share = useCallback((edit: (e: Parameters<Parameters<SharedDraft["change"]>[0]>[0]) => void) => {
    draftRef.current?.change(edit);
    setStaged(true);
    setSaveState("saved");
  }, []);

  const flushOnce = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    setSaveState("saving");
    try {
      const body = {
        apiVersion: "cartograph/v1",
        kind,
        metadata: metadataBody(id, nameRef.current, aliasRef.current, labelsRef.current),
        spec: specRef.current,
      };
      await client.saveWorking(kind, id, mergeIntoYAML(originalYAML.current, body));
      dirty.current = false;
      setStaged(true);
      queryClient.invalidateQueries({ queryKey: ["manifests", kind] });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [kind, id, queryClient, client]);

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

  const updateSpec = useCallback(
    (updater: (s: S) => S) => {
      // From the ref, not the state's own previous value: a remote edit
      // lands in the ref at once, and the updater must build on it.
      const next = updater(specRef.current);
      specRef.current = next;
      setSpec(next);
      if (draftRef.current) {
        // The whole spec, written as what differs: the field typed in is
        // the one path that changes.
        share((e) => e.set("/spec", next));
        return;
      }
      dirty.current = true;
      scheduleSave();
    },
    [scheduleSave, share],
  );

  const setLabels = useCallback(
    (next: Record<string, string>) => {
      setLabelsState(next);
      labelsRef.current = next;
      if (draftRef.current) {
        share((e) => (Object.keys(next).length > 0 ? e.set("/metadata/labels", next) : e.remove("/metadata/labels")));
        return;
      }
      dirty.current = true;
      scheduleSave();
    },
    [scheduleSave, share],
  );

  const setAlias = useCallback(
    (v: string) => {
      setAliasState(v);
      aliasRef.current = v;
      if (draftRef.current) {
        share((e) => e.set("/metadata/alias", v));
        return;
      }
      dirty.current = true;
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
        share((e) => {
          e.set("/metadata/name", v);
          if (aliasMoved) e.set("/metadata/alias", nextAlias);
        });
        return;
      }
      dirty.current = true;
      scheduleSave();
    },
    [scheduleSave, share],
  );

  /**
   * The save: the command that promotes a staged draft into the vault's own
   * tree and its include list. Autosave stages, this commits — which is why
   * a programme or an operation needs this control at all, where before the
   * autosave *was* the save and there was no moment of deciding.
   *
   * The pending draft is flushed first, so a save never promotes a version
   * of the work older than what is on screen.
   */
  const save = useCallback(async () => {
    await flushNow();
    setSaveState("saving");
    // With a shared draft the version is the draft as everyone has it now,
    // materialised, rather than this screen's copy of it.
    const shared = draftRef.current?.doc();
    const body = {
      ...(shared ?? {}),
      apiVersion: "cartograph/v1",
      kind,
      metadata: {
        ...((shared?.metadata as Record<string, unknown> | undefined) ?? {}),
        ...metadataBody(id, nameRef.current, aliasRef.current, labelsRef.current),
      },
      spec: shared?.spec ?? specRef.current,
    };
    let refused: ClientError | undefined;
    try {
      // The text, not the object. A manifest sent as JSON is decoded into
      // a Go map on the way in and written back out sorted, which is what
      // reordered every key in a file on every save.
      await client.saveVersion(kind, id, mergeIntoYAML(originalYAML.current, body), "save");
    } catch (e) {
      if (!(e instanceof ClientError)) throw e;
      refused = e;
    }
    if (!refused) {
      setStaged(false);
      setSaveState("saved");
      queryClient.invalidateQueries({ queryKey: ["manifests", kind] });
      queryClient.invalidateQueries({ queryKey: ["programme-checks", id] });
      return { ok: true, problems: [] };
    }
    setSaveState("error");
    const problems: { path?: string; message: string }[] = refused.problems;
    if (refused instanceof Conflict) {
      return { ok: false, problems: [{ message: copy.definition.save.conflict }] };
    }
    return { ok: false, problems };
  }, [kind, id, flushNow, queryClient, client]);

  /**
   * Discard: throw the draft away and take back what the vault holds. This
   * only means something now that drafts are staged — before, the working
   * copy was the file and there was nothing to go back to.
   */
  const discardDraft = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    dirty.current = false;
    await orUndefined(client.discardWorking(kind, id));
    const view = await orUndefined(client.get(kind, id));
    const read = readManifest<S>(view, blankRef.current);
    const shared = draftRef.current;
    if (shared) {
      // The engine resets the draft for everyone; what it has not yet sent
      // is brought back here, field by field, so the draft reads as the
      // vault does whichever arrives first.
      await settled(shared);
      const manifest = (view as { manifest?: Record<string, unknown> } | undefined)?.manifest;
      if (manifest) shared.change((e) => e.set("", { ...manifest, spec: read.spec }));
      originalYAML.current = read.yaml;
      hydrate(shared.doc());
      setStaged(false);
      setSaveState("saved");
      queryClient.invalidateQueries({ queryKey: ["manifests", kind] });
      return;
    }
    const nextSpec = read.spec;
    const nextName = read.name;
    originalYAML.current = read.yaml;
    setSpec(nextSpec);
    specRef.current = nextSpec;
    setNameState(nextName);
    nameRef.current = nextName;
    setAliasState(read.alias);
    aliasRef.current = read.alias;
    setLabelsState(read.labels);
    labelsRef.current = read.labels;
    setStaged(false);
    setSaveState("saved");
    queryClient.invalidateQueries({ queryKey: ["manifests", kind] });
  }, [kind, id, queryClient, client, hydrate]);

  useEffect(() => {
    return () => {
      void flushNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useBlocker({
    shouldBlockFn: async () => {
      await flushNow();
      return false;
    },
    enableBeforeUnload: false,
  });

  const value: DefinitionStoreApi<S> = {
    id,
    kind,
    loaded,
    loadError,
    name,
    setName,
    alias,
    setAlias,
    labels,
    setLabels,
    spec,
    updateSpec,
    saveState,
    flushNow,
    staged,
    save,
    discardDraft,
    conflicts,
    resolveConflict,
  };
  return <DefinitionStoreContext.Provider value={value}>{children}</DefinitionStoreContext.Provider>;
}

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

import { client } from "@/api/client";
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoaded(false);
      setLoadError(false);
      try {
        const res = await client.GET("/manifests/{kind}/{id}", { params: { path: { kind, id } } });
        if (cancelled) return;
        if (res.error || !res.data) {
          setLoadError(true);
          setLoaded(true);
          return;
        }
        const read = readManifest<S>(res.data, blank);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

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
      const { error } = await client.PUT("/manifests/{kind}/{id}/working", {
        params: { path: { kind, id } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: { yaml: mergeIntoYAML(originalYAML.current, body) } as any,
      });
      if (error) throw new Error("working save failed");
      dirty.current = false;
      setStaged(true);
      queryClient.invalidateQueries({ queryKey: ["manifests", kind] });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [kind, id, queryClient]);

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
      setSpec((prev) => {
        const next = updater(prev);
        specRef.current = next;
        return next;
      });
      dirty.current = true;
      scheduleSave();
    },
    [scheduleSave],
  );

  const setLabels = useCallback(
    (next: Record<string, string>) => {
      setLabelsState(next);
      labelsRef.current = next;
      dirty.current = true;
      scheduleSave();
    },
    [scheduleSave],
  );

  const setAlias = useCallback(
    (v: string) => {
      setAliasState(v);
      aliasRef.current = v;
      dirty.current = true;
      scheduleSave();
    },
    [scheduleSave],
  );

  const setName = useCallback(
    (v: string) => {
      // The alias follows the name until somebody changes it, which is
      // what makes it a default rather than a second thing to maintain.
      const nextAlias = aliasAfterRename(aliasRef.current, nameRef.current, v);
      if (nextAlias !== aliasRef.current) {
        setAliasState(nextAlias);
        aliasRef.current = nextAlias;
      }
      setNameState(v);
      nameRef.current = v;
      dirty.current = true;
      scheduleSave();
    },
    [scheduleSave],
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
    const body = {
      apiVersion: "cartograph/v1",
      kind,
      metadata: metadataBody(id, nameRef.current, aliasRef.current, labelsRef.current),
      spec: specRef.current,
    };
    const { error, response } = await client.PUT("/manifests/{kind}/{id}", {
      params: { path: { kind, id } },
      // The text, not the object. A manifest sent as JSON is decoded into
      // a Go map on the way in and written back out sorted, which is what
      // reordered every key in a file on every save.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: { yaml: mergeIntoYAML(originalYAML.current, body), reason: "save" } as any,
    });
    if (!error) {
      setStaged(false);
      setSaveState("saved");
      queryClient.invalidateQueries({ queryKey: ["manifests", kind] });
      queryClient.invalidateQueries({ queryKey: ["programme-checks", id] });
      return { ok: true, problems: [] };
    }
    setSaveState("error");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const problems = ((error as any).problems ?? []) as { path?: string; message: string }[];
    if (response.status === 409) {
      return { ok: false, problems: [{ message: copy.definition.save.conflict }] };
    }
    return { ok: false, problems };
  }, [kind, id, flushNow, queryClient]);

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
    await client.DELETE("/manifests/{kind}/{id}/working", {
      params: { path: { kind, id } },
    });
    const res = await client.GET("/manifests/{kind}/{id}", { params: { path: { kind, id } } });
    const read = readManifest<S>(res.data, blankRef.current);
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
  }, [kind, id, queryClient]);

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
  };
  return <DefinitionStoreContext.Provider value={value}>{children}</DefinitionStoreContext.Provider>;
}

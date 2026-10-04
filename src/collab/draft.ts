// What a store needs to edit a manifest's shared draft rather than a
// working copy of its own: open it, hear the others' edits, keep the local
// caret still while they land, and know which fields two people set at once.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Client, FieldConflict, ManifestDocument, SharedDraft } from "@/client/port";
import { resolvePointer } from "@/client/pointer";
import { keepCaret, restoreCaret, type KeptCaret } from "./caret";

/** The draft, or undefined when there is none to open: a manifest not
 * saved yet, or an engine with nothing to say about it. A store with no
 * draft keeps its own working copy, as before. */
export async function openDraft(client: Client, kind: string, id: string): Promise<SharedDraft | undefined> {
  try {
    return await client.openDraft(kind, id);
  } catch {
    return undefined;
  }
}

/** The value at a pointer in a plain document. */
export function valueAt(doc: unknown, pointer: string): unknown {
  const path = resolvePointer(doc, pointer);
  if (!path) return undefined;
  let node: unknown = doc;
  for (const p of path) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string | number, unknown>)[p];
  }
  return node;
}

/** The manifest's metadata and spec, as a store holds them. */
/** A reference a person could not make yet, because what it names is not
 * defined yet: the field, the kind and the name of the record still to be
 * defined (metadata.pending; engine TAXONOMY.md D31). */
export interface Pending {
  path: string;
  kind: string;
  name: string;
  note?: string;
}

export function partsOf<S>(doc: ManifestDocument, blank: () => S) {
  const metadata = (doc.metadata ?? {}) as { name?: string; alias?: string; labels?: Record<string, string>; pending?: Pending[] };
  return {
    spec: (doc.spec as S | undefined) ?? blank(),
    name: metadata.name ?? "",
    alias: metadata.alias ?? "",
    labels: metadata.labels ?? {},
    pending: metadata.pending ?? [],
  };
}

/**
 * Listens to a draft for as long as it is given. `onRemote` hears every
 * change that was not this screen's own, with the document as it now
 * reads, and the focused field's selection is put back after React has
 * drawn the merged value.
 */
export function useDraftSubscription(
  draft: SharedDraft | undefined,
  onRemote: (doc: ManifestDocument) => void,
): { conflicts: FieldConflict[]; resolve: (path: string, value: unknown) => void } {
  // Bumped on every change; what the draft says is read from it, not copied.
  const [changes, setChanges] = useState(0);
  const [revision, setRevision] = useState(0);
  const kept = useRef<KeptCaret | undefined>(undefined);
  const remote = useRef(onRemote);
  useLayoutEffect(() => {
    remote.current = onRemote;
  });

  useEffect(() => {
    if (!draft) return;
    return draft.subscribe((change) => {
      if (!change.local) {
        const doc = draft.doc();
        kept.current = keepCaret(change, (path) => valueAt(doc, path));
        remote.current(doc);
        setRevision((r) => r + 1);
      }
      setChanges((n) => n + 1);
    });
  }, [draft]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const conflicts = useMemo(() => draft?.conflicts() ?? [], [draft, changes]);

  // After the children have drawn the merged value: a parent's layout
  // effect runs once every child below it has committed.
  useLayoutEffect(() => {
    restoreCaret(kept.current);
    kept.current = undefined;
  }, [revision]);

  const resolve = useCallback(
    (path: string, value: unknown) => {
      draft?.change((edit) => edit.replace(path, value));
    },
    [draft],
  );

  return { conflicts, resolve };
}

/** A manifest's shared draft as a screen holds it: the draft, the document
 * as it reads now (local and remote edits alike), and its conflicts. */
export interface SharedManifest {
  draft?: SharedDraft;
  doc?: ManifestDocument;
  conflicts: FieldConflict[];
  resolve: (path: string, value: unknown) => void;
}

/**
 * Opens a manifest's shared draft for as long as the screen is open. Until
 * it opens, and where there is none, `draft` is undefined and the screen
 * works on what it loaded, as before.
 */
export function useSharedManifest(client: Client, kind: string, id: string): SharedManifest {
  const [draft, setDraft] = useState<SharedDraft | undefined>(undefined);
  const [doc, setDoc] = useState<ManifestDocument | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let opened: SharedDraft | undefined;
    void openDraft(client, kind, id).then((d) => {
      opened = d;
      if (cancelled) {
        d?.release();
        return;
      }
      setDraft(d);
      setDoc(d?.doc());
    });
    return () => {
      cancelled = true;
      opened?.release();
      setDraft(undefined);
      setDoc(undefined);
    };
  }, [client, kind, id]);

  // This screen's own edits redraw it too; the remote ones come through
  // the subscription below, with the caret kept.
  useEffect(() => {
    if (!draft) return;
    return draft.subscribe((c) => {
      if (c.local) setDoc(draft.doc());
    });
  }, [draft]);

  const { conflicts, resolve } = useDraftSubscription(draft, setDoc);
  return { draft, doc, conflicts, resolve };
}

/**
 * useState for one field of a shared manifest: while the draft is open the
 * value is the draft's, and setting it is a change to that path; with no
 * draft it is ordinary local state.
 */
export function useDraftState<T>(
  shared: SharedManifest,
  path: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [local, setLocal] = useState<T>(initial);
  const held = shared.draft && shared.doc ? valueAt(shared.doc, path) : undefined;
  const value = shared.draft ? ((held as T | undefined) ?? initial) : local;
  // The value the last render showed, for a setter given a function.
  const current = useRef(value);
  useLayoutEffect(() => {
    current.current = value;
  });
  const draft = shared.draft;
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const v = typeof next === "function" ? (next as (prev: T) => T)(current.current) : next;
      current.current = v;
      if (draft) draft.change((e) => e.set(path, v));
      else setLocal(v);
    },
    [draft, path],
  );
  return [value, set];
}

// Presence on the screen in front of this person: joins the screen's
// document (the manifest's own, or the engine's presence document), says
// what this session is focused on, where its caret and pointer are, and
// hands the other sessions to whatever draws them.

import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import { useClient } from "@/client/context";
import type { Peer, PresenceChannel, PresenceScreen, SharedDraft } from "@/client/port";
import { openDraft } from "./draft";
import { useFollow } from "./follow";
import { PresenceContext, type PresenceApi } from "./presenceContext";
import { walkerOf } from "./walkers";

export type { PresenceApi };

/** Whether two sessions look at the same view: the same path, a trailing
 * slash aside. A session that has not said where it is is nowhere. */
export function sameView(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const trim = (s: string) => (s.length > 1 && s.endsWith("/") ? s.slice(0, -1) : s);
  return trim(a) === trim(b);
}

/** Hands a fixed presence to everything below it: for tests, and for any
 * screen that draws presence from somewhere other than the client. */
export function PresenceFeed({ value, children }: { value: PresenceApi; children?: ReactNode }) {
  return createElement(PresenceContext.Provider, { value }, children);
}

/**
 * Joins presence for `screen` and keeps it while the screen is open; a
 * new screen leaves the old document and joins the next. A client with no
 * presence to join leaves the screen exactly as it was.
 */
export function PresenceProvider({ screen, route, children }: { screen: PresenceScreen; route: string; children?: ReactNode }) {
  const client = useClient();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [draft, setDraft] = useState<SharedDraft | undefined>(undefined);
  const channel = useRef<PresenceChannel | undefined>(undefined);
  const routeRef = useRef(route);
  routeRef.current = route;
  const key = screen ? `${screen.kind}/${screen.id}` : "";

  useEffect(() => {
    let cancelled = false;
    let joined: PresenceChannel | undefined;
    let opened: SharedDraft | undefined;
    setPeers([]);
    void (async () => {
      try {
        joined = await client.joinPresence(screen);
      } catch {
        return;
      }
      if (cancelled) {
        joined.close();
        return;
      }
      channel.current = joined;
      joined.subscribe(setPeers);
      joined.publish({ route: routeRef.current });
      if (screen) {
        opened = await openDraft(client, screen.kind, screen.id);
        if (cancelled) opened?.release();
        else setDraft(opened);
      }
    })();
    return () => {
      cancelled = true;
      joined?.close();
      opened?.release();
      if (channel.current === joined) channel.current = undefined;
      setDraft(undefined);
      setPeers([]);
    };
    // The screen is its key: a new object for the same manifest is the same screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key]);

  useEffect(() => {
    channel.current?.publish({ route });
  }, [route]);

  // Other people's agents on this draft, unless the viewer chose to see
  // them; their own always show.
  const { othersOnDrafts, me } = useFollow();
  const shown = othersOnDrafts ? peers : peers.filter((p) => !p.agent || p.agent.for === me);
  // Only those on this very view are drawn over it. A manifest's other
  // sections show who is on them in its step list; the list screens share
  // one document, so someone on another list is not here at all. An agent
  // has no view, only the field it works on, which is drawn wherever that
  // field is in front of someone.
  // A walk is each person's own (collab/walkers): inside one, nobody is
  // drawn; those walking are shown as walking, wherever the others are.
  const walking = shown.filter((p) => !p.agent && walkerOf(p.route) !== undefined);
  const here = walkerOf(route) ? [] : shown.filter((p) => p.agent || (sameView(p.route, route) && !walkerOf(p.route)));
  const hereRef = useRef(here);
  hereRef.current = here;
  const pointerSent = useRef(false);
  const value: PresenceApi = {
    peers: screen ? shown.filter((p) => !walking.includes(p)) : here,
    here,
    walking,
    draft,
    publish: (state) => {
      // Inside a walk, where the person is and what they point at is
      // theirs alone: only the route is sent, so others see them walking.
      if (walkerOf(routeRef.current)) {
        const { pointer, focus, caret, ...rest } = state as Record<string, unknown>;
        if (pointer !== undefined || focus !== undefined || caret !== undefined) {
          if (pointerSent.current) channel.current?.publish({ pointer: null, focus: null, caret: null });
          pointerSent.current = false;
        }
        if (Object.keys(rest).length) channel.current?.publish(rest as typeof state);
        return;
      }
      // A pointer streams many times a second; nobody on this view, nobody
      // to stream it to. One clearing message, then nothing until someone
      // arrives (engine docs/MULTIPLAYER.md).
      if (state.pointer !== undefined && Object.keys(state).length === 1 && hereRef.current.length === 0) {
        if (!pointerSent.current) return;
        pointerSent.current = false;
        channel.current?.publish({ pointer: null });
        return;
      }
      if (state.pointer !== undefined) pointerSent.current = state.pointer !== null;
      channel.current?.publish(state);
    },
  };
  return createElement(PresenceContext.Provider, { value }, children);
}

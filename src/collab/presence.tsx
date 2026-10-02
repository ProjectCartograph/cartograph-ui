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

export type { PresenceApi };

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
  const value: PresenceApi = {
    peers: shown,
    draft,
    publish: (state) => channel.current?.publish(state),
  };
  return createElement(PresenceContext.Provider, { value }, children);
}

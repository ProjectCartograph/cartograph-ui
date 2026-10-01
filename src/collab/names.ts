import type { Peer } from "@/client/port";
import { copy } from "@/copy";

/** A peer's name as people read it. */
export function displayName(peer: Pick<Peer, "name" | "actor">): string {
  return peer.name?.trim() || peer.actor || copy.collab.someone;
}

/** Up to two letters for an avatar: the first of the first and last words,
 * or the first two of a single one. */
export function initials(name: string): string {
  const words = name
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

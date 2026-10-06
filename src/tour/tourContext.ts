import { createContext, useContext } from "react";

export interface TourApi {
  /** The step on, or null when no tour is on. */
  at: number | null;
  start: () => void;
  go: (to: number) => void;
  end: () => void;
  /** Lets a screen the tour is driving take the guide's Next: while a
   * handler is set, Next calls it first, and the tour moves on only when
   * it returns false. The tutorial walker uses it so its questions move
   * only when the person asks. Returns the way to let go. */
  takeNext: (handler: () => boolean) => () => void;
}

export const TourContext = createContext<TourApi>({ at: null, start: () => {}, go: () => {}, end: () => {}, takeNext: () => () => {} });

export function useTour(): TourApi {
  return useContext(TourContext);
}

// Whether this browser has been shown round, or declined: a convenience,
// so the invitation is made once. Lost, it is made again; nothing else is.
const KEY = "cartograph:toured";

export function toured(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markToured() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Without storage the invitation is made again.
  }
}

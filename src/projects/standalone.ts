/**
 * Whether a project was started as a project of its own, not a part of a
 * bigger one: said when it is started, and read by the Context step so
 * the question is asked once. Kept in this browser; the question is asked
 * again only where the answer is not known here.
 */
const KEY = (id: string) => `cartograph.standalone.${id}`;

export function rememberStandalone(id: string) {
  try {
    localStorage.setItem(KEY(id), "1");
  } catch {
    // Private windows refuse storage; the question is then asked again.
  }
}

export function startedStandalone(id: string): boolean {
  try {
    return localStorage.getItem(KEY(id)) === "1";
  } catch {
    return false;
  }
}

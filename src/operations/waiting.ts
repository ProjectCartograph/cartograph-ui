/**
 * Which project waits on a service a person went to define from that
 * project's placeholder (TAXONOMY.md D31), so the end of the service's walk
 * can lead back to it. A convenience for the person on this device only:
 * the placeholder itself is in the project's record, and the project's
 * checks keep it in view wherever it is opened.
 */
const key = (operation: string) => `cartograph:waiting:${operation}`;

export function rememberWaiting(operation: string, project: string): void {
  try {
    sessionStorage.setItem(key(operation), project);
  } catch {
    // Storage is a convenience; the checks still say what waits.
  }
}

export function waitingProject(operation: string): string | undefined {
  try {
    return sessionStorage.getItem(key(operation)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function forgetWaiting(operation: string): void {
  try {
    sessionStorage.removeItem(key(operation));
  } catch {
    // Nothing to forget.
  }
}

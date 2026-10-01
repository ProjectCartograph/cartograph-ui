/**
 * The short reference people quote a definition by.
 *
 * `metadata.id` is what references resolve against, and it is fixed once
 * chosen: renaming a project cannot move it without breaking every
 * mention. So a name people actually say needs somewhere else to live,
 * and that is `metadata.alias` (Programme Lead, 2026-09-29).
 *
 * It follows the name until somebody changes it. "Follows" is decided by
 * comparison rather than by a flag: an alias that still reads as the
 * slug of the old name was nobody's choice, and one that does not is
 * somebody's.
 */

/** The alias a name suggests: dashed lower-case words. */
export function aliasFor(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * The alias after a rename: the new suggestion where the old one was
 * still the old name's, and what somebody typed where it was not.
 */
export function aliasAfterRename(alias: string, before: string, after: string): string {
  if (!alias.trim() || alias === aliasFor(before)) return aliasFor(after);
  return alias;
}

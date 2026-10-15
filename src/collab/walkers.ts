// The walkers: flows a person goes through alone, one question at a time.
// Each person's walk is their own: nothing of it is drawn on anyone
// else's screen, and nobody else's pointer is drawn on it. Only that they
// are walking shows, so the team knows who is defining what. What a walk
// saves is a record like any other, and reaches everyone as it lands.

const WALKERS: Record<string, "workspace" | "project"> = {
  "/welcome": "workspace",
  "/projects/start": "project",
};

// Views that are each person's own: Home (what is left for them, their
// recent work), their drafts and what asks them. Like a walk, nothing of
// anyone else is drawn there and nothing of theirs is sent from there
// (#126: other people's pointers were drawn over another person's Home).
const PERSONAL = new Set(["/", "/drafts", "/mentions"]);

/** Whether a route is a view of a person's own: a walk or a personal page. */
export function aloneOn(route: string | undefined): boolean {
  if (!route) return false;
  return walkerOf(route) !== undefined || PERSONAL.has(route.split("?")[0].replace(/\/+$/, "") || "/");
}

/** Which walk a route is, if it is one. */
export function walkerOf(route: string | undefined): "workspace" | "project" | undefined {
  if (!route) return undefined;
  return WALKERS[route.split("?")[0].replace(/\/+$/, "") || "/"];
}

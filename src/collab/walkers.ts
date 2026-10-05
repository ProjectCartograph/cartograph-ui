// The walkers: flows a person goes through alone, one question at a time.
// Each person's walk is their own: nothing of it is drawn on anyone
// else's screen, and nobody else's pointer is drawn on it. Only that they
// are walking shows, so the team knows who is defining what. What a walk
// saves is a record like any other, and reaches everyone as it lands.

const WALKERS: Record<string, "workspace" | "project"> = {
  "/welcome": "workspace",
  "/projects/start": "project",
};

/** Which walk a route is, if it is one. */
export function walkerOf(route: string | undefined): "workspace" | "project" | undefined {
  if (!route) return undefined;
  return WALKERS[route.split("?")[0].replace(/\/+$/, "") || "/"];
}

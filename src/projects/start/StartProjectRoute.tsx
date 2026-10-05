import { useSearch } from "@tanstack/react-router";

import { StartProject } from "./StartProject";

/** The walker, with what it arrived with; walked again from a draft, a
 * fresh walker for that project. */
export function StartProjectRoute() {
  const search = useSearch({ from: "/projects/start" });
  return <StartProject key={search.from ?? "new"} {...search} />;
}

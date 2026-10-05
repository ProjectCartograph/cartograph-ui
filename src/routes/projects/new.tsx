import { createFileRoute, redirect } from "@tanstack/react-router";

import { startSearch } from "@/projects/start/search";

// A project is started in the walker; this address, used by links and
// bookmarks made before it, leads there with what it carried.
export const Route = createFileRoute("/projects/new")({
  validateSearch: startSearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/projects/start", search });
  },
});

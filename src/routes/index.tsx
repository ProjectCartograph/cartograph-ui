import { createFileRoute } from "@tanstack/react-router";

import { Home } from "@/surfaces/home/Home";

// Opening Cartograph opens on one question: what are you working on? What
// a person types is read as a word of the taxonomy, matched against the
// record, and led to its next step (engine docs/adr/0023).
export const Route = createFileRoute("/")({ component: Home });

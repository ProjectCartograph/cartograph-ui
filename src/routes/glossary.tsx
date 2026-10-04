import { createFileRoute } from "@tanstack/react-router";

import { GlossaryPage } from "@/surfaces/glossary/GlossaryPage";

// Every word Cartograph uses, defined plainly (TAXONOMY.md D29).
export const Route = createFileRoute("/glossary")({ component: GlossaryPage });

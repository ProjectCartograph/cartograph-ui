import { createFileRoute } from "@tanstack/react-router";

import { MentionsPage } from "@/comments/MentionsPage";

export const Route = createFileRoute("/mentions")({ component: MentionsPage });

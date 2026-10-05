import { createFileRoute } from "@tanstack/react-router";

import { Onboarding } from "@/onboarding/Onboarding";

// Opening a new workspace: its organisation, why it exists, and how it
// gets there, walked one question at a time (src/onboarding).
export const Route = createFileRoute("/welcome")({ component: Onboarding });

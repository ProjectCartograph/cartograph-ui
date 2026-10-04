import { createFileRoute } from "@tanstack/react-router";

import { SheetsIndex } from "@/surfaces/sheet/SheetsIndex";

export const Route = createFileRoute("/sheets/")({ component: SheetsIndex });

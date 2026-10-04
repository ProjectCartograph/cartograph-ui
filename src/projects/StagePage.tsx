import { useParams } from "@tanstack/react-router";

import { InitiationShell } from "./InitiationShell";
import type { InitiationSection } from "./types";

/** A step's route: its stage on one screen, opened at the step. */
export function StagePage({ section }: { section: InitiationSection }) {
  const { id } = useParams({ from: "/projects/$id" });
  return <InitiationShell id={id} section={section} />;
}

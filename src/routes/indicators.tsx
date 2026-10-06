import { createFileRoute, redirect } from "@tanstack/react-router";

// The register is called Indicators on screen, so its address answers to
// the name too.
export const Route = createFileRoute("/indicators")({
  beforeLoad: () => {
    throw redirect({ to: "/kpis" });
  },
});

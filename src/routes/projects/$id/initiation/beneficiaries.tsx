import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { BeneficiariesSection } from "@/projects/sections/BeneficiariesSection";

export const Route = createFileRoute("/projects/$id/initiation/beneficiaries")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell
      id={id}
      section="beneficiaries"
      heading={copy.projects.beneficiaries.heading}
      subtitle={copy.projects.beneficiaries.subtitle}
    >
      <BeneficiariesSection />
    </InitiationShell>
  );
}

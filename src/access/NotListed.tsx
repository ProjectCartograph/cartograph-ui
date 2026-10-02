import { KeyRound } from "lucide-react";

import { copy } from "@/copy";

/** What someone who signed in but is not on the access list sees. */
export function NotListed({ email }: { email?: string }) {
  return (
    <div className="mx-auto mt-24 max-w-md space-y-3 text-center" data-cartograph-region="not-listed">
      <KeyRound className="mx-auto size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">{copy.access.notListedTitle}</h1>
      <p className="text-sm text-muted-foreground">{copy.access.notListed(email)}</p>
    </div>
  );
}

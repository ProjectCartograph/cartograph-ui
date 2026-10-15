import { KeyRound } from "lucide-react";

import { copy } from "@/copy";

/** What someone who signed in but is not on the access list sees. */
/** Signed in and listed, but no group gives a role: every list would come
 * back refused and the workspace look empty (engine#109), so it is said
 * plainly instead, with who they are and what an administrator can do. */
export function NoRole({ email }: { email?: string }) {
  return (
    <div className="mx-auto mt-24 max-w-md space-y-3 text-center" data-cartograph-region="no-role">
      <KeyRound className="mx-auto size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">{copy.access.noRoleTitle}</h1>
      <p className="text-sm text-muted-foreground">{copy.access.noRole(email)}</p>
    </div>
  );
}

export function NotListed({ email }: { email?: string }) {
  return (
    <div className="mx-auto mt-24 max-w-md space-y-3 text-center" data-cartograph-region="not-listed">
      <KeyRound className="mx-auto size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">{copy.access.notListedTitle}</h1>
      <p className="text-sm text-muted-foreground">{copy.access.notListed(email)}</p>
    </div>
  );
}

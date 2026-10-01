import { useEffect, useState } from "react";

import { useClient } from "@/client/context";
import type { ConnectionStatus } from "@/client/port";

/** How the sync connection stands, kept current. */
export function useConnection(): ConnectionStatus {
  const client = useClient();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  useEffect(() => client.watchConnection(setStatus), [client]);
  return status;
}

import { useEffect, useRef } from "react";

import { useClient } from "@/client/context";
import { inFlow, leftFlow, traceOn } from "./index";

/**
 * Records a flow's walk on the people's trace: the flow opened (on a new
 * record or one with a version), each step entered, and each step left
 * backwards. Every flow shell calls it, so every flow is measured.
 */
export function useFlowTrace(kind: string, id: string, step: string, index: number): void {
  const client = useClient();
  const opened = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!traceOn() || !id || !step) return;
    const first = opened.current !== id;
    opened.current = id;
    if (!first) {
      inFlow(kind, id, step, index, false, undefined);
      return;
    }
    // Whether the record had a version tells a Define task from a Change.
    let gone = false;
    void client
      .versions(kind, id)
      .then((vs) => vs.some((v) => v.number > 0))
      .catch(() => false)
      .then((existing) => {
        if (!gone) inFlow(kind, id, step, index, true, existing);
      });
    return () => {
      gone = true;
    };
  }, [client, kind, id, step, index]);
  useEffect(() => () => leftFlow(id), [id]);
}

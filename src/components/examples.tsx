import { createContext, useContext, type ReactNode } from "react";

import { useSettings } from "@/surfaces/goals/api";

/**
 * Examples a vault supplies, in its own words (TAXONOMY.md D20).
 *
 * The product ships generic examples and names no organisation. A vault
 * that is about one organisation can list examples its own people will
 * recognise, per field, in `Settings.spec.examples`; where it lists none
 * for a field, the product's own are shown.
 *
 * A context with an empty default, so a screen rendered without a vault
 * behind it (a test, a first run) simply shows the product's examples.
 */
export const ExamplesContext = createContext<Record<string, string[]>>({});

export function VaultExamplesProvider({ children }: { children: ReactNode }) {
  const { data } = useSettings();
  return <ExamplesContext.Provider value={data?.examples ?? {}}>{children}</ExamplesContext.Provider>;
}

/** The vault's examples for a field, or the product's when it has none. */
export function useExamples(key: string | undefined, fallback: string[] | undefined): string[] | undefined {
  const vault = useContext(ExamplesContext);
  if (key && vault[key] && vault[key].length > 0) return vault[key];
  return fallback;
}

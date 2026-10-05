import { createContext, useContext } from "react";

import type { IdeaReading } from "@/client/port";

/** The sentences of the idea that answer the walk's questions, set by
 * FromIdeaProvider. */
export const IdeaAnswers = createContext<IdeaReading["answers"]>([]);

/** The sentence of the idea that answers the question filling field, if
 * the model was sure of one. */
export function useFromIdea(field: string) {
  return useContext(IdeaAnswers).find((a) => a.field === field);
}

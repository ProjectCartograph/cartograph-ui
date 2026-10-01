import { NotesField, withNote } from "@/definition/NotesField";
import { useProjectStore } from "./store";

/** The note for the step on screen. The project keeps its own store, so
 * this is the same field wired to the other one. */
export function ProjectSectionNotes({ section }: { section: string }) {
  const store = useProjectStore();
  return (
    <NotesField
      value={store.spec.notes?.[section]}
      onChange={(next) => store.updateSpec((spec) => withNote(spec, section, next))}
    />
  );
}

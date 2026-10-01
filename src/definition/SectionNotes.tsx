import { NotesField, withNote } from "./NotesField";
import { useDefinitionStore } from "./store";

/** The note for the step on screen, on a kind the generic store drives. */
export function SectionNotes({ section }: { section: string }) {
  const store = useDefinitionStore<{ notes?: Record<string, string> }>();
  return (
    <NotesField
      value={store.spec.notes?.[section]}
      onChange={(next) => store.updateSpec((spec) => withNote(spec, section, next))}
    />
  );
}

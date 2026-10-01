// Names a project field by its JSON pointer (data-cartograph-field).

/** A list item's segment: its id in braces where it carries one, so two
 * people's lists still agree on it, and its index otherwise. */
export function seg(item: { id?: string } | undefined, index: number): string {
  return item?.id ? `{${item.id}}` : String(index);
}

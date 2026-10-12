/** The control a field's element holds, or the element itself. */
function control(el: HTMLElement): HTMLElement | null {
  return el.matches("input, textarea, [role=combobox], button, [contenteditable]") ? el : el.querySelector<HTMLElement>("input, textarea, [role=combobox], button, [contenteditable]");
}

/**
 * Puts the cursor in a field, by its pointer, once its page is on screen:
 * the field itself, else the nearest field holding it (a list's item
 * where its own control is not drawn yet). Used wherever a message names
 * a field, so the person is taken to it rather than told of it (#86).
 */
export function focusField(field: string) {
  const parts = field.split("/");
  let tries = 0;
  const find = () => {
    for (let n = parts.length; n > 2; n--) {
      const at = parts.slice(0, n).join("/");
      const el = document.querySelector<HTMLElement>(`[data-cartograph-field="${CSS.escape(at)}"]`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        control(el)?.focus();
        return;
      }
      // Wait for the page before settling for a field around it.
      if (tries < 20) break;
    }
    if (tries++ < 20) setTimeout(find, 100);
  };
  find();
}

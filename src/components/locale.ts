// Names a person picks from or reads in a list, in their own language:
// months, weekdays and currencies, from the browser's own localisation
// (Intl), never from a list kept in English (engine TAXONOMY.md D36).

/** The reader's language, as the browser reports it. */
export function readerLocale(): string {
  return (typeof navigator !== "undefined" && navigator.language) || "en";
}

/** The twelve month names, January first, long or short. */
export function monthNames(style: "long" | "short" = "long", locale = readerLocale()): string[] {
  const f = new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => f.format(Date.UTC(2000, i, 1)));
}

/** The seven weekday names, Monday first, short. */
export function weekdayNames(locale = readerLocale()): string[] {
  const f = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  // 3 January 2000 was a Monday.
  return Array.from({ length: 7 }, (_, i) => f.format(Date.UTC(2000, 0, 3 + i)));
}

/** A currency's name, by its ISO code; the code itself where the browser
 * has no name for it. */
export function currencyName(code: string, locale = readerLocale()): string {
  try {
    return new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

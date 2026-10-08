/**
 * The statements Cartograph stores in parts.
 *
 * A problem, a change and a programme's aim are each written as two
 * fields under their own labels, and the manifest holds exactly those
 * fields. Until 2026-09-29 this file also joined them into one sentence
 * for display ("<groups> <situation>, because <cause>"). It no longer
 * does: a tool cannot promise the grammar of a sentence it assembles, and
 * the joined sentence was the part people found most confusing. Every
 * screen and the charter show the parts as they were written
 * (TAXONOMY.md D19, LSS_REVIEW.md).
 *
 * The server still splits a composed sentence from an older file back
 * into parts on read (`server/internal/sentence`, used by the legacy
 * rewrite); nothing composes one any more.
 */

export interface ProblemStatement {
  situation?: string;
  cause?: string;
  /** What analysis found behind it, with evidence (engine TAXONOMY.md D58). */
  causes?: { id?: string; cause: string; evidence?: string; verified?: boolean }[];
}

export interface ChangeStatement {
  what?: string;
  gain?: string;
}

export interface AimStatement {
  change?: string;
  gain?: string;
}

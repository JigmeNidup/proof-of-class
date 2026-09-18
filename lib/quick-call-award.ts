/**
 * Turns a quick-call result row into a prefilled points award.
 *
 * The trainer picks a winner straight from the final ranking, so the note is
 * generated here rather than retyped - it has to carry the question for context
 * and the timing that justified the award.
 */
import type { QuickCallEntry } from "@/lib/realtime/events";

/** Mirrors the `note` cap in lib/validation.ts and the on-chain event field. */
export const NOTE_MAX_LENGTH = 200;

export type PointsPrefill = {
  /**
   * Bumped on every selection so the award form remounts and picks up new
   * values even when the same trainee is chosen twice in a row.
   */
  nonce: number;
  receiverAddress: string;
  note: string;
};

export function ordinal(rank: number): string {
  const teens = rank % 100;
  if (teens >= 11 && teens <= 13) return `${rank}th`;

  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

/**
 * Ranks come from arrival order rather than correctness, so the wording stays
 * neutral: "2nd to answer, correct" is true even when the 1st answer was wrong.
 */
function remarkFor(entry: QuickCallEntry): string {
  const base = `${ordinal(entry.rank)} to answer in ${entry.latencyMs} ms`;

  if (entry.isCorrect === true) return `${base} — correct`;
  if (entry.isCorrect === false) {
    return entry.optionId
      ? `${base} — incorrect (${entry.optionId})`
      : `${base} — incorrect`;
  }
  return base;
}

/**
 * Questions may run to 280 characters while notes cap at 200, so the question
 * is the part that gets trimmed - the remark is short and always survives.
 */
export function quickCallNote(question: string, entry: QuickCallEntry): string {
  const remark = remarkFor(entry);
  const open = 'Quick-call "';
  const close = `" — ${remark}`;
  const room = NOTE_MAX_LENGTH - open.length - close.length;
  const text = question.trim();

  if (room <= 0) return remark.slice(0, NOTE_MAX_LENGTH);

  const trimmed =
    text.length > room ? `${text.slice(0, room - 1).trimEnd()}…` : text;

  return `${open}${trimmed}${close}`;
}

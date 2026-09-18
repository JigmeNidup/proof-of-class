/**
 * Period helpers shared by leaderboards, badge awards and the seed script.
 *
 * Weeks are ISO-8601: they start on Monday, and week 1 is the week containing
 * the first Thursday of the year. Everything is computed in UTC so a trainer
 * and a trainee in different timezones always agree on which week a point
 * belongs to.
 */

export type LeaderboardPeriod = "week" | "month" | "all";

export const LEADERBOARD_PERIODS: LeaderboardPeriod[] = [
  "week",
  "month",
  "all",
];

export function isLeaderboardPeriod(
  value: string | null | undefined,
): value is LeaderboardPeriod {
  return value === "week" || value === "month" || value === "all";
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Monday 00:00:00 UTC of the ISO week containing `date`. */
export function startOfIsoWeek(date: Date = new Date()): Date {
  const day = startOfUtcDay(date);
  // getUTCDay(): Sunday = 0. Shift so Monday = 0.
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day;
}

/** First day 00:00:00 UTC of the month containing `date`. */
export function startOfUtcMonth(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** ISO week key, e.g. "2026-W35". */
export function isoWeekKey(date: Date = new Date()): string {
  const target = startOfUtcDay(date);
  // Shift to the Thursday of this ISO week; its year is the ISO week-year.
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7),
  );
  const week =
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** Month key, e.g. "2026-08". */
export function monthKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Inclusive lower bound for a leaderboard window, or `null` for all-time.
 */
export function periodStart(
  period: LeaderboardPeriod,
  now: Date = new Date(),
): Date | null {
  if (period === "week") return startOfIsoWeek(now);
  if (period === "month") return startOfUtcMonth(now);
  return null;
}

/** The period key a badge for `period` would carry right now. */
export function periodKeyFor(
  period: Exclude<LeaderboardPeriod, "all">,
  now: Date = new Date(),
): string {
  return period === "week" ? isoWeekKey(now) : monthKey(now);
}

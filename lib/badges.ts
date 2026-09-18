import type { BadgeType } from "@prisma/client";

/** Must match the constants in contracts/ClassBadges.sol. */
export const WEEKLY_TOKEN_ID = 1;
export const MONTHLY_TOKEN_ID = 2;

export const BADGE_TOKEN_IDS: Record<BadgeType, number> = {
  WEEKLY: WEEKLY_TOKEN_ID,
  MONTHLY: MONTHLY_TOKEN_ID,
};

export function badgeTypeForTokenId(tokenId: number): BadgeType | null {
  if (tokenId === WEEKLY_TOKEN_ID) return "WEEKLY";
  if (tokenId === MONTHLY_TOKEN_ID) return "MONTHLY";
  return null;
}

export type BadgeVisual = {
  label: string;
  /** Weekly is a hexagon, monthly a higher-tier eight-pointed star. */
  shape: "hexagon" | "star";
  fillFrom: string;
  fillTo: string;
  stroke: string;
  tier: number;
  description: string;
};

export const BADGE_VISUALS: Record<BadgeType, BadgeVisual> = {
  WEEKLY: {
    label: "Weekly Topper",
    shape: "hexagon",
    fillFrom: "#4ec9f5",
    fillTo: "#1f8fbd",
    stroke: "#bfeeff",
    tier: 1,
    description:
      "Awarded to the highest point holder of an ISO calendar week in this classroom.",
  },
  MONTHLY: {
    label: "Monthly Champion",
    shape: "star",
    fillFrom: "#ffc94a",
    fillTo: "#d99512",
    stroke: "#fff0c2",
    tier: 2,
    description:
      "Awarded to the highest point holder of a calendar month in this classroom. Outranks the weekly badge.",
  },
};

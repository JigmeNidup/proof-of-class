"use client";

import type { BadgeType } from "@prisma/client";

import { BADGE_VIEWBOX, badgeShapePoints } from "@/lib/badge-svg";
import { BADGE_VISUALS } from "@/lib/badges";
import { classNames } from "@/lib/utils";

export function BadgeIcon({
  badgeType,
  size = 28,
  muted = false,
}: {
  badgeType: BadgeType;
  size?: number;
  muted?: boolean;
}) {
  const visual = BADGE_VISUALS[badgeType];
  const gradientId = `badge-grad-${badgeType}-${size}`;

  return (
    <svg
      viewBox={BADGE_VIEWBOX}
      width={size}
      height={size}
      className={classNames(muted && "opacity-30 grayscale")}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={visual.fillFrom} />
          <stop offset="100%" stopColor={visual.fillTo} />
        </linearGradient>
      </defs>
      <polygon
        points={badgeShapePoints(badgeType)}
        fill={`url(#${gradientId})`}
        stroke={visual.stroke}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One icon per badge tier with the win count overlaid, rather than one icon
 * per NFT. This matches how the contract stores them: repeat wins increase the
 * ERC-1155 balance of a single token id.
 */
export function BadgeStack({
  badgeType,
  count,
  size = 28,
  showZero = false,
}: {
  badgeType: BadgeType;
  count: number;
  size?: number;
  showZero?: boolean;
}) {
  if (count <= 0 && !showZero) return null;

  const visual = BADGE_VISUALS[badgeType];

  return (
    <span
      className="relative inline-flex shrink-0"
      title={`${visual.label} \u00d7 ${count}`}
    >
      <BadgeIcon badgeType={badgeType} size={size} muted={count <= 0} />
      <span
        className={classNames(
          "absolute -bottom-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full border border-ink-900 px-1 text-[0.625rem] font-bold leading-4 tabular-nums",
          count > 0 ? "bg-ink-900 text-white" : "bg-ink-800 text-ink-600",
        )}
      >
        {count}
      </span>
    </span>
  );
}

/** Weekly and monthly side by side, as shown on the all-time leaderboard. */
export function BadgeStackPair({
  weekly,
  monthly,
  size = 24,
  showZero = false,
}: {
  weekly: number;
  monthly: number;
  size?: number;
  showZero?: boolean;
}) {
  if (weekly <= 0 && monthly <= 0 && !showZero) return null;

  return (
    <span className="inline-flex items-center gap-3">
      <BadgeStack
        badgeType="WEEKLY"
        count={weekly}
        size={size}
        showZero={showZero}
      />
      <BadgeStack
        badgeType="MONTHLY"
        count={monthly}
        size={size}
        showZero={showZero}
      />
    </span>
  );
}

export function BadgeLegend() {
  return (
    <div className="flex flex-wrap gap-5">
      {(Object.keys(BADGE_VISUALS) as BadgeType[]).map((badgeType) => (
        <div key={badgeType} className="flex items-center gap-2.5">
          <BadgeIcon badgeType={badgeType} size={32} />
          <div>
            <p className="text-sm font-medium text-white">
              {BADGE_VISUALS[badgeType].label}
            </p>
            <p className="text-xs text-ink-400">
              Tier {BADGE_VISUALS[badgeType].tier} &middot;{" "}
              {BADGE_VISUALS[badgeType].shape === "hexagon"
                ? "Hexagon"
                : "Eight-pointed star"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

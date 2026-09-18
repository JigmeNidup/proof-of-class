import type { BadgeType } from "@prisma/client";

import { BADGE_VISUALS } from "./badges";

/**
 * Geometry for the two badge tiers, shared by the React component and the
 * ERC-1155 metadata image endpoint so a badge looks identical in the app and
 * inside a wallet.
 */

const VIEWBOX = 100;
const CENTER = VIEWBOX / 2;

function polygonPoints(
  vertices: number,
  radius: number,
  rotationDeg = -90,
): string {
  const points: string[] = [];
  for (let i = 0; i < vertices; i += 1) {
    const angle = ((rotationDeg + (360 / vertices) * i) * Math.PI) / 180;
    points.push(
      `${(CENTER + radius * Math.cos(angle)).toFixed(2)},${(
        CENTER +
        radius * Math.sin(angle)
      ).toFixed(2)}`,
    );
  }
  return points.join(" ");
}

function starPoints(
  spikes: number,
  outerRadius: number,
  innerRadius: number,
  rotationDeg = -90,
): string {
  const points: string[] = [];
  const step = 360 / (spikes * 2);
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = ((rotationDeg + step * i) * Math.PI) / 180;
    points.push(
      `${(CENTER + radius * Math.cos(angle)).toFixed(2)},${(
        CENTER +
        radius * Math.sin(angle)
      ).toFixed(2)}`,
    );
  }
  return points.join(" ");
}

/** Weekly = hexagon, monthly = eight-pointed star. */
export function badgeShapePoints(badgeType: BadgeType): string {
  return badgeType === "WEEKLY"
    ? polygonPoints(6, 42)
    : starPoints(8, 46, 24);
}

export const BADGE_VIEWBOX = `0 0 ${VIEWBOX} ${VIEWBOX}`;

/** Standalone SVG document served as the NFT image. */
export function badgeSvgDocument(badgeType: BadgeType): string {
  const visual = BADGE_VISUALS[badgeType];
  const gradientId = `grad-${badgeType.toLowerCase()}`;
  const glowId = `glow-${badgeType.toLowerCase()}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BADGE_VIEWBOX}" width="512" height="512" role="img" aria-label="${visual.label}">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${visual.fillFrom}"/>
      <stop offset="100%" stop-color="${visual.fillTo}"/>
    </linearGradient>
    <filter id="${glowId}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="#0c0e1a"/>
  <polygon
    points="${badgeShapePoints(badgeType)}"
    fill="url(#${gradientId})"
    stroke="${visual.stroke}"
    stroke-width="2"
    stroke-linejoin="round"
    filter="url(#${glowId})"/>
  <text x="${CENTER}" y="${CENTER + 4}" text-anchor="middle"
    font-family="ui-sans-serif, system-ui, sans-serif" font-size="14"
    font-weight="700" fill="#0c0e1a">${visual.tier === 1 ? "W" : "M"}</text>
</svg>`;
}

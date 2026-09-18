import { badgeTypeForTokenId, BADGE_VISUALS } from "@/lib/badges";
import { json, notFound, route } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

/**
 * ERC-1155 metadata for a badge tier. ClassBadges.uri() points here, so this
 * is what wallets and marketplaces read.
 */
export const GET = route(async (request: Request, context: Context) => {
  const { id } = await context.params;
  // Tolerate ".json" suffixes some marketplaces append.
  const tokenId = Number(id.replace(/\.json$/i, ""));
  const badgeType = Number.isFinite(tokenId)
    ? badgeTypeForTokenId(tokenId)
    : null;
  if (!badgeType) throw notFound("Unknown badge id");

  const visual = BADGE_VISUALS[badgeType];
  const origin = new URL(request.url).origin;

  return json(
    {
      name: visual.label,
      description: visual.description,
      image: `${origin}/api/metadata/badges/${tokenId}/image`,
      external_url: origin,
      attributes: [
        { trait_type: "Tier", value: visual.tier, display_type: "number" },
        { trait_type: "Cadence", value: badgeType === "WEEKLY" ? "Weekly" : "Monthly" },
        { trait_type: "Shape", value: visual.shape === "hexagon" ? "Hexagon" : "Eight-pointed star" },
        { trait_type: "Colour", value: badgeType === "WEEKLY" ? "Cyan" : "Gold" },
      ],
    },
    {
      headers: { "cache-control": "public, max-age=3600" },
    },
  );
});

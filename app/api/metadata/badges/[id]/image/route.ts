import { badgeSvgDocument } from "@/lib/badge-svg";
import { badgeTypeForTokenId } from "@/lib/badges";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const badgeType = badgeTypeForTokenId(Number(id));

  if (!badgeType) {
    return new Response("Unknown badge id", { status: 404 });
  }

  return new Response(badgeSvgDocument(badgeType), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}

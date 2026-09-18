import { badRequest, json, notFound, parseJsonBody, route } from "@/lib/api";
import { BADGE_TOKEN_IDS } from "@/lib/badges";
import { requireClassroomAccess, requireTrainerOf } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { classroomRoom } from "@/lib/realtime/events";
import { getIo } from "@/lib/realtime/registry";
import { normalizeAddress } from "@/lib/utils";
import { createBadgeAwardSchema } from "@/lib/validation";

export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const classroomId = url.searchParams.get("classroomId");
  if (!classroomId) throw badRequest("classroomId is required");

  await requireClassroomAccess(classroomId);
  const userId = url.searchParams.get("userId");

  const awards = await prisma.badgeAward.findMany({
    where: { classroomId, userId: userId ?? undefined },
    include: {
      user: {
        select: { id: true, displayName: true, walletAddress: true },
      },
    },
    orderBy: { awardedAt: "desc" },
    take: 100,
  });

  return json({ awards });
});

/**
 * Records a badge mint. The unique index on
 * (classroomId, badgeType, periodKey) is what enforces "one winner per period"
 * - the check below just turns the constraint violation into a clear message.
 */
export const POST = route(async (request: Request) => {
  const body = createBadgeAwardSchema.parse(await parseJsonBody(request));
  await requireTrainerOf(body.classroomId);

  const expectsWeeklyKey = body.periodKey.includes("W");
  if (expectsWeeklyKey !== (body.badgeType === "WEEKLY")) {
    throw badRequest(
      'Weekly badges need a "2026-W35" key and monthly badges a "2026-08" key',
    );
  }

  const recipientWallet = normalizeAddress(body.recipientAddress);
  const recipient = await prisma.user.findUnique({
    where: { walletAddress: recipientWallet },
  });
  if (!recipient) throw notFound("That wallet has never signed in");

  const existing = await prisma.badgeAward.findUnique({
    where: {
      classroomId_badgeType_periodKey: {
        classroomId: body.classroomId,
        badgeType: body.badgeType,
        periodKey: body.periodKey,
      },
    },
  });
  if (existing) {
    throw badRequest(
      `A ${body.badgeType.toLowerCase()} badge was already awarded for ${body.periodKey}`,
      "period_already_awarded",
    );
  }

  const isOnChain = Boolean(body.txHash);
  const award = await prisma.badgeAward.create({
    data: {
      classroomId: body.classroomId,
      userId: recipient.id,
      recipientWallet,
      badgeType: body.badgeType,
      tokenId: BADGE_TOKEN_IDS[body.badgeType],
      periodKey: body.periodKey,
      txHash: body.txHash?.toLowerCase(),
      status: isOnChain ? "PENDING" : "CONFIRMED",
    },
    include: {
      user: {
        select: { id: true, displayName: true, walletAddress: true },
      },
    },
  });

  getIo()
    ?.to(classroomRoom(body.classroomId))
    .emit("badge:awarded", {
      classroomId: body.classroomId,
      recipientAddress: recipientWallet,
      badgeType: body.badgeType,
    });

  return json({ award }, { status: 201 });
});

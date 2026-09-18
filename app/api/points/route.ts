import { badRequest, json, notFound, parseJsonBody, route } from "@/lib/api";
import { requireClassroomAccess, requireTrainerOf } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { classroomRoom } from "@/lib/realtime/events";
import { getIo } from "@/lib/realtime/registry";
import { normalizeAddress, pointsToWei } from "@/lib/utils";
import { createPointLogSchema } from "@/lib/validation";

export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const classroomId = url.searchParams.get("classroomId");
  if (!classroomId) throw badRequest("classroomId is required");

  const { isTrainer, user } = await requireClassroomAccess(classroomId);
  const receiverId = url.searchParams.get("receiverId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const points = await prisma.pointLog.findMany({
    where: {
      classroomId,
      // A trainee only sees their own ledger; the trainer sees the class.
      receiverId: isTrainer ? (receiverId ?? undefined) : user.id,
    },
    include: {
      receiver: {
        select: { id: true, displayName: true, walletAddress: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return json({ points });
});

/**
 * Records a point award.
 *
 * With a `txHash` the row starts PENDING and the indexer promotes it to
 * CONFIRMED once the on-chain event lands. Without one it is treated as an
 * off-chain adjustment and stored CONFIRMED immediately, so a classroom is
 * usable before its token contract is deployed.
 */
export const POST = route(async (request: Request) => {
  const body = createPointLogSchema.parse(await parseJsonBody(request));
  const { user } = await requireTrainerOf(body.classroomId);

  const receiverAddress = normalizeAddress(body.receiverAddress);
  const receiver = await prisma.user.findUnique({
    where: { walletAddress: receiverAddress },
  });
  if (!receiver) throw notFound("That wallet has never signed in");

  const membership = await prisma.classMembership.findUnique({
    where: {
      userId_classroomId: {
        userId: receiver.id,
        classroomId: body.classroomId,
      },
    },
  });
  if (membership?.status !== "APPROVED") {
    throw badRequest("That trainee is not an approved member of this class");
  }

  const classroom = await prisma.classroom.findUniqueOrThrow({
    where: { id: body.classroomId },
    select: { tokenDecimals: true },
  });

  const isOnChain = Boolean(body.txHash);
  const pointLog = await prisma.pointLog.create({
    data: {
      classroomId: body.classroomId,
      receiverId: receiver.id,
      receiverWallet: receiverAddress,
      awardedById: user.id,
      points: body.points,
      amountWei: pointsToWei(
        body.points,
        classroom.tokenDecimals,
      ).toString(),
      category: body.category,
      note: body.note,
      txHash: body.txHash?.toLowerCase(),
      status: isOnChain ? "PENDING" : "CONFIRMED",
      confirmedAt: isOnChain ? null : new Date(),
    },
    include: {
      receiver: {
        select: { id: true, displayName: true, walletAddress: true },
      },
    },
  });

  getIo()
    ?.to(classroomRoom(body.classroomId))
    .emit("points:awarded", {
      classroomId: body.classroomId,
      receiverAddress,
      points: body.points,
      category: body.category,
    });

  return json({ pointLog }, { status: 201 });
});

import { json, parseJsonBody, route } from "@/lib/api";
import { requireClassroomAccess, requireTrainerOf } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/utils";
import { updateClassroomSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  const { id } = await context.params;
  const { classroom, isTrainer, membership } =
    await requireClassroomAccess(id);

  const [creator, approvedCount, pendingCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: classroom.creatorId },
      select: { id: true, displayName: true, walletAddress: true },
    }),
    prisma.classMembership.count({
      where: { classroomId: id, status: "APPROVED" },
    }),
    prisma.classMembership.count({
      where: { classroomId: id, status: "PENDING" },
    }),
  ]);

  return json({
    classroom: {
      ...classroom,
      // Only the trainer needs the join code; trainees already got in.
      joinCode: isTrainer ? classroom.joinCode : undefined,
    },
    creator,
    isTrainer,
    membership,
    counts: { approved: approvedCount, pending: pendingCount },
  });
});

export const PATCH = route(async (request: Request, context: Context) => {
  const { id } = await context.params;
  await requireTrainerOf(id);
  const body = updateClassroomSchema.parse(await parseJsonBody(request));

  const classroom = await prisma.classroom.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description ?? undefined,
      autoApprove: body.autoApprove,
      isActive: body.isActive,
      tokenAddress: body.tokenAddress
        ? normalizeAddress(body.tokenAddress)
        : undefined,
      badgeAddress: body.badgeAddress
        ? normalizeAddress(body.badgeAddress)
        : undefined,
      tokenSymbol: body.tokenSymbol?.toUpperCase(),
      deployedBlock:
        body.deployedBlock !== undefined ? BigInt(body.deployedBlock) : undefined,
    },
  });

  return json({ classroom });
});

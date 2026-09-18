import { conflict, json, parseJsonBody, route } from "@/lib/api";
import { CHAIN_ID } from "@/lib/contracts";
import { requireApprovedTrainer, requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { generateJoinCode } from "@/lib/utils";
import { createClassroomSchema } from "@/lib/validation";

/** Classrooms the caller runs, plus the ones they belong to. */
export const GET = route(async () => {
  const session = await requireSession();

  const [owned, memberships] = await Promise.all([
    prisma.classroom.findMany({
      where: { creatorId: session.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            memberships: { where: { status: "APPROVED" } },
            points: true,
          },
        },
      },
    }),
    prisma.classMembership.findMany({
      where: { userId: session.id },
      orderBy: { requestedAt: "desc" },
      include: {
        classroom: {
          include: {
            creator: { select: { displayName: true, walletAddress: true } },
            _count: {
              select: { memberships: { where: { status: "APPROVED" } } },
            },
          },
        },
      },
    }),
  ]);

  return json({ owned, memberships });
});

export const POST = route(async (request: Request) => {
  // Approval is checked against the database, not the session role, so a stale
  // JWT cannot be used to create a classroom before the owner has signed off.
  const session = await requireApprovedTrainer();
  const body = createClassroomSchema.parse(await parseJsonBody(request));

  // Join codes are short and random, so retry on the rare collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = generateJoinCode();
    const existing = await prisma.classroom.findUnique({ where: { joinCode } });
    if (existing) continue;

    const classroom = await prisma.classroom.create({
      data: {
        name: body.name,
        description: body.description,
        autoApprove: body.autoApprove ?? false,
        tokenSymbol: body.tokenSymbol?.toUpperCase(),
        joinCode,
        chainId: CHAIN_ID,
        creatorId: session.id,
      },
    });

    return json({ classroom }, { status: 201 });
  }

  throw conflict("Could not allocate a unique join code, please retry");
});

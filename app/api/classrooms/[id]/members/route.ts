import type { MembershipStatus } from "@prisma/client";

import { json, route } from "@/lib/api";
import { requireClassroomAccess } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

const VALID_STATUSES: MembershipStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REMOVED",
];

export const GET = route(async (request: Request, context: Context) => {
  const { id } = await context.params;
  const { isTrainer } = await requireClassroomAccess(id);

  const requested = new URL(request.url).searchParams.get("status");
  const statusFilter =
    requested && VALID_STATUSES.includes(requested as MembershipStatus)
      ? (requested as MembershipStatus)
      : undefined;

  const members = await prisma.classMembership.findMany({
    where: {
      classroomId: id,
      // Trainees only ever see the approved roster.
      status: isTrainer ? statusFilter : "APPROVED",
    },
    include: {
      user: {
        select: {
          id: true,
          walletAddress: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { requestedAt: "asc" }],
  });

  return json({ members, isTrainer });
});

import { json, notFound, parseJsonBody, route } from "@/lib/api";
import { requireTrainerOf } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { updateMembershipSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string; membershipId: string }> };

/** Approve, reject, or remove a trainee. Trainer only. */
export const PATCH = route(async (request: Request, context: Context) => {
  const { id, membershipId } = await context.params;
  const { user } = await requireTrainerOf(id);
  const { status } = updateMembershipSchema.parse(await parseJsonBody(request));

  const existing = await prisma.classMembership.findFirst({
    where: { id: membershipId, classroomId: id },
  });
  if (!existing) throw notFound("Membership not found");

  const membership = await prisma.classMembership.update({
    where: { id: membershipId },
    data: {
      status,
      approvedAt: status === "APPROVED" ? new Date() : null,
      approvedById: status === "APPROVED" ? user.id : null,
    },
    include: {
      user: {
        select: { id: true, walletAddress: true, displayName: true },
      },
    },
  });

  return json({ membership });
});

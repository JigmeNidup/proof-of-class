import { badRequest, json, notFound, parseJsonBody, route } from "@/lib/api";
import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { normalizeJoinCode } from "@/lib/utils";
import { joinClassroomSchema } from "@/lib/validation";

/**
 * Join by code. Classrooms with `autoApprove` let the trainee straight in;
 * otherwise this files a PENDING request for the trainer to action.
 */
export const POST = route(async (request: Request) => {
  const session = await requireSession();
  const { joinCode } = joinClassroomSchema.parse(await parseJsonBody(request));

  const classroom = await prisma.classroom.findUnique({
    where: { joinCode: normalizeJoinCode(joinCode) },
  });
  if (!classroom) throw notFound("No classroom matches that code");
  if (!classroom.isActive) throw badRequest("That classroom is closed");
  if (classroom.creatorId === session.id) {
    throw badRequest("You already run this classroom");
  }

  const existing = await prisma.classMembership.findUnique({
    where: {
      userId_classroomId: { userId: session.id, classroomId: classroom.id },
    },
  });

  if (existing?.status === "APPROVED") {
    return json({ classroom, membership: existing, alreadyMember: true });
  }

  const status = classroom.autoApprove ? "APPROVED" : "PENDING";
  const membership = await prisma.classMembership.upsert({
    where: {
      userId_classroomId: { userId: session.id, classroomId: classroom.id },
    },
    // Re-requesting after a rejection or removal resets the request.
    update: {
      status,
      requestedAt: new Date(),
      approvedAt: status === "APPROVED" ? new Date() : null,
      approvedById: null,
    },
    create: {
      userId: session.id,
      classroomId: classroom.id,
      status,
      approvedAt: status === "APPROVED" ? new Date() : null,
    },
  });

  return json(
    { classroom, membership, alreadyMember: false },
    { status: 201 },
  );
});

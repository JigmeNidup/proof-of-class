import { badRequest, json, parseJsonBody, route } from "@/lib/api";
import { requireClassroomAccess, requireTrainerOf } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import {
  getActiveQuickCallForClassroom,
  startQuickCall,
} from "@/lib/realtime/quick-call";
import { createQuickCallSchema } from "@/lib/validation";

/** Recent quick calls plus whichever one is currently open. */
export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const classroomId = url.searchParams.get("classroomId");
  if (!classroomId) throw badRequest("classroomId is required");

  await requireClassroomAccess(classroomId);

  const recent = await prisma.quickCall.findMany({
    where: { classroomId },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { _count: { select: { responses: true } } },
  });

  return json({
    active: getActiveQuickCallForClassroom(classroomId),
    recent,
  });
});

/** Trainer opens a quick call: persist it, then push it to every trainee. */
export const POST = route(async (request: Request) => {
  const body = createQuickCallSchema.parse(await parseJsonBody(request));
  const { user } = await requireTrainerOf(body.classroomId);

  const options = body.options ?? [];
  if (
    body.correctOptionId &&
    !options.some((option) => option.id === body.correctOptionId)
  ) {
    throw badRequest("correctOptionId must match one of the options");
  }

  const quickCall = await prisma.quickCall.create({
    data: {
      classroomId: body.classroomId,
      createdById: user.id,
      question: body.question,
      options: options.length > 0 ? options : undefined,
      correctOptionId: body.correctOptionId,
    },
  });

  const payload = startQuickCall({
    id: quickCall.id,
    classroomId: quickCall.classroomId,
    question: quickCall.question,
    options,
    correctOptionId: quickCall.correctOptionId,
    durationSeconds: body.durationSeconds ?? 30,
    startedAt: quickCall.startedAt,
  });

  return json({ quickCall, payload }, { status: 201 });
});

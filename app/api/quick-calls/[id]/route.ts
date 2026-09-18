import { json, notFound, route } from "@/lib/api";
import { requireClassroomAccess, requireTrainerOf } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { endQuickCall, getActiveQuickCall } from "@/lib/realtime/quick-call";

type Context = { params: Promise<{ id: string }> };

/**
 * Final results for a quick call. While a call is still open the ranking lives
 * in memory, so serve that; once closed it comes from the database.
 */
export const GET = route(async (_request: Request, context: Context) => {
  const { id } = await context.params;

  const quickCall = await prisma.quickCall.findUnique({
    where: { id },
    include: {
      responses: {
        include: {
          user: {
            select: { id: true, displayName: true, walletAddress: true },
          },
        },
        orderBy: { latencyMs: "asc" },
      },
    },
  });
  if (!quickCall) throw notFound("Quick call not found");

  await requireClassroomAccess(quickCall.classroomId);

  const active = getActiveQuickCall(id);
  return json({ quickCall, isOpen: Boolean(active) });
});

/** Trainer closes the call early. */
export const PATCH = route(async (_request: Request, context: Context) => {
  const { id } = await context.params;

  const quickCall = await prisma.quickCall.findUnique({ where: { id } });
  if (!quickCall) throw notFound("Quick call not found");

  await requireTrainerOf(quickCall.classroomId);
  const results = await endQuickCall(id);

  return json({ results, closed: true });
});

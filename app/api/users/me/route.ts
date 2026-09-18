import { json, parseJsonBody, route } from "@/lib/api";
import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validation";

export const GET = route(async () => {
  const session = await requireSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    include: {
      memberships: {
        include: {
          classroom: {
            select: { id: true, name: true, joinCode: true, isActive: true },
          },
        },
        orderBy: { requestedAt: "desc" },
      },
      _count: { select: { ownedClassrooms: true, badges: true } },
    },
  });

  return json({ user });
});

export const PATCH = route(async (request: Request) => {
  const session = await requireSession();
  const body = updateProfileSchema.parse(await parseJsonBody(request));

  const user = await prisma.user.update({
    where: { id: session.id },
    data: {
      displayName: body.displayName ?? undefined,
      bio: body.bio ?? undefined,
      avatarUrl: body.avatarUrl ?? undefined,
    },
  });

  return json({ user });
});

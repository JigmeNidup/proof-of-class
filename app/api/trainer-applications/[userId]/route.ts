import { badRequest, json, notFound, parseJsonBody, route } from "@/lib/api";
import { requirePlatformOwner } from "@/lib/guards";
import { isPlatformOwner } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { reviewTrainerApplicationSchema } from "@/lib/validation";

/**
 * The owner's decision. Approving is the only thing in the codebase that sets
 * `role` to TRAINER; rejecting also revokes it, which doubles as the way to
 * take trainer access back from someone.
 */
export const PATCH = route(
  async (
    request: Request,
    { params }: { params: Promise<{ userId: string }> },
  ) => {
    const owner = await requirePlatformOwner();
    const { userId } = await params;
    const body = reviewTrainerApplicationSchema.parse(
      await parseJsonBody(request),
    );

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, walletAddress: true, trainerStatus: true },
    });
    if (!target) throw notFound("No such user");

    if (isPlatformOwner(target.walletAddress)) {
      throw badRequest("The platform owner does not need reviewing");
    }

    if (
      target.trainerStatus !== "PENDING" &&
      target.trainerStatus !== "APPROVED"
    ) {
      throw badRequest("That user has no request to review");
    }

    const approved = body.status === "APPROVED";

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        trainerStatus: body.status,
        role: approved ? "TRAINER" : "TRAINEE",
        trainerReviewedAt: new Date(),
        trainerReviewedBy: owner.address,
        trainerReviewNote: body.note ?? null,
      },
      select: {
        id: true,
        walletAddress: true,
        displayName: true,
        role: true,
        trainerStatus: true,
        trainerReviewedAt: true,
        trainerReviewNote: true,
      },
    });

    return json({ application: user });
  },
);

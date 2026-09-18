import { type TrainerStatus } from "@prisma/client";

import { badRequest, conflict, json, parseJsonBody, route } from "@/lib/api";
import { requirePlatformOwner, requireSession } from "@/lib/guards";
import { hasPlatformOwner, isPlatformOwner } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { createTrainerApplicationSchema } from "@/lib/validation";

const APPLICANT_FIELDS = {
  id: true,
  walletAddress: true,
  displayName: true,
  bio: true,
  role: true,
  trainerStatus: true,
  trainerPitch: true,
  trainerRequestedAt: true,
  trainerReviewedAt: true,
  trainerReviewedBy: true,
  trainerReviewNote: true,
  createdAt: true,
  _count: { select: { ownedClassrooms: true, memberships: true } },
} as const;

/** Owner-only queue. Defaults to what still needs a decision. */
export const GET = route(async (request: Request) => {
  await requirePlatformOwner();

  const requested = new URL(request.url).searchParams.get("status");
  const statuses: TrainerStatus[] =
    requested === "PENDING" ||
    requested === "APPROVED" ||
    requested === "REJECTED"
      ? [requested]
      : ["PENDING"];

  const applications = await prisma.user.findMany({
    where: { trainerStatus: { in: [...statuses] } },
    select: APPLICANT_FIELDS,
    orderBy: { trainerRequestedAt: "asc" },
  });

  return json({ applications });
});

/** A signed-in user asking to teach. Grants nothing on its own. */
export const POST = route(async (request: Request) => {
  const session = await requireSession();
  const body = createTrainerApplicationSchema.parse(
    await parseJsonBody(request),
  );

  if (!hasPlatformOwner()) {
    throw badRequest(
      "No platform owner is configured, so trainer requests cannot be reviewed yet",
      "owner_not_configured",
    );
  }

  if (isPlatformOwner(session.address)) {
    throw badRequest(
      "You are the platform owner and already have trainer access",
      "is_platform_owner",
    );
  }

  const current = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { role: true, trainerStatus: true },
  });

  if (current.trainerStatus === "PENDING") {
    throw conflict("Your request is already waiting for review");
  }
  if (current.role === "TRAINER" && current.trainerStatus === "APPROVED") {
    throw conflict("You are already an approved trainer");
  }

  // Pending trainers hold the TRAINER role so they can sign in on the trainer
  // dashboard, but requireApprovedTrainer still refuses every write until the
  // owner moves this to APPROVED.
  const user = await prisma.user.update({
    where: { id: session.id },
    data: {
      role: "TRAINER",
      trainerStatus: "PENDING",
      trainerPitch: body.pitch,
      trainerRequestedAt: new Date(),
      trainerReviewedAt: null,
      trainerReviewedBy: null,
      trainerReviewNote: null,
    },
    select: APPLICANT_FIELDS,
  });

  return json({ application: user }, { status: 201 });
});

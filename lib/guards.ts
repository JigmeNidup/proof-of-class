import type { Classroom, ClassMembership, Role, User } from "@prisma/client";

import { auth } from "@/auth";
import { forbidden, notFound, unauthorized } from "@/lib/api";
import { isPlatformOwner } from "@/lib/platform";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  address: string;
  role: Role;
};

/**
 * Every write path goes through one of these. Route handlers never read a
 * wallet address out of the request body: the address always comes from the
 * signed session, so a caller cannot act on behalf of someone else.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) throw unauthorized();
  return {
    id: session.user.id,
    address: session.user.address,
    role: session.user.role,
  };
}

export async function requireUser(): Promise<User> {
  const sessionUser = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) throw unauthorized("Your account no longer exists");
  return user;
}

export async function getOptionalSession(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    address: session.user.address,
    role: session.user.role,
  };
}

/** The platform owner from env. Not a database role, so it cannot be granted. */
export async function requirePlatformOwner(): Promise<SessionUser> {
  const sessionUser = await requireSession();
  if (!isPlatformOwner(sessionUser.address)) {
    throw forbidden("Only the platform owner can do that");
  }
  return sessionUser;
}

/**
 * Gate for anything that creates a teaching surface.
 *
 * Trainer capability is re-read from the database instead of taken from the
 * session, because a JWT minted before approval would keep reporting TRAINEE -
 * and one minted before a revocation would keep reporting TRAINER.
 */
export async function requireApprovedTrainer(): Promise<SessionUser> {
  const sessionUser = await requireSession();

  // The owner runs the platform, so they never queue behind their own approval.
  if (isPlatformOwner(sessionUser.address)) return sessionUser;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true, trainerStatus: true },
  });

  if (user?.role !== "TRAINER" || user.trainerStatus !== "APPROVED") {
    throw forbidden(
      "The platform owner has to approve your trainer request first",
    );
  }

  return sessionUser;
}

/** The caller must be the trainer who created this classroom. */
export async function requireTrainerOf(
  classroomId: string,
): Promise<{ user: SessionUser; classroom: Classroom }> {
  const user = await requireSession();
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
  });
  if (!classroom) throw notFound("Classroom not found");
  if (classroom.creatorId !== user.id) {
    throw forbidden("You do not run this classroom");
  }
  return { user, classroom };
}

/** The caller must have an APPROVED membership, or be the classroom's trainer. */
export async function requireClassroomAccess(classroomId: string): Promise<{
  user: SessionUser;
  classroom: Classroom;
  membership: ClassMembership | null;
  isTrainer: boolean;
}> {
  const user = await requireSession();
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
  });
  if (!classroom) throw notFound("Classroom not found");

  const isTrainer = classroom.creatorId === user.id;
  const membership = await prisma.classMembership.findUnique({
    where: { userId_classroomId: { userId: user.id, classroomId } },
  });

  if (!isTrainer && membership?.status !== "APPROVED") {
    throw forbidden("You are not an approved member of this classroom");
  }

  return { user, classroom, membership, isTrainer };
}

export async function requireApprovedMember(
  classroomId: string,
): Promise<{ user: SessionUser; membership: ClassMembership }> {
  const user = await requireSession();
  const membership = await prisma.classMembership.findUnique({
    where: { userId_classroomId: { userId: user.id, classroomId } },
  });
  if (membership?.status !== "APPROVED") {
    throw forbidden("You are not an approved member of this classroom");
  }
  return { user, membership };
}

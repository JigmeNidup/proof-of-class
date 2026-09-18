import type { BadgeType } from "@prisma/client";

import { badRequest, json, route } from "@/lib/api";
import { requireClassroomAccess } from "@/lib/guards";
import { isLeaderboardPeriod, periodStart } from "@/lib/periods";
import { prisma } from "@/lib/prisma";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  walletAddress: string;
  displayName: string | null;
  avatarUrl: string | null;
  confirmedPoints: number;
  pendingPoints: number;
  totalPoints: number;
  badges: { WEEKLY: number; MONTHLY: number };
};

/**
 * Leaderboard for one classroom over a week / month / all-time window.
 *
 * Confirmed and pending awards are summed separately so a trainee sees a
 * transaction reflected the moment it is submitted, while the UI can still
 * distinguish what the chain has actually settled.
 */
export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const classroomId = url.searchParams.get("classroomId");
  if (!classroomId) throw badRequest("classroomId is required");

  const periodParam = url.searchParams.get("period") ?? "all";
  if (!isLeaderboardPeriod(periodParam)) {
    throw badRequest('period must be "week", "month" or "all"');
  }

  await requireClassroomAccess(classroomId);

  const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);
  const start = periodStart(periodParam);
  const createdAtFilter = start ? { createdAt: { gte: start } } : {};

  const [confirmed, pending] = await Promise.all([
    prisma.pointLog.groupBy({
      by: ["receiverId"],
      where: { classroomId, status: "CONFIRMED", ...createdAtFilter },
      _sum: { points: true },
    }),
    prisma.pointLog.groupBy({
      by: ["receiverId"],
      where: { classroomId, status: "PENDING", ...createdAtFilter },
      _sum: { points: true },
    }),
  ]);

  const totals = new Map<
    string,
    { confirmedPoints: number; pendingPoints: number }
  >();
  for (const row of confirmed) {
    totals.set(row.receiverId, {
      confirmedPoints: row._sum.points ?? 0,
      pendingPoints: 0,
    });
  }
  for (const row of pending) {
    const entry = totals.get(row.receiverId) ?? {
      confirmedPoints: 0,
      pendingPoints: 0,
    };
    entry.pendingPoints = row._sum.points ?? 0;
    totals.set(row.receiverId, entry);
  }

  const ordered = [...totals.entries()]
    .map(([userId, sums]) => ({
      userId,
      ...sums,
      totalPoints: sums.confirmedPoints + sums.pendingPoints,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, limit);

  const userIds = ordered.map((row) => row.userId);

  // Badge counts are always all-time for the classroom: the point total is
  // what changes per period, the trophy case does not.
  const [users, badgeGroups] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        walletAddress: true,
        displayName: true,
        avatarUrl: true,
      },
    }),
    prisma.badgeAward.groupBy({
      by: ["userId", "badgeType"],
      where: {
        classroomId,
        userId: { in: userIds },
        status: { not: "FAILED" },
      },
      _sum: { quantity: true },
    }),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const badgesByUser = new Map<string, Record<BadgeType, number>>();
  for (const group of badgeGroups) {
    const current = badgesByUser.get(group.userId) ?? {
      WEEKLY: 0,
      MONTHLY: 0,
    };
    current[group.badgeType] = group._sum.quantity ?? 0;
    badgesByUser.set(group.userId, current);
  }

  const rows: LeaderboardRow[] = ordered.map((row, index) => {
    const user = userById.get(row.userId);
    return {
      rank: index + 1,
      userId: row.userId,
      walletAddress: user?.walletAddress ?? "",
      displayName: user?.displayName ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      confirmedPoints: row.confirmedPoints,
      pendingPoints: row.pendingPoints,
      totalPoints: row.totalPoints,
      badges: badgesByUser.get(row.userId) ?? { WEEKLY: 0, MONTHLY: 0 },
    };
  });

  return json({
    period: periodParam,
    periodStart: start?.toISOString() ?? null,
    rows,
  });
});

"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { BadgeStackPair } from "@/components/badge-stack";
import { EmptyState, Panel, Pill, Spinner, Tabs } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import type { LeaderboardPeriod } from "@/lib/periods";
import { classNames, shortenAddress } from "@/lib/utils";

type LeaderboardRow = {
  rank: number;
  userId: string;
  walletAddress: string;
  displayName: string | null;
  confirmedPoints: number;
  pendingPoints: number;
  totalPoints: number;
  badges: { WEEKLY: number; MONTHLY: number };
};

type LeaderboardResponse = {
  period: LeaderboardPeriod;
  periodStart: string | null;
  rows: LeaderboardRow[];
};

const PERIOD_TABS: Array<{ value: LeaderboardPeriod; label: string }> = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

const RANK_ACCENT = ["text-amber-300", "text-slate-300", "text-orange-300"];

export function Leaderboard({
  classroomId,
  highlightUserId,
  initialPeriod = "week",
}: {
  classroomId: string;
  highlightUserId?: string;
  initialPeriod?: LeaderboardPeriod;
}) {
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.leaderboard(classroomId, period),
    queryFn: () =>
      apiFetch<LeaderboardResponse>(
        `/api/leaderboard?classroomId=${classroomId}&period=${period}`,
      ),
    // Points arrive from other people's transactions, so poll rather than
    // relying on this tab to have triggered the change.
    refetchInterval: 15_000,
  });

  return (
    <Panel
      title="Leaderboard"
      subtitle="Ranked by points awarded in the selected window."
      actions={<Tabs value={period} onChange={setPeriod} options={PERIOD_TABS} />}
    >
      {isPending && (
        <div className="flex items-center gap-2 py-8 text-sm text-ink-400">
          <Spinner /> Loading rankings…
        </div>
      )}

      {error && (
        <p className="py-6 text-sm text-red-400">
          {error instanceof Error ? error.message : "Could not load leaderboard"}
        </p>
      )}

      {data && data.rows.length === 0 && (
        <EmptyState
          title="No points yet"
          description="Once the trainer awards points they will appear here within seconds."
        />
      )}

      {data && data.rows.length > 0 && (
        <ol className="space-y-1.5">
          {data.rows.map((row) => (
            <li
              key={row.userId}
              className={classNames(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                row.userId === highlightUserId
                  ? "border-brand-400/50 bg-brand-400/10"
                  : "border-ink-700/60 bg-ink-900/40",
              )}
            >
              <span
                className={classNames(
                  "w-7 shrink-0 text-center text-sm font-bold tabular-nums",
                  RANK_ACCENT[row.rank - 1] ?? "text-ink-400",
                )}
              >
                {row.rank}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {row.displayName ?? shortenAddress(row.walletAddress)}
                  {row.userId === highlightUserId && (
                    <span className="ml-2 text-xs text-brand-400">you</span>
                  )}
                </p>
                <p className="truncate font-mono text-[0.6875rem] text-ink-400">
                  {row.walletAddress}
                </p>
              </div>

              {/* Both tiers shown together, each with its own count. */}
              <BadgeStackPair
                weekly={row.badges.WEEKLY}
                monthly={row.badges.MONTHLY}
                size={22}
              />

              <div className="w-24 shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-white">
                  {row.totalPoints.toLocaleString()}
                </p>
                {row.pendingPoints > 0 && (
                  <Pill tone="warning">
                    {row.pendingPoints.toLocaleString()} pending
                  </Pill>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";

import { BadgeStack } from "@/components/badge-stack";
import { Panel, Pill } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import { MONTHLY_TOKEN_ID, WEEKLY_TOKEN_ID } from "@/lib/badges";
import { classBadgesAbi } from "@/lib/contracts";
import type { BadgeAwardDto, ClassroomDto } from "@/lib/types";
import { checksumAddress } from "@/lib/utils";

/**
 * Badge counts come from the indexed database (fast, always available) and are
 * cross-checked against the ERC-1155 balances when a badge contract exists, so
 * a divergence between the mirror and the chain is visible rather than silent.
 */
export function MyBadges({
  classroom,
  userId,
  walletAddress,
}: {
  classroom: ClassroomDto;
  userId: string;
  walletAddress: string;
}) {
  const { data } = useQuery({
    queryKey: queryKeys.badges(classroom.id, userId),
    queryFn: () =>
      apiFetch<{ awards: BadgeAwardDto[] }>(
        `/api/badges/awards?classroomId=${classroom.id}&userId=${userId}`,
      ),
  });

  const awards = data?.awards ?? [];
  const weekly = awards
    .filter((a) => a.badgeType === "WEEKLY" && a.status !== "FAILED")
    .reduce((sum, a) => sum + a.quantity, 0);
  const monthly = awards
    .filter((a) => a.badgeType === "MONTHLY" && a.status !== "FAILED")
    .reduce((sum, a) => sum + a.quantity, 0);

  const onChain = useReadContract({
    address: (classroom.badgeAddress ?? undefined) as `0x${string}` | undefined,
    abi: classBadgesAbi,
    functionName: "balanceOfBatch",
    args: [
      [checksumAddress(walletAddress), checksumAddress(walletAddress)],
      [BigInt(WEEKLY_TOKEN_ID), BigInt(MONTHLY_TOKEN_ID)],
    ],
    query: { enabled: Boolean(classroom.badgeAddress && walletAddress) },
  });

  const chainBalances = onChain.data as readonly bigint[] | undefined;

  return (
    <Panel
      title="Your badges"
      subtitle="Repeat wins stack on one icon rather than filling your wallet with duplicates."
    >
      <div className="flex items-center gap-8 py-2">
        <BadgeStack badgeType="WEEKLY" count={weekly} size={52} showZero />
        <BadgeStack badgeType="MONTHLY" count={monthly} size={52} showZero />

        <div className="ml-auto text-right text-xs text-ink-400">
          {chainBalances ? (
            <>
              <p>
                on-chain: {Number(chainBalances[0])} weekly,{" "}
                {Number(chainBalances[1])} monthly
              </p>
              {(Number(chainBalances[0]) !== weekly ||
                Number(chainBalances[1]) !== monthly) && (
                <Pill tone="warning">indexer catching up</Pill>
              )}
            </>
          ) : (
            <p>no badge contract deployed yet</p>
          )}
        </div>
      </div>

      {awards.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-ink-800 pt-4">
          {awards.slice(0, 6).map((award) => (
            <li
              key={award.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-ink-300">
                {award.badgeType === "WEEKLY" ? "Weekly" : "Monthly"} ·{" "}
                {award.periodKey}
              </span>
              <Pill tone={award.status === "CONFIRMED" ? "success" : "warning"}>
                {award.status.toLowerCase()}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

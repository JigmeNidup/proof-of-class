"use client";

import type { BadgeType } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { BadgeIcon } from "@/components/badge-stack";
import { ChainGuard, useChainGuard } from "@/components/switch-network";
import { useTransaction } from "@/components/use-transaction";
import { Alert, Button, Field, Input, Panel, Pill, Select } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import { BADGE_VISUALS } from "@/lib/badges";
import { classBadgesAbi } from "@/lib/contracts";
import { periodKeyFor } from "@/lib/periods";
import type { ClassroomDto } from "@/lib/types";
import { checksumAddress, shortenAddress } from "@/lib/utils";

type LeaderboardRow = {
  userId: string;
  walletAddress: string;
  displayName: string | null;
  totalPoints: number;
};

/**
 * Mints a weekly or monthly badge to the period's top scorer. The recipient is
 * prefilled from the matching leaderboard, but stays editable so a trainer can
 * override a tie or a disqualification.
 */
export function AwardBadge({ classroom }: { classroom: ClassroomDto }) {
  const queryClient = useQueryClient();
  const tx = useTransaction();

  const [badgeType, setBadgeType] = useState<BadgeType>("WEEKLY");
  const [periodKey, setPeriodKey] = useState(() => periodKeyFor("week"));
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const period = badgeType === "WEEKLY" ? "week" : "month";

  const { data } = useQuery({
    queryKey: queryKeys.leaderboard(classroom.id, period),
    queryFn: () =>
      apiFetch<{ rows: LeaderboardRow[] }>(
        `/api/leaderboard?classroomId=${classroom.id}&period=${period}`,
      ),
  });

  const rows = data?.rows ?? [];
  const leader = rows[0];

  // Keep the period key and the suggested winner in step with the tier.
  useEffect(() => {
    setPeriodKey(periodKeyFor(period));
  }, [period]);

  useEffect(() => {
    if (leader && !recipient) setRecipient(leader.walletAddress);
  }, [leader, recipient]);

  const onChain = Boolean(classroom.badgeAddress);
  const visual = BADGE_VISUALS[badgeType];
  const { wrongChain } = useChainGuard(classroom.chainId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setSubmitting(true);

    try {
      let txHash: string | undefined;

      if (onChain) {
        setStatus("Confirm the badge mint in your wallet…");
        const receipt = await tx.send({
          address: classroom.badgeAddress as `0x${string}`,
          abi: classBadgesAbi,
          functionName:
            badgeType === "WEEKLY" ? "awardWeekly" : "awardMonthly",
          args: [checksumAddress(recipient), periodKey],
        });
        txHash = receipt.transactionHash;
      }

      setStatus("Recording the award…");
      await apiFetch("/api/badges/awards", {
        method: "POST",
        json: {
          classroomId: classroom.id,
          recipientAddress: recipient,
          badgeType,
          periodKey,
          txHash,
        },
      });

      setStatus(`${visual.label} awarded for ${periodKey}.`);
      await queryClient.invalidateQueries({
        queryKey: ["classroom", classroom.id],
      });
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : "Could not award badge");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel
      title="Award a badge"
      subtitle="One badge per tier per period — the database enforces it."
      actions={
        onChain ? (
          <Pill tone="success">on-chain</Pill>
        ) : (
          <Pill tone="warning">off-chain</Pill>
        )
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {onChain && <ChainGuard targetChainId={classroom.chainId} />}

        <div className="flex items-center gap-3 rounded-xl border border-ink-700/60 bg-ink-900/40 p-3">
          <BadgeIcon badgeType={badgeType} size={40} />
          <div>
            <p className="text-sm font-medium text-white">{visual.label}</p>
            <p className="text-xs text-ink-400">{visual.description}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tier">
            <Select
              value={badgeType}
              onChange={(e) => setBadgeType(e.target.value as BadgeType)}
            >
              <option value="WEEKLY">Weekly topper</option>
              <option value="MONTHLY">Monthly champion</option>
            </Select>
          </Field>

          <Field
            label="Period"
            hint={badgeType === "WEEKLY" ? "ISO week, e.g. 2026-W35" : "e.g. 2026-08"}
          >
            <Input
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value.trim())}
              required
            />
          </Field>
        </div>

        <Field
          label="Winner"
          hint={
            leader
              ? `Leading this ${period}: ${leader.displayName ?? shortenAddress(leader.walletAddress)} with ${leader.totalPoints} points.`
              : "No points recorded for this period yet."
          }
        >
          <Select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            required
          >
            <option value="">Select a winner…</option>
            {rows.map((row) => (
              <option key={row.userId} value={row.walletAddress}>
                {row.displayName ?? shortenAddress(row.walletAddress)} —{" "}
                {row.totalPoints} pts
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            loading={submitting}
            disabled={!recipient || (onChain && wrongChain)}
          >
            {onChain ? "Mint badge" : "Record badge"}
          </Button>
          {status && <span className="text-xs text-ink-400">{status}</span>}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Panel>
  );
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PointCategory } from "@prisma/client";
import { useState } from "react";

import { ChainGuard, useChainGuard } from "@/components/switch-network";
import { useTransaction } from "@/components/use-transaction";
import {
  Alert,
  Button,
  Field,
  Input,
  Panel,
  Pill,
  Select,
  Textarea,
} from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import { classroomTokenAbi } from "@/lib/contracts";
import { NOTE_MAX_LENGTH, type PointsPrefill } from "@/lib/quick-call-award";
import {
  categoryToUint8,
  POINT_CATEGORIES,
  type ClassroomDto,
  type MembershipDto,
} from "@/lib/types";
import { checksumAddress, pointsToWei, shortenAddress } from "@/lib/utils";

/**
 * Awards points to one trainee.
 *
 * When the classroom has a token deployed this mints on-chain first and only
 * then records the transaction hash, so the database never claims an award the
 * chain rejected. Without a token it falls back to an off-chain adjustment.
 *
 * `prefill` arrives when the trainer picks a winner out of the quick-call
 * ranking. The caller remounts this component per selection, so the values are
 * only ever used as initial state and stay freely editable.
 */
export function AwardPoints({
  classroom,
  prefill,
}: {
  classroom: ClassroomDto;
  prefill?: PointsPrefill | null;
}) {
  const queryClient = useQueryClient();
  const tx = useTransaction();

  const [receiverAddress, setReceiverAddress] = useState(
    prefill?.receiverAddress ?? "",
  );
  const [points, setPoints] = useState(10);
  const [category, setCategory] = useState<PointCategory>("CLASS");
  const [note, setNote] = useState(prefill?.note ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data } = useQuery({
    queryKey: queryKeys.members(classroom.id, "APPROVED"),
    queryFn: () =>
      apiFetch<{ members: MembershipDto[] }>(
        `/api/classrooms/${classroom.id}/members?status=APPROVED`,
      ),
  });

  const approved = (data?.members ?? []).filter((m) => m.status === "APPROVED");
  const onChain = Boolean(classroom.tokenAddress);
  const { wrongChain } = useChainGuard(classroom.chainId);

  // A prefilled address may not be in the roster - the trainee could have been
  // removed after answering - and a Select whose value matches no option
  // renders blank, which would look like the prefill silently failed.
  const rosterLoaded = Boolean(data);
  const inRoster = approved.some(
    (m) =>
      m.user.walletAddress.toLowerCase() === receiverAddress.toLowerCase(),
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setSubmitting(true);

    try {
      let txHash: string | undefined;

      if (onChain) {
        setStatus("Confirm the mint in your wallet…");
        const receipt = await tx.send({
          address: classroom.tokenAddress as `0x${string}`,
          abi: classroomTokenAbi,
          functionName: "awardPoints",
          args: [
            checksumAddress(receiverAddress),
            pointsToWei(points, classroom.tokenDecimals),
            categoryToUint8(category),
            note || "",
          ],
        });
        txHash = receipt.transactionHash;
      }

      setStatus("Recording the award…");
      await apiFetch("/api/points", {
        method: "POST",
        json: {
          classroomId: classroom.id,
          receiverAddress,
          points,
          category,
          note: note || undefined,
          txHash,
        },
      });

      setStatus(
        onChain
          ? "Minted. The indexer will mark it confirmed shortly."
          : "Recorded as an off-chain adjustment.",
      );
      setNote("");
      await queryClient.invalidateQueries({
        queryKey: ["classroom", classroom.id],
      });
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : "Could not award points");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel
      title="Award points"
      subtitle={
        onChain
          ? "Mints ERC-20 points straight to the trainee's wallet."
          : "No token deployed yet — awards will be recorded off-chain only."
      }
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

        {prefill && (
          <Alert tone="info">
            Prefilled from the quick-call ranking. Adjust the points, category
            or note before you {onChain ? "mint" : "record"}.
          </Alert>
        )}

        <Field
          label="Trainee"
          hint={
            approved.length === 0
              ? "Approve a join request first."
              : undefined
          }
        >
          <Select
            value={receiverAddress}
            onChange={(e) => setReceiverAddress(e.target.value)}
            required
          >
            <option value="">Select a trainee…</option>
            {receiverAddress && !inRoster && (
              <option value={receiverAddress}>
                {shortenAddress(receiverAddress, 6)}
                {rosterLoaded ? " — no longer in the roster" : ""}
              </option>
            )}
            {approved.map((membership) => (
              <option
                key={membership.id}
                value={membership.user.walletAddress}
              >
                {membership.user.displayName ??
                  shortenAddress(membership.user.walletAddress)}{" "}
                — {shortenAddress(membership.user.walletAddress, 6)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Points">
            <Input
              type="number"
              min={1}
              max={1000000}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              required
            />
          </Field>

          <Field label="Category">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as PointCategory)}
            >
              {POINT_CATEGORIES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Note"
          hint={`Stored on-chain in the award event. ${
            NOTE_MAX_LENGTH - note.length
          } characters left.`}
        >
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX_LENGTH}
            placeholder="Solved the reentrancy exercise first"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            loading={submitting}
            disabled={!receiverAddress || points < 1 || (onChain && wrongChain)}
          >
            {onChain ? "Mint points" : "Record points"}
          </Button>
          {status && <span className="text-xs text-ink-400">{status}</span>}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Panel>
  );
}

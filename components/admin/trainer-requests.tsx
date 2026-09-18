"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  Alert,
  Button,
  EmptyState,
  Input,
  Panel,
  Pill,
  Spinner,
  Tabs,
} from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import type { TrainerApplicationDto } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED";

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Trainers" },
  { value: "REJECTED", label: "Declined" },
];

export function TrainerRequests() {
  const [status, setStatus] = useState<StatusFilter>("PENDING");

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.trainerApplications(status),
    queryFn: () =>
      apiFetch<{ applications: TrainerApplicationDto[] }>(
        `/api/trainer-applications?status=${status}`,
      ),
  });

  const applications = data?.applications ?? [];

  return (
    <Panel
      title="Trainer requests"
      subtitle="Approving grants the trainer role. Nothing else in the app can."
      actions={<Tabs value={status} onChange={setStatus} options={FILTERS} />}
    >
      <div className="space-y-3">
        {isPending && (
          <div className="flex items-center gap-2 py-8 text-sm text-ink-400">
            <Spinner /> Loading requests…
          </div>
        )}

        {error && (
          <Alert tone="danger">
            {error instanceof Error ? error.message : "Could not load requests"}
          </Alert>
        )}

        {data && applications.length === 0 && (
          <EmptyState
            title={
              status === "PENDING"
                ? "Nothing waiting"
                : status === "APPROVED"
                  ? "No trainers yet"
                  : "Nothing declined"
            }
            description={
              status === "PENDING"
                ? "New requests show up here as soon as they are submitted."
                : undefined
            }
          />
        )}

        {applications.map((application) => (
          <RequestRow
            key={application.id}
            application={application}
            status={status}
          />
        ))}
      </div>
    </Panel>
  );
}

function RequestRow({
  application,
  status,
}: {
  application: TrainerApplicationDto;
  status: StatusFilter;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const review = useMutation({
    mutationFn: (decision: "APPROVED" | "REJECTED") =>
      apiFetch(`/api/trainer-applications/${application.id}`, {
        method: "PATCH",
        json: { status: decision, note: note.trim() || undefined },
      }),
    onSuccess: async () => {
      // Prefix match, so the row leaves this tab and appears in the other one.
      await queryClient.invalidateQueries({
        queryKey: ["trainer-applications"],
      });
    },
  });

  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {application.displayName ??
              shortenAddress(application.walletAddress, 6)}
          </p>
          <p className="mt-0.5 break-all font-mono text-xs text-ink-400">
            {application.walletAddress}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {application.trainerRequestedAt && (
            <Pill>
              {new Date(application.trainerRequestedAt).toLocaleDateString()}
            </Pill>
          )}
          {status === "APPROVED" && (
            <Pill tone="success">
              {application._count?.ownedClassrooms ?? 0} classrooms
            </Pill>
          )}
        </div>
      </div>

      {application.trainerPitch && (
        <p className="mt-3 whitespace-pre-wrap border-l-2 border-ink-700 pl-3 text-sm text-ink-300">
          {application.trainerPitch}
        </p>
      )}

      {status === "REJECTED" ? (
        <p className="mt-3 text-xs text-ink-400">
          {application.trainerReviewNote
            ? `Declined: ${application.trainerReviewNote}`
            : "Declined."}{" "}
          They can submit a fresh request whenever they like.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder={
              status === "PENDING"
                ? "Optional note shown to the applicant"
                : "Reason for revoking"
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            {status === "PENDING" && (
              <Button
                size="sm"
                loading={review.isPending}
                onClick={() => review.mutate("APPROVED")}
              >
                Approve
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              loading={review.isPending}
              onClick={() => review.mutate("REJECTED")}
            >
              {status === "PENDING" ? "Decline" : "Revoke trainer"}
            </Button>
          </div>

          {status === "APPROVED" && (
            <p className="text-xs text-ink-400">
              Revoking removes the role and blocks new classrooms. Classrooms
              they already deployed keep working - those contracts are owned by
              their wallet, not by the platform.
            </p>
          )}

          {review.error && (
            <Alert tone="danger">
              {review.error instanceof Error
                ? review.error.message
                : "Could not save the decision"}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";

import {
  Alert,
  Button,
  Field,
  Panel,
  Pill,
  Textarea,
} from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import { hasPlatformOwner, PLATFORM_OWNER_ADDRESS } from "@/lib/platform";
import type { UserDto } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";

const MIN_PITCH = 20;

/**
 * What a trainer sees before the platform owner has approved them: the request
 * form, or the waiting room. Signing in as a trainer is allowed at this point -
 * creating anything is not, and the API enforces that independently.
 */
export function TrainerApplication({
  user,
  onRefresh,
}: {
  user: UserDto;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const { update } = useSession();
  const [pitch, setPitch] = useState("");

  const apply = useMutation({
    mutationFn: () =>
      apiFetch("/api/trainer-applications", {
        method: "POST",
        json: { pitch: pitch.trim() },
      }),
    onSuccess: async () => {
      setPitch("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      // JWT still says TRAINEE until we pull the new role into the session.
      await update();
      onRefresh();
    },
  });

  if (user.trainerStatus === "PENDING") {
    return (
      <Panel
        title="Request pending"
        subtitle="The platform owner has to approve you before you can run a classroom."
        actions={<Pill tone="warning">awaiting approval</Pill>}
      >
        <div className="space-y-4">
          <Alert tone="info">
            You are signed in as a trainer, but classroom creation stays locked
            until the owner approves. Nothing else is needed from you.
          </Alert>

          <dl className="space-y-2 text-sm">
            <Row
              label="Submitted"
              value={
                user.trainerRequestedAt
                  ? new Date(user.trainerRequestedAt).toLocaleString()
                  : "—"
              }
            />
            <Row
              label="Reviewer"
              value={
                PLATFORM_OWNER_ADDRESS
                  ? shortenAddress(PLATFORM_OWNER_ADDRESS, 6)
                  : "not configured"
              }
            />
          </dl>

          {user.trainerPitch && (
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">
                Your request
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-300">
                {user.trainerPitch}
              </p>
            </div>
          )}

          <Button size="sm" variant="secondary" onClick={onRefresh}>
            Check for approval
          </Button>
        </div>
      </Panel>
    );
  }

  const rejected = user.trainerStatus === "REJECTED";

  return (
    <Panel
      title={rejected ? "Request declined" : "Apply to run classrooms"}
      subtitle={
        rejected
          ? "You can revise your request and submit it again."
          : "Trainers mint points and badges, so the platform owner reviews every request."
      }
      actions={rejected && <Pill tone="danger">declined</Pill>}
    >
      <div className="space-y-4">
        {!hasPlatformOwner() && (
          <Alert tone="warning">
            No platform owner is configured, so nobody can approve requests. Set{" "}
            <code className="font-mono">
              NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS
            </code>{" "}
            in <code className="font-mono">.env</code> and rebuild.
          </Alert>
        )}

        {rejected && user.trainerReviewNote && (
          <Alert tone="danger">
            <span className="font-semibold">Owner&apos;s note:</span>{" "}
            {user.trainerReviewNote}
          </Alert>
        )}

        <Field
          label="Why do you want to teach here?"
          hint={`Shown to the platform owner. At least ${MIN_PITCH} characters.`}
        >
          <Textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="I run the Blockchain Foundations cohort at CST and want to reward participation on-chain."
          />
        </Field>

        <Button
          loading={apply.isPending}
          disabled={
            !hasPlatformOwner() || pitch.trim().length < MIN_PITCH
          }
          onClick={() => apply.mutate()}
        >
          {rejected ? "Submit a new request" : "Send request"}
        </Button>

        {apply.error && (
          <Alert tone="danger">
            {apply.error instanceof Error
              ? apply.error.message
              : "Could not send the request"}
          </Alert>
        )}
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="font-mono text-xs text-ink-300">{value}</dd>
    </div>
  );
}

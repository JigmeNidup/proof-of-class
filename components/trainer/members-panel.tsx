"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MembershipStatus } from "@prisma/client";

import { Button, EmptyState, Panel, Pill, Spinner } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import type { MembershipDto } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";

const STATUS_TONE = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REMOVED: "neutral",
} as const;

export function MembersPanel({ classroomId }: { classroomId: string }) {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: queryKeys.members(classroomId),
    queryFn: () =>
      apiFetch<{ members: MembershipDto[] }>(
        `/api/classrooms/${classroomId}/members`,
      ),
    refetchInterval: 20_000,
  });

  const update = useMutation({
    mutationFn: (input: { membershipId: string; status: MembershipStatus }) =>
      apiFetch(
        `/api/classrooms/${classroomId}/members/${input.membershipId}`,
        { method: "PATCH", json: { status: input.status } },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["classroom", classroomId],
      });
    },
  });

  const members = data?.members ?? [];
  const pending = members.filter((m) => m.status === "PENDING");
  const others = members.filter((m) => m.status !== "PENDING");

  return (
    <div className="space-y-4">
      <Panel
        title="Join requests"
        subtitle={
          pending.length > 0
            ? `${pending.length} trainee${pending.length === 1 ? "" : "s"} waiting for approval.`
            : "Nothing waiting."
        }
      >
        {isPending && <Spinner />}

        {!isPending && pending.length === 0 && (
          <EmptyState
            title="No pending requests"
            description="Share the join code and requests will show up here."
          />
        )}

        <ul className="space-y-2">
          {pending.map((membership) => (
            <li
              key={membership.id}
              className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {membership.user.displayName ??
                    shortenAddress(membership.user.walletAddress)}
                </p>
                <p className="truncate font-mono text-[0.6875rem] text-ink-400">
                  {membership.user.walletAddress}
                </p>
              </div>
              <Button
                size="sm"
                loading={update.isPending}
                onClick={() =>
                  update.mutate({
                    membershipId: membership.id,
                    status: "APPROVED",
                  })
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  update.mutate({
                    membershipId: membership.id,
                    status: "REJECTED",
                  })
                }
              >
                Reject
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Roster" subtitle={`${others.length} in total.`}>
        {others.length === 0 ? (
          <EmptyState title="No members yet" />
        ) : (
          <ul className="divide-y divide-ink-800">
            {others.map((membership) => (
              <li
                key={membership.id}
                className="flex items-center gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">
                    {membership.user.displayName ??
                      shortenAddress(membership.user.walletAddress)}
                  </p>
                  <p className="truncate font-mono text-[0.6875rem] text-ink-400">
                    {membership.user.walletAddress}
                  </p>
                </div>
                <Pill tone={STATUS_TONE[membership.status]}>
                  {membership.status.toLowerCase()}
                </Pill>
                {membership.status === "APPROVED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      update.mutate({
                        membershipId: membership.id,
                        status: "REMOVED",
                      })
                    }
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Button, Field, Input, Panel, Pill } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import type { UserDto } from "@/lib/types";

/**
 * Profile editing only. The role is not self-selectable: minting points and
 * badges is a position of trust, so it is granted by the platform owner through
 * the trainer request flow on /trainer.
 */
export function ProfileCard() {
  const queryClient = useQueryClient();
  const { update } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data } = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<{ user: UserDto }>("/api/users/me"),
  });

  useEffect(() => {
    if (data?.user && !dirty) setDisplayName(data.user.displayName ?? "");
  }, [data, dirty]);

  const save = useMutation({
    mutationFn: (input: { displayName?: string }) =>
      apiFetch<{ user: UserDto }>("/api/users/me", {
        method: "PATCH",
        json: input,
      }),
    onSuccess: async () => {
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      // Refresh the JWT so the header nav and API guards see the new role.
      await update();
    },
  });

  const user = data?.user;

  return (
    <Panel
      title="Your profile"
      subtitle="The name shown on leaderboards and quick-call results."
      actions={
        user && (
          <Pill
            tone={
              user.trainerStatus === "PENDING"
                ? "warning"
                : user.trainerStatus === "APPROVED"
                  ? "success"
                  : "info"
            }
          >
            {user.trainerStatus === "PENDING"
              ? "pending trainer"
              : user.role.toLowerCase()}
          </Pill>
        )
      }
    >
      <div className="space-y-4">
        <p className="break-all font-mono text-xs text-ink-400">
          {user?.walletAddress}
        </p>

        <Field label="Display name">
          <Input
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setDirty(true);
            }}
            placeholder="Sonam Dorji"
            maxLength={60}
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={save.isPending}
            disabled={!dirty || displayName.trim().length === 0}
            onClick={() => save.mutate({ displayName: displayName.trim() })}
          >
            Save name
          </Button>

        </div>

        {user && user.role !== "TRAINER" && (
          <p className="text-xs text-ink-400">
            {user.trainerStatus === "PENDING"
              ? "Your trainer request is waiting for the platform owner."
              : "Want to run a classroom?"}{" "}
            <Link href="/trainer" className="text-brand-400 hover:underline">
              {user.trainerStatus === "PENDING"
                ? "View the request"
                : "Apply on the trainer page"}
            </Link>
            .
          </p>
        )}

        {save.error && (
          <Alert tone="danger">
            {save.error instanceof Error ? save.error.message : "Save failed"}
          </Alert>
        )}
      </div>
    </Panel>
  );
}

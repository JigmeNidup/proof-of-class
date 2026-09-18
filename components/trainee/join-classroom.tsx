"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, Button, Field, Input, Panel } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import { normalizeJoinCode } from "@/lib/utils";

type JoinResponse = {
  classroom: { id: string; name: string; autoApprove: boolean };
  membership: { status: string };
  alreadyMember: boolean;
};

export function JoinClassroom() {
  const queryClient = useQueryClient();
  const [joinCode, setJoinCode] = useState("");
  const [result, setResult] = useState<JoinResponse | null>(null);

  const join = useMutation({
    mutationFn: () =>
      apiFetch<JoinResponse>("/api/classrooms/join", {
        method: "POST",
        json: { joinCode: normalizeJoinCode(joinCode) },
      }),
    onSuccess: (data) => {
      setResult(data);
      setJoinCode("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.classrooms });
    },
  });

  return (
    <Panel
      title="Join a classroom"
      subtitle="Enter the code your trainer gave you."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setResult(null);
          join.mutate();
        }}
      >
        <Field label="Join code">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="DEMO24"
            maxLength={16}
            minLength={4}
            required
            className="text-center font-mono text-lg tracking-[0.3em]"
          />
        </Field>

        <Button type="submit" loading={join.isPending} className="w-full">
          Join
        </Button>

        {join.error && (
          <Alert tone="danger">
            {join.error instanceof Error
              ? join.error.message
              : "Could not join"}
          </Alert>
        )}

        {result && (
          <Alert
            tone={result.membership.status === "APPROVED" ? "success" : "info"}
          >
            {result.alreadyMember
              ? `You are already in ${result.classroom.name}.`
              : result.membership.status === "APPROVED"
                ? `You are in ${result.classroom.name}.`
                : `Request sent to ${result.classroom.name}. Waiting for the trainer to approve you.`}
          </Alert>
        )}
      </form>
    </Panel>
  );
}

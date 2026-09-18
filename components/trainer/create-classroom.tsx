"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, Button, Field, Input, Panel, Textarea } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";

export function CreateClassroom() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      apiFetch<{ classroom: { id: string; joinCode: string } }>(
        "/api/classrooms",
        {
          method: "POST",
          json: {
            name,
            description: description || undefined,
            tokenSymbol: tokenSymbol || undefined,
            autoApprove,
          },
        },
      ),
    onSuccess: () => {
      setName("");
      setDescription("");
      setTokenSymbol("");
      setAutoApprove(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.classrooms });
    },
  });

  return (
    <Panel
      title="New classroom"
      subtitle="Creates the off-chain record and a join code. Contracts are deployed separately."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Classroom name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Blockchain Foundations"
            minLength={3}
            maxLength={80}
            required
          />
        </Field>

        <Field label="Description" hint="Optional. Shown to trainees.">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="Twelve-week cohort covering wallets, Solidity and token design."
          />
        </Field>

        <Field
          label="Points ticker"
          hint="2-8 letters or digits, used as the ERC-20 symbol. Defaults to a generated one."
        >
          <Input
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
            placeholder="BFP"
            maxLength={8}
            pattern="[A-Za-z0-9]{2,8}"
          />
        </Field>

        <label className="flex items-center gap-2.5 text-sm text-ink-300">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="size-4 rounded border-ink-600 bg-ink-900"
          />
          Let anyone with the code join instantly (skip approval)
        </label>

        {create.error && (
          <Alert tone="danger">
            {create.error instanceof Error
              ? create.error.message
              : "Could not create classroom"}
          </Alert>
        )}

        <Button type="submit" loading={create.isPending}>
          Create classroom
        </Button>
      </form>
    </Panel>
  );
}

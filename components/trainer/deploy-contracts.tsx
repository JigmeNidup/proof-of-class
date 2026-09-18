"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { parseEventLogs } from "viem";
import { useConnection } from "wagmi";

import { ChainGuard, useChainGuard } from "@/components/switch-network";
import { useTransaction } from "@/components/use-transaction";
import { Alert, Button, Panel, Pill } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import {
  CHAIN,
  classroomFactoryAbi,
  FACTORY_ADDRESS,
  explorerAddressUrl,
  hasFactory,
} from "@/lib/contracts";
import type { ClassroomDto } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";

/**
 * Deploys this classroom's ERC-20 and ERC-1155 through the factory. The
 * trainer's wallet is the deployer, so it - not the platform - ends up owning
 * both contracts and holding the only minting key.
 */
export function DeployContracts({ classroom }: { classroom: ClassroomDto }) {
  const queryClient = useQueryClient();
  const { address } = useConnection();
  const tx = useTransaction();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const deployed = Boolean(classroom.tokenAddress && classroom.badgeAddress);
  const { wrongChain } = useChainGuard(classroom.chainId);

  async function handleDeploy() {
    setSaveError(null);
    const symbol =
      classroom.tokenSymbol ??
      classroom.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase() ??
      "PTS";

    try {
      const receipt = await tx.send({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: classroomFactoryAbi,
        functionName: "createClassroom",
        args: [
          classroom.name,
          symbol,
          `${window.location.origin}/api/metadata/badges/`,
        ],
      });

      const [event] = parseEventLogs({
        abi: classroomFactoryAbi,
        logs: receipt.logs,
        eventName: "ClassroomDeployed",
      });
      if (!event) throw new Error("Deployment event not found in receipt");

      setSaving(true);
      await apiFetch(`/api/classrooms/${classroom.id}`, {
        method: "PATCH",
        json: {
          tokenAddress: event.args.token,
          badgeAddress: event.args.badges,
          tokenSymbol: symbol,
          deployedBlock: Number(receipt.blockNumber),
        },
      });

      await queryClient.invalidateQueries({
        queryKey: queryKeys.classroom(classroom.id),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.classrooms });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Deployment failed",
      );
    } finally {
      setSaving(false);
    }
  }

  if (deployed) {
    return (
      <Panel
        title="Contracts"
        subtitle={`Owned by your wallet on ${CHAIN.name}.`}
      >
        <dl className="space-y-2 text-sm">
          <ContractRow
            label="Points (ERC-20)"
            address={classroom.tokenAddress!}
          />
          <ContractRow
            label="Badges (ERC-1155)"
            address={classroom.badgeAddress!}
          />
        </dl>
      </Panel>
    );
  }

  return (
    <Panel
      title="Deploy contracts"
      subtitle="One transaction deploys both the points token and the badge collection."
    >
      {!hasFactory() && (
        <Alert tone="warning">
          NEXT_PUBLIC_FACTORY_ADDRESS is not set. Run{" "}
          <code className="font-mono">npm run contracts:deploy</code> and
          restart the dev server.
        </Alert>
      )}

      {hasFactory() && <ChainGuard targetChainId={classroom.chainId} />}

      <div className="mt-4 space-y-3">
        <p className="text-sm text-ink-400">
          Deploying from {address ? shortenAddress(address) : "your wallet"}{" "}
          makes it the sole minter of both contracts.
        </p>

        <Button
          onClick={handleDeploy}
          loading={tx.isBusy || saving}
          disabled={!hasFactory() || wrongChain || !address}
        >
          {tx.phase === "signing"
            ? "Confirm in wallet…"
            : tx.phase === "mining"
              ? "Waiting for confirmation…"
              : "Deploy token + badges"}
        </Button>

        {(tx.error || saveError) && (
          <Alert tone="danger">{tx.error ?? saveError}</Alert>
        )}
      </div>
    </Panel>
  );
}

function ContractRow({ label, address }: { label: string; address: string }) {
  const href = explorerAddressUrl(address);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="flex items-center gap-2">
        <Pill>{shortenAddress(address, 6)}</Pill>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-400 hover:underline"
          >
            explorer
          </a>
        )}
      </dd>
    </div>
  );
}

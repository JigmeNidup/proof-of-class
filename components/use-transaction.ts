"use client";

import { useCallback, useState } from "react";
import type { Abi, Hash, TransactionReceipt } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";

export type TxPhase = "idle" | "signing" | "mining" | "done" | "error";

/**
 * Submit a contract call and wait for its receipt in one await.
 *
 * Every on-chain action here is "write, then persist the hash", so the caller
 * needs the receipt inline rather than through a separate hook's state.
 */
export function useTransaction() {
  const publicClient = usePublicClient();
  const write = useWriteContract();
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [hash, setHash] = useState<Hash | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (request: {
      address: `0x${string}`;
      abi: Abi | readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }): Promise<TransactionReceipt> => {
      setError(null);
      setPhase("signing");
      setHash(null);

      try {
        const txHash = await write.mutateAsync({
          address: request.address,
          abi: request.abi as Abi,
          functionName: request.functionName,
          args: request.args as never,
        });
        setHash(txHash);
        setPhase("mining");

        if (!publicClient) throw new Error("No RPC client available");
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (receipt.status !== "success") {
          throw new Error("Transaction reverted on chain");
        }

        setPhase("done");
        return receipt;
      } catch (cause) {
        const message = extractRevertMessage(cause);
        setError(message);
        setPhase("error");
        throw new Error(message);
      }
    },
    [publicClient, write],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setHash(null);
    setError(null);
  }, []);

  return {
    send,
    reset,
    phase,
    hash,
    error,
    isBusy: phase === "signing" || phase === "mining",
  };
}

/** Wallet errors are verbose; surface the first meaningful line. */
function extractRevertMessage(cause: unknown): string {
  if (!(cause instanceof Error)) return "Transaction failed";

  const shortMessage = (cause as { shortMessage?: string }).shortMessage;
  if (shortMessage) return shortMessage;

  const [firstLine] = cause.message.split("\n");
  return firstLine || "Transaction failed";
}

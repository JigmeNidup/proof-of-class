"use client";

import { hardhat, sepolia } from "viem/chains";
import { useConnection, useSwitchChain } from "wagmi";

import { Alert, Button } from "@/components/ui";

const SUPPORTED = [hardhat, sepolia];

export function chainName(chainId: number): string {
  return SUPPORTED.find((chain) => chain.id === chainId)?.name ?? `chain ${chainId}`;
}

/**
 * MetaMask rejects a switch to a network it has never seen, so pass the full
 * chain description along and wagmi will fall back to wallet_addEthereumChain.
 */
function addChainParameter(chainId: number) {
  const chain = SUPPORTED.find((entry) => entry.id === chainId);
  if (!chain) return undefined;

  return {
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: [...chain.rpcUrls.default.http],
    blockExplorerUrls: chain.blockExplorers?.default
      ? [chain.blockExplorers.default.url]
      : undefined,
  };
}

export function useChainGuard(targetChainId: number) {
  const { chainId, isConnected } = useConnection();

  return {
    chainId,
    // Undefined while the connector is still resolving; treating that as
    // "wrong" would flash a warning on every page load.
    wrongChain: isConnected && chainId !== undefined && chainId !== targetChainId,
    isConnected,
  };
}

export function SwitchNetworkButton({
  targetChainId,
  size = "sm",
}: {
  targetChainId: number;
  size?: "sm" | "md";
}) {
  const switchChain = useSwitchChain();

  return (
    <Button
      size={size}
      variant="secondary"
      loading={switchChain.isPending}
      onClick={() =>
        switchChain.mutate({
          chainId: targetChainId as 31337 | 11155111,
          addEthereumChainParameter: addChainParameter(targetChainId),
        })
      }
    >
      Switch to {chainName(targetChainId)}
    </Button>
  );
}

/**
 * Renders nothing when the wallet is already on the right chain, so it can be
 * dropped in front of any write action.
 */
export function ChainGuard({ targetChainId }: { targetChainId: number }) {
  const { wrongChain, chainId } = useChainGuard(targetChainId);
  const switchChain = useSwitchChain();

  if (!wrongChain) return null;

  return (
    <Alert tone="warning">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          Your wallet is on {chainName(chainId!)}, but this classroom lives on{" "}
          {chainName(targetChainId)}.
        </span>
        <SwitchNetworkButton targetChainId={targetChainId} />
      </div>
      {switchChain.error && (
        <p className="mt-2 text-xs">
          {switchChain.error.message.split("\n")[0]}
          {targetChainId === hardhat.id && (
            <>
              {" "}
              Make sure <code className="font-mono">npm run chain</code> is
              running.
            </>
          )}
        </p>
      )}
    </Alert>
  );
}

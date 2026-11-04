"use client";

import { getCsrfToken, signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSiweMessage } from "viem/siwe";
import {
  useConnection,
  useConnect,
  useConnectors,
  useDisconnect,
  useSignMessage,
  type Connector,
} from "wagmi";

import { Alert, Button, Pill } from "@/components/ui";
import { APP_CHAIN_ID } from "@/lib/wagmi";
import { shortenAddress } from "@/lib/utils";

/**
 * In-app browsers inject window.ethereum after `ethereum#initialized`.
 * A normal phone browser never does.
 */
function waitForInjectedProvider(timeoutMs: number): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
  if (ethereum) return Promise.resolve(true);

  return new Promise((resolve) => {
    const finish = (found: boolean) => {
      window.removeEventListener("ethereum#initialized", onReady);
      window.clearTimeout(timer);
      resolve(found);
    };
    const onReady = () => {
      finish(Boolean((window as Window & { ethereum?: unknown }).ethereum));
    };
    window.addEventListener("ethereum#initialized", onReady, { once: true });
    const timer = window.setTimeout(
      () =>
        finish(Boolean((window as Window & { ethereum?: unknown }).ethereum)),
      timeoutMs,
    );
  });
}

function explainConnectError(message: string): string {
  if (/provider not found/i.test(message)) {
    return "This browser has no wallet built in. Choose a wallet to open its app, or open this page from the wallet's own browser.";
  }
  return message;
}

/**
 * The generic "injected" connector throws when nothing is installed. Hide it
 * once a named wallet is available, and keep one button per wallet name so
 * MetaMask's extension and its app connector are not listed twice.
 */
function visibleConnectors(connectors: readonly Connector[]) {
  const named = connectors.filter((connector) => connector.id !== "injected");
  const source = named.length > 0 ? named : connectors;
  const byName = new Map<string, Connector>();
  for (const connector of source) {
    const key = connector.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing || (connector.type === "injected" && existing.type !== "injected")) {
      byName.set(key, connector);
    }
  }
  return [...byName.values()];
}

/**
 * Two-step onboarding: connect a wallet, then prove ownership of the address
 * by signing an EIP-4361 message. The signature is exchanged for an Auth.js
 * session cookie, which is what every API route and the websocket handshake
 * actually check.
 */
export function ConnectWallet({
  redirectTo,
  compact = false,
}: {
  redirectTo?: string;
  /** Header: one button that opens the wallet list. */
  compact?: boolean;
}) {
  const router = useRouter();
  const { address, isConnected, chainId } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const signMessage = useSignMessage();
  const { data: session, status } = useSession();

  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const choices = visibleConnectors(connectors);

  useEffect(() => {
    setReady(true);
  }, []);
  const isAuthenticated = status === "authenticated";
  const sessionMatchesWallet =
    isAuthenticated &&
    address &&
    session?.user?.address?.toLowerCase() === address.toLowerCase();

  async function handleSignIn() {
    if (!address) return;
    setError(null);
    setSigningIn(true);

    try {
      const nonce = await getCsrfToken();
      if (!nonce) throw new Error("Could not obtain a sign-in nonce");

      const message = createSiweMessage({
        address,
        chainId: chainId ?? APP_CHAIN_ID,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: "1",
        statement:
          "Sign in to ProofOfClass. This proves you control this wallet and costs no gas.",
        issuedAt: new Date(),
      });

      const signature = await signMessage.mutateAsync({ message });

      const result = await signIn("siwe", {
        message,
        signature,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Signature rejected by the server");
      }

      router.refresh();
      if (redirectTo) router.push(redirectTo);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not complete sign-in",
      );
    } finally {
      setSigningIn(false);
    }
  }

  async function handleConnect(connector: Connector) {
    setError(null);
    setPendingId(connector.uid);
    try {
      if (connector.id === "injected") {
        const hasProvider = await waitForInjectedProvider(1_500);
        if (!hasProvider) throw new Error("Provider not found.");
      }
      await connect.mutateAsync({ connector });
      setOpen(false);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not connect the wallet";
      setError(explainConnectError(message));
    } finally {
      setPendingId(null);
    }
  }

  async function handleSignOut() {
    await signOut({ redirect: false });
    disconnect.mutate({});
    router.refresh();
  }

  if (!isConnected) {
    const list = (
      <div className="flex flex-col gap-2">
        {choices.map((connector) => (
          <Button
            key={connector.uid}
            variant="secondary"
            className="w-full"
            onClick={() => handleConnect(connector)}
            loading={pendingId === connector.uid}
            disabled={pendingId !== null && pendingId !== connector.uid}
          >
            {connector.name}
          </Button>
        ))}
      </div>
    );

    if (!ready) {
      return (
        <Button variant="secondary" disabled>
          Connect wallet
        </Button>
      );
    }

    if (compact) {
      return (
        <div className="relative">
          <Button variant="secondary" onClick={() => setOpen((value) => !value)}>
            Connect wallet
          </Button>
          {open && (
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-lg shadow-black/40">
              {list}
              {error && (
                <div className="mt-2">
                  <Alert tone="danger">{error}</Alert>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {list}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    );
  }

  if (!sessionMatchesWallet) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-ink-300">
          <Pill tone="info">{shortenAddress(address ?? "")}</Pill>
          <span className="text-ink-400">connected, not verified</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSignIn} loading={signingIn}>
            Sign in with Ethereum
          </Button>
          <Button variant="secondary" onClick={() => disconnect.mutate({})}>
            Disconnect
          </Button>
        </div>
        {isAuthenticated && !sessionMatchesWallet && (
          <Alert tone="warning">
            Your session belongs to a different wallet. Sign in again to switch.
          </Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Pill tone="success">{shortenAddress(address ?? "")}</Pill>
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  );
}

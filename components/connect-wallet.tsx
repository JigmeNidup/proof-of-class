"use client";

import { getCsrfToken, signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSiweMessage } from "viem/siwe";
import {
  useConnection,
  useConnect,
  useConnectors,
  useDisconnect,
  useSignMessage,
} from "wagmi";

import { Alert, Button, Pill } from "@/components/ui";
import { APP_CHAIN_ID } from "@/lib/wagmi";
import { shortenAddress } from "@/lib/utils";

/**
 * Two-step onboarding: connect an injected wallet, then prove ownership of the
 * address by signing an EIP-4361 message. The signature is exchanged for an
 * Auth.js session cookie, which is what every API route and the websocket
 * handshake actually check.
 */
export function ConnectWallet({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const { address, isConnected, chainId } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const signMessage = useSignMessage();
  const { data: session, status } = useSession();

  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const injected = connectors.find((c) => c.type === "injected") ?? connectors[0];
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

  async function handleSignOut() {
    await signOut({ redirect: false });
    disconnect.mutate({});
    router.refresh();
  }

  if (!isConnected) {
    return (
      <div className="space-y-3">
        <Button
          onClick={() => injected && connect.mutate({ connector: injected })}
          loading={connect.isPending}
          disabled={!injected}
        >
          {injected ? "Connect MetaMask" : "No wallet detected"}
        </Button>
        {!injected && (
          <Alert tone="warning">
            No injected wallet found. Install MetaMask, then reload this page.
          </Alert>
        )}
        {connect.error && <Alert tone="danger">{connect.error.message}</Alert>}
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

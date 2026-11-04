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
 * Phone browsers never inject window.ethereum. MetaMask's in-app browser does,
 * but only after `ethereum#initialized`. Wait briefly, then fall back to the
 * MetaMask app deeplink.
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
    return "This browser has no wallet built in. On a phone, Connect opens the MetaMask app. Install MetaMask if it does not open, or open this page from MetaMask's browser.";
  }
  return message;
}

/**
 * Two-step onboarding: connect a wallet, then prove ownership of the address
 * by signing an EIP-4361 message. The signature is exchanged for an Auth.js
 * session cookie, which is what every API route and the websocket handshake
 * actually check.
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
  const [connecting, setConnecting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
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

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const hasProvider = await waitForInjectedProvider(1_500);
      const connector = hasProvider
        ? connectors.find((item) => item.id === "injected")
        : connectors.find((item) => item.id === "metaMaskSDK");
      if (!connector) throw new Error("MetaMask connector is not available.");
      await connect.mutateAsync({ connector });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not connect the wallet";
      setError(explainConnectError(message));
    } finally {
      setConnecting(false);
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
        <Button onClick={handleConnect} loading={connecting || connect.isPending}>
          Connect MetaMask
        </Button>
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

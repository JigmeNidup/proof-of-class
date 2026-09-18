"use client";

import { useSession } from "next-auth/react";
import type { ReactNode } from "react";

import { ConnectWallet } from "@/components/connect-wallet";
import { Panel, Spinner } from "@/components/ui";

/** Renders children only for a signed-in wallet; otherwise prompts for SIWE. */
export function AuthGate({
  children,
  title = "Connect your wallet",
  description = "Sign in with Ethereum to continue.",
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-ink-400">
        <Spinner /> Checking your session…
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-md py-10">
        <Panel title={title} subtitle={description}>
          <ConnectWallet />
        </Panel>
      </div>
    );
  }

  return <>{children}</>;
}

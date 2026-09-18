"use client";

import { useSession } from "next-auth/react";

import { TrainerRequests } from "@/components/admin/trainer-requests";
import { AuthGate } from "@/components/auth-gate";
import { SiteHeader } from "@/components/site-header";
import { Alert, Panel, Pill } from "@/components/ui";
import {
  hasPlatformOwner,
  isPlatformOwner,
  PLATFORM_OWNER_ADDRESS,
} from "@/lib/platform";
import { shortenAddress } from "@/lib/utils";

export default function AdminPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <AuthGate
          title="Platform owner sign-in"
          description="Connect the wallet configured as the platform owner."
        >
          <AdminHome />
        </AuthGate>
      </main>
    </div>
  );
}

function AdminHome() {
  const { data: session } = useSession();
  const address = session?.user?.address;

  if (!hasPlatformOwner()) {
    return (
      <Alert tone="warning">
        No platform owner is configured. Set{" "}
        <code className="font-mono">NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS</code> in{" "}
        <code className="font-mono">.env</code> to a wallet you control, then
        rebuild and restart.
      </Alert>
    );
  }

  // The API checks this too - the session address is what actually authorizes
  // the request, not this branch.
  if (!isPlatformOwner(address)) {
    return (
      <Panel title="Not the platform owner">
        <p className="text-sm text-ink-400">
          You are signed in as{" "}
          <span className="font-mono text-ink-300">
            {address ? shortenAddress(address, 6) : "an unknown wallet"}
          </span>
          . This dashboard belongs to{" "}
          <span className="font-mono text-ink-300">
            {shortenAddress(PLATFORM_OWNER_ADDRESS!, 6)}
          </span>
          . Switch accounts in MetaMask and sign in again.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Platform owner
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Pill tone="info">
            owner {shortenAddress(PLATFORM_OWNER_ADDRESS!, 6)}
          </Pill>
          <span className="text-sm text-ink-400">
            Decide who is allowed to run classrooms.
          </span>
        </div>
      </header>

      <TrainerRequests />
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

import { ConnectWallet } from "@/components/connect-wallet";
import { SiteHeader } from "@/components/site-header";
import { Alert, Panel } from "@/components/ui";

export default function SignInPage() {
  const { status } = useSession();

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-md px-5 py-16">
        <Panel
          title="Sign in with your wallet"
          subtitle="No password, no email. You sign a message to prove the address is yours."
        >
          <ol className="mb-5 space-y-2 text-sm text-ink-400">
            <li>1. Connect MetaMask.</li>
            <li>2. Sign the ProofOfClass message. This is free — no gas.</li>
            <li>3. Join a classroom with the code your trainer gave you.</li>
          </ol>

          <ConnectWallet redirectTo="/dashboard" />

          {status === "authenticated" && (
            <div className="mt-5 space-y-3">
              <Alert tone="success">You are signed in.</Alert>
              <div className="flex gap-3 text-sm">
                <Link href="/dashboard" className="text-brand-400 hover:underline">
                  Go to trainee dashboard
                </Link>
                <Link href="/trainer" className="text-brand-400 hover:underline">
                  Go to trainer dashboard
                </Link>
              </div>
            </div>
          )}
        </Panel>
      </main>
    </div>
  );
}

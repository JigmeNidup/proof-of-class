"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ConnectWallet } from "@/components/connect-wallet";
import { useSocket } from "@/components/socket-provider";
import {
  SwitchNetworkButton,
  useChainGuard,
} from "@/components/switch-network";
import { CHAIN, CHAIN_ID } from "@/lib/contracts";
import { isPlatformOwner } from "@/lib/platform";
import { classNames } from "@/lib/utils";

export function SiteHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { connected } = useSocket();
  const { wrongChain } = useChainGuard(CHAIN_ID);

  const links = [
    { href: "/dashboard", label: "Trainee" },
    {
      href: "/trainer",
      label:
        session?.user?.trainerStatus === "PENDING"
          ? "Trainer (pending)"
          : "Trainer",
    },
    ...(isPlatformOwner(session?.user?.address)
      ? [{ href: "/admin", label: "Admin" }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-brand-500 text-xs font-black text-white">
            PC
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            ProofOfClass
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={classNames(
                "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                pathname.startsWith(link.href)
                  ? "bg-ink-800 text-white"
                  : "text-ink-400 hover:text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {wrongChain && <SwitchNetworkButton targetChainId={CHAIN_ID} />}
          <span className="hidden items-center gap-1.5 text-xs text-ink-400 sm:flex">
            <span
              className={classNames(
                "size-1.5 rounded-full",
                connected ? "bg-emerald-400" : "bg-ink-600",
              )}
              title={connected ? "Realtime connected" : "Realtime offline"}
            />
            {CHAIN.name}
          </span>
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}

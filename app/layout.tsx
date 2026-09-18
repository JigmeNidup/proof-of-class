import type { Metadata } from "next";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";

import { Providers } from "@/app/providers";
import { wagmiConfig } from "@/lib/wagmi";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofOfClass",
  description:
    "On-chain classroom rewards: ERC-20 points, weekly and monthly badge NFTs, and live quick-call events.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialState = cookieToInitialState(
    wagmiConfig,
    (await headers()).get("cookie"),
  );

  return (
    <html lang="en">
      <body className="antialiased">
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  );
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { WagmiProvider, type State } from "wagmi";

import { SocketProvider } from "@/components/socket-provider";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: State;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <WagmiProvider config={wagmiConfig} initialState={initialState}>
        <QueryClientProvider client={queryClient}>
          <SocketProvider>{children}</SocketProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}

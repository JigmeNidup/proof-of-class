import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const APP_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? hardhat.id,
);

export const wagmiConfig = createConfig({
  chains: [hardhat, sepolia],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [hardhat.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545",
    ),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

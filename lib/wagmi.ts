import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

export const APP_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? hardhat.id,
);

// The MetaMask mobile connector treats the first chain as the one to open
// on. Keep the configured network first so a phone is not sent to localhost.
const chains =
  APP_CHAIN_ID === sepolia.id ? ([sepolia, hardhat] as const) : ([hardhat, sepolia] as const);

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    // Desktop extension and the MetaMask in-app browser. Mobile injects
    // window.ethereum after the page loads, so wait for that event.
    injected({ shimDisconnect: true, unstable_shimAsyncInject: 2_000 }),
    // Phone browsers (Safari, Chrome) have no injected provider. This
    // connector opens the MetaMask app instead of throwing ProviderNotFound.
    // Default mobile links are https://metamask.app.link universal links.
    metaMask({
      dapp: { name: "ProofOfClass" },
    }),
  ],
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

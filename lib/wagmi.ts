import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { coinbaseWallet, injected, metaMask, walletConnect } from "wagmi/connectors";

export const APP_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? hardhat.id,
);

// The MetaMask mobile connector treats the first chain as the one to open
// on. Keep the configured network first so a phone is not sent to localhost.
const chains =
  APP_CHAIN_ID === sepolia.id ? ([sepolia, hardhat] as const) : ([hardhat, sepolia] as const);

const appOrigin =
  typeof window === "undefined"
    ? (process.env.AUTH_URL ?? "https://class.jigmenidup.site")
    : window.location.origin;

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    // Browser extensions and in-app wallets. Each EIP-6963 wallet (Rabby,
    // Trust, Brave, …) shows up on its own. Mobile injects late.
    injected({ shimDisconnect: true, unstable_shimAsyncInject: 2_000 }),
    // Phone browsers have no injected provider. These open the wallet app.
    metaMask({
      dapp: { name: "ProofOfClass" },
    }),
    coinbaseWallet({
      appName: "ProofOfClass",
      preference: { options: "eoaOnly" },
    }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata: {
              name: "ProofOfClass",
              description: "On-chain classroom rewards",
              url: appOrigin,
              icons: [`${appOrigin}/favicon.ico`],
            },
          }),
        ]
      : []),
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

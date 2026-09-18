import { hardhat, sepolia } from "viem/chains";

export { classBadgesAbi, classroomFactoryAbi, classroomTokenAbi } from "./abis";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? hardhat.id);

export const CHAIN = CHAIN_ID === sepolia.id ? sepolia : hardhat;

export const RPC_URL =
  CHAIN_ID === sepolia.id
    ? (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
      "https://ethereum-sepolia-rpc.publicnode.com")
    : (process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545");

/**
 * Written into .env by `npm run contracts:deploy`. Empty until the factory has
 * been deployed, which the trainer dashboard surfaces as a setup warning
 * instead of failing at transaction time.
 */
export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  "") as `0x${string}` | "";

export function hasFactory(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(FACTORY_ADDRESS);
}

export function explorerTxUrl(txHash: string): string | null {
  if (CHAIN_ID !== sepolia.id) return null;
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string | null {
  if (CHAIN_ID !== sepolia.id) return null;
  return `https://sepolia.etherscan.io/address/${address}`;
}

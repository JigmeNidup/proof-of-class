/**
 * Deploys ClassroomFactory and records the address for the app.
 *
 * Uses viem rather than `hardhat run` so the same script works against a local
 * node or a public RPC without pulling ts-node into the toolchain.
 *
 *   npm run chain              # terminal 1 (local only)
 *   npm run contracts:deploy   # terminal 2
 */
import "dotenv/config";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, sepolia } from "viem/chains";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);
const chain = chainId === sepolia.id ? sepolia : hardhat;
const rpcUrl =
  chainId === sepolia.id
    ? (process.env.SEPOLIA_RPC_URL ??
      "https://ethereum-sepolia-rpc.publicnode.com")
    : (process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545");

const privateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!privateKey) {
  throw new Error("DEPLOYER_PRIVATE_KEY is not set. Copy .env.example to .env.");
}

const artifactPath = join(
  root,
  "artifacts",
  "contracts",
  "ClassroomFactory.sol",
  "ClassroomFactory.json",
);
if (!existsSync(artifactPath)) {
  throw new Error(
    "Contract artifacts missing. Run `npm run contracts:compile` first.",
  );
}

const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
  abi: unknown[];
  bytecode: Hex;
};

/** Hardhat account #0, the value that ships in .env.example. */
const HARDHAT_ACCOUNT_0 =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/**
 * A public chain gives no useful error for an unfunded or throwaway key - the
 * deploy just reverts or hangs - so fail loudly before spending a nonce.
 */
async function preflight(
  publicClient: ReturnType<typeof createPublicClient>,
  address: Hex,
) {
  if (chainId === hardhat.id) return;

  if (privateKey!.toLowerCase() === HARDHAT_ACCOUNT_0) {
    throw new Error(
      `DEPLOYER_PRIVATE_KEY is still Hardhat's public test key. It is known to ` +
        `everyone and holds no ${chain.name} ETH.\n` +
        `Replace it in .env with a private key from a wallet you control.`,
    );
  }

  const balance = await publicClient.getBalance({ address });
  console.log(`  balance:  ${formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(
      `${address} has no ${chain.name} ETH, so it cannot pay for gas.\n` +
        `Fund it from a faucet, then re-run:\n` +
        `  https://www.alchemy.com/faucets/ethereum-sepolia\n` +
        `  https://cloud.google.com/application/web3/faucet/ethereum/sepolia`,
    );
  }
}

async function main() {
  const account = privateKeyToAccount(privateKey!);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  console.log(`Deploying ClassroomFactory`);
  console.log(`  network:  ${chain.name} (${chainId})`);
  console.log(`  rpc:      ${rpcUrl}`);
  console.log(`  deployer: ${account.address}`);

  await preflight(publicClient, account.address);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [],
  });
  console.log(`  tx:       ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  if (!address) throw new Error("Deployment produced no contract address.");

  console.log(`  factory:  ${address}`);
  console.log(`  block:    ${receipt.blockNumber}`);

  const deploymentsPath = join(root, "lib", "contracts", "deployments.json");
  const existing: Record<string, unknown> = existsSync(deploymentsPath)
    ? JSON.parse(readFileSync(deploymentsPath, "utf8"))
    : {};

  existing[String(chainId)] = {
    chainId,
    factory: address,
    deployedBlock: Number(receipt.blockNumber),
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(
    deploymentsPath,
    `${JSON.stringify(existing, null, 2)}\n`,
    "utf8",
  );
  console.log(`\nWrote ${deploymentsPath}`);

  updateEnvFile(address);
}

/** Keeps NEXT_PUBLIC_FACTORY_ADDRESS in .env in sync with the last deploy. */
function updateEnvFile(address: string) {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) {
    console.log(
      `\nNo .env found. Add NEXT_PUBLIC_FACTORY_ADDRESS="${address}" manually.`,
    );
    return;
  }

  const contents = readFileSync(envPath, "utf8");
  const line = `NEXT_PUBLIC_FACTORY_ADDRESS="${address}"`;
  const next = /^NEXT_PUBLIC_FACTORY_ADDRESS=.*$/m.test(contents)
    ? contents.replace(/^NEXT_PUBLIC_FACTORY_ADDRESS=.*$/m, line)
    : `${contents.trimEnd()}\n${line}\n`;

  writeFileSync(envPath, next, "utf8");
  console.log(`Updated NEXT_PUBLIC_FACTORY_ADDRESS in .env`);
  console.log(`Restart the dev server so Next picks up the new value.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

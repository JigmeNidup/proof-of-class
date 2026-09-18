/**
 * Funds an address on the local Hardhat node.
 *
 * Hardhat only pre-funds its own deterministic accounts, so a personal MetaMask
 * address starts at zero and cannot pay gas. Rather than forcing you to import
 * a Hardhat key - which would change the wallet your database rows are keyed
 * on - this tops up the address you are already signed in with.
 *
 *   npm run fund -- 0xYourAddress
 *   npm run fund -- 0xYourAddress 500      # custom amount in ETH
 *
 * Refuses to run against anything but chain 31337.
 */
import "dotenv/config";

import {
  createTestClient,
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  isAddress,
  parseEther,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

const target = process.argv[2];
const amountEth = process.argv[3] ?? "1000";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

async function main() {
  if (!target || !isAddress(target)) {
    console.error("Usage: npm run fund -- 0xYourAddress [amountInEth]");
    process.exit(1);
  }

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: hardhat, transport });

  let chainId: number;
  try {
    chainId = await publicClient.getChainId();
  } catch {
    console.error(`Could not reach a node at ${rpcUrl}.`);
    console.error("Start one first with: npm run chain");
    process.exit(1);
  }

  if (chainId !== hardhat.id) {
    console.error(
      `Refusing to run: connected chain is ${chainId}, not the local ${hardhat.id}.`,
    );
    console.error(
      "Balances cannot be minted on a public network. Use a faucet instead:",
    );
    console.error("  https://www.alchemy.com/faucets/ethereum-sepolia");
    console.error(
      "  https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
    );
    process.exit(1);
  }

  const value = parseEther(amountEth);
  const before = await publicClient.getBalance({ address: target });

  console.log(`Funding ${target}`);
  console.log(`  rpc:     ${rpcUrl}`);
  console.log(`  before:  ${formatEther(before)} ETH`);

  // setBalance is instant and costs no gas from any account. If the node does
  // not expose it, fall back to a plain transfer from the deployer.
  try {
    const testClient = createTestClient({
      chain: hardhat,
      mode: "hardhat",
      transport,
    });
    await testClient.setBalance({ address: target, value });
    console.log(`  method:  hardhat_setBalance`);
  } catch {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
    if (!privateKey) {
      console.error(
        "hardhat_setBalance unavailable and DEPLOYER_PRIVATE_KEY is not set.",
      );
      process.exit(1);
    }

    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({
      account,
      chain: hardhat,
      transport,
    });
    const hash = await walletClient.sendTransaction({ to: target, value });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  method:  transfer from ${account.address}`);
    console.log(`  tx:      ${hash}`);
  }

  const after = await publicClient.getBalance({ address: target });
  console.log(`  after:   ${formatEther(after)} ETH`);
  console.log("\nDone. Refresh the app - MetaMask may take a moment to update.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

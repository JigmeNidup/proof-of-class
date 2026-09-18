/**
 * Blockchain event indexer.
 *
 * Polls each deployed classroom contract for PointsAwarded and BadgeAwarded
 * logs and reconciles them into Postgres:
 *
 *   - a PENDING row written by the API at submit time is promoted to CONFIRMED
 *   - an award made outside the UI (directly against the contract) is inserted
 *
 * Every write is keyed on (txHash, logIndex), so re-running from an older block
 * is safe and cannot double-count.
 *
 *   npm run indexer
 */
import "dotenv/config";

import { PrismaClient, type BadgeType, type PointCategory } from "@prisma/client";
import { createPublicClient, http, type Address, type Log } from "viem";
import { hardhat, sepolia } from "viem/chains";

import { classBadgesAbi, classroomTokenAbi } from "../lib/contracts/abis";
import { badgeTypeForTokenId } from "../lib/badges";
import { normalizeAddress } from "../lib/utils";

const prisma = new PrismaClient();

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);
const CHAIN = CHAIN_ID === sepolia.id ? sepolia : hardhat;
const RPC_URL =
  CHAIN_ID === sepolia.id
    ? (process.env.SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
      "https://ethereum-sepolia-rpc.publicnode.com")
    : (process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545");

const POLL_INTERVAL_MS = Number(process.env.INDEXER_POLL_INTERVAL_MS ?? 4000);
const BLOCK_RANGE = BigInt(process.env.INDEXER_BLOCK_RANGE ?? 2000);

const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

const CATEGORY_BY_INDEX: Record<number, PointCategory> = {
  0: "CLASS",
  1: "PROJECT",
  2: "PUBLIC_VOTE",
};

type TrackedClassroom = {
  id: string;
  tokenAddress: Address;
  badgeAddress: Address | null;
  tokenDecimals: number;
  deployedBlock: bigint;
};

async function loadClassrooms(): Promise<TrackedClassroom[]> {
  const rows = await prisma.classroom.findMany({
    where: { chainId: CHAIN_ID, tokenAddress: { not: null } },
    select: {
      id: true,
      tokenAddress: true,
      badgeAddress: true,
      tokenDecimals: true,
      deployedBlock: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    tokenAddress: row.tokenAddress as Address,
    badgeAddress: (row.badgeAddress ?? null) as Address | null,
    tokenDecimals: row.tokenDecimals,
    deployedBlock: row.deployedBlock ?? 0n,
  }));
}

async function getCursor(
  contractAddress: string,
  fallbackBlock: bigint,
): Promise<bigint> {
  const cursor = await prisma.indexerCursor.findUnique({
    where: {
      chainId_contractAddress: {
        chainId: CHAIN_ID,
        contractAddress: normalizeAddress(contractAddress),
      },
    },
  });
  return cursor?.lastBlock ?? fallbackBlock;
}

async function setCursor(
  contractAddress: string,
  lastBlock: bigint,
): Promise<void> {
  const address = normalizeAddress(contractAddress);
  await prisma.indexerCursor.upsert({
    where: {
      chainId_contractAddress: { chainId: CHAIN_ID, contractAddress: address },
    },
    update: { lastBlock },
    create: { chainId: CHAIN_ID, contractAddress: address, lastBlock },
  });
}

/** Resolves a wallet to a user, creating a placeholder if it never signed in. */
async function resolveUserId(wallet: string): Promise<string> {
  const address = normalizeAddress(wallet);
  const user = await prisma.user.upsert({
    where: { walletAddress: address },
    update: {},
    create: { walletAddress: address, role: "TRAINEE" },
  });
  return user.id;
}

async function handlePointsAwarded(
  classroom: TrackedClassroom,
  log: Log & {
    args: { to?: Address; amount?: bigint; category?: number; note?: string };
  },
): Promise<void> {
  const { to, amount, category, note } = log.args;
  if (!to || amount === undefined || !log.transactionHash) return;

  const txHash = log.transactionHash.toLowerCase();
  const logIndex = log.logIndex ?? 0;
  const receiverWallet = normalizeAddress(to);
  const points = Number(amount / 10n ** BigInt(classroom.tokenDecimals));

  // Match the optimistic row the API wrote when the trainer submitted the tx.
  const pending = await prisma.pointLog.findFirst({
    where: {
      classroomId: classroom.id,
      txHash,
      status: "PENDING",
      logIndex: null,
    },
  });

  if (pending) {
    await prisma.pointLog.update({
      where: { id: pending.id },
      data: {
        status: "CONFIRMED",
        logIndex,
        blockNumber: log.blockNumber ?? undefined,
        confirmedAt: new Date(),
      },
    });
    console.log(
      `  confirmed ${points} pts -> ${receiverWallet} (${txHash.slice(0, 10)}…)`,
    );
    return;
  }

  // Awarded straight against the contract, with no API record. Backfill it.
  const existing = await prisma.pointLog.findUnique({
    where: { txHash_logIndex: { txHash, logIndex } },
  });
  if (existing) return;

  await prisma.pointLog.create({
    data: {
      classroomId: classroom.id,
      receiverId: await resolveUserId(receiverWallet),
      receiverWallet,
      points,
      amountWei: amount.toString(),
      category: CATEGORY_BY_INDEX[category ?? 0] ?? "CLASS",
      note: note || "Indexed from chain",
      status: "CONFIRMED",
      txHash,
      logIndex,
      blockNumber: log.blockNumber ?? undefined,
      confirmedAt: new Date(),
    },
  });
  console.log(`  backfilled ${points} pts -> ${receiverWallet}`);
}

async function handleBadgeAwarded(
  classroom: TrackedClassroom,
  log: Log & {
    args: {
      to?: Address;
      tokenId?: bigint;
      quantity?: bigint;
      periodKey?: string;
    };
  },
): Promise<void> {
  const { to, tokenId, quantity, periodKey } = log.args;
  if (!to || tokenId === undefined || !log.transactionHash) return;

  const badgeType: BadgeType | null = badgeTypeForTokenId(Number(tokenId));
  if (!badgeType) return;

  const txHash = log.transactionHash.toLowerCase();
  const logIndex = log.logIndex ?? 0;
  const recipientWallet = normalizeAddress(to);

  const pending = await prisma.badgeAward.findFirst({
    where: {
      classroomId: classroom.id,
      txHash,
      status: "PENDING",
      logIndex: null,
    },
  });

  if (pending) {
    await prisma.badgeAward.update({
      where: { id: pending.id },
      data: { status: "CONFIRMED", logIndex },
    });
    console.log(`  confirmed ${badgeType} badge -> ${recipientWallet}`);
    return;
  }

  const existing = await prisma.badgeAward.findFirst({
    where: {
      OR: [
        { txHash, logIndex },
        {
          classroomId: classroom.id,
          badgeType,
          periodKey: periodKey ?? "unknown",
        },
      ],
    },
  });
  if (existing) return;

  await prisma.badgeAward.create({
    data: {
      classroomId: classroom.id,
      userId: await resolveUserId(recipientWallet),
      recipientWallet,
      badgeType,
      tokenId: Number(tokenId),
      quantity: Number(quantity ?? 1n),
      periodKey: periodKey ?? "unknown",
      status: "CONFIRMED",
      txHash,
      logIndex,
    },
  });
  console.log(`  backfilled ${badgeType} badge -> ${recipientWallet}`);
}

async function scanClassroom(
  classroom: TrackedClassroom,
  headBlock: bigint,
): Promise<void> {
  const from = await getCursor(classroom.tokenAddress, classroom.deployedBlock);
  if (from > headBlock) return;

  // Cap the window so a cold start against a public RPC cannot exceed its
  // per-request log limit.
  const to = from + BLOCK_RANGE > headBlock ? headBlock : from + BLOCK_RANGE;

  const pointLogs = await publicClient.getContractEvents({
    address: classroom.tokenAddress,
    abi: classroomTokenAbi,
    eventName: "PointsAwarded",
    fromBlock: from,
    toBlock: to,
  });

  for (const log of pointLogs) {
    await handlePointsAwarded(classroom, log as never);
  }

  if (classroom.badgeAddress) {
    const badgeLogs = await publicClient.getContractEvents({
      address: classroom.badgeAddress,
      abi: classBadgesAbi,
      eventName: "BadgeAwarded",
      fromBlock: from,
      toBlock: to,
    });

    for (const log of badgeLogs) {
      await handleBadgeAwarded(classroom, log as never);
    }
  }

  await setCursor(classroom.tokenAddress, to + 1n);
}

let running = true;

async function tick(): Promise<void> {
  const classrooms = await loadClassrooms();
  if (classrooms.length === 0) return;

  const headBlock = await publicClient.getBlockNumber();

  for (const classroom of classrooms) {
    try {
      await scanClassroom(classroom, headBlock);
    } catch (error) {
      // One bad contract must not stall the others.
      console.error(`[indexer] classroom ${classroom.id} failed`, error);
    }
  }
}

async function main(): Promise<void> {
  console.log("ProofOfClass indexer");
  console.log(`  network: ${CHAIN.name} (${CHAIN_ID})`);
  console.log(`  rpc:     ${RPC_URL}`);
  console.log(`  poll:    every ${POLL_INTERVAL_MS}ms\n`);

  while (running) {
    try {
      await tick();
    } catch (error) {
      console.error("[indexer] poll failed", error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log("\nShutting down indexer…");
    running = false;
    void prisma.$disconnect().then(() => process.exit(0));
  });
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

import { PrismaClient, type PointCategory } from "@prisma/client";

import { BADGE_TOKEN_IDS } from "../lib/badges";
import { isoWeekKey, monthKey, startOfIsoWeek } from "../lib/periods";
import { normalizeAddress, pointsToWei } from "../lib/utils";

const prisma = new PrismaClient();

// Hardhat's deterministic dev accounts. Import their private keys into
// MetaMask to click through the app locally.
const TRAINER = {
  address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  displayName: "Dr. Karma Wangchuk",
};

const TRAINEES = [
  { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", displayName: "Sonam Dorji" },
  { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", displayName: "Pema Lhamo" },
  { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", displayName: "Tashi Norbu" },
  { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", displayName: "Kinley Zam" },
];

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);

async function main() {
  const trainer = await prisma.user.upsert({
    where: { walletAddress: normalizeAddress(TRAINER.address) },
    update: {
      role: "TRAINER",
      trainerStatus: "APPROVED",
      displayName: TRAINER.displayName,
    },
    create: {
      walletAddress: normalizeAddress(TRAINER.address),
      role: "TRAINER",
      trainerStatus: "APPROVED",
      displayName: TRAINER.displayName,
      bio: "Runs the Blockchain Foundations cohort.",
    },
  });

  const trainees = [];
  for (const t of TRAINEES) {
    trainees.push(
      await prisma.user.upsert({
        where: { walletAddress: normalizeAddress(t.address) },
        update: { displayName: t.displayName },
        create: {
          walletAddress: normalizeAddress(t.address),
          role: "TRAINEE",
          displayName: t.displayName,
        },
      }),
    );
  }

  const classroom = await prisma.classroom.upsert({
    where: { joinCode: "DEMO24" },
    update: {},
    create: {
      name: "Blockchain Foundations",
      description:
        "Hands-on cohort covering Solidity, wallets, and token design.",
      joinCode: "DEMO24",
      chainId: CHAIN_ID,
      creatorId: trainer.id,
      autoApprove: false,
    },
  });

  // First three trainees are in; the last one is waiting for approval so the
  // trainer dashboard has something to act on.
  for (const [index, trainee] of trainees.entries()) {
    const approved = index < 3;
    await prisma.classMembership.upsert({
      where: {
        userId_classroomId: { userId: trainee.id, classroomId: classroom.id },
      },
      update: {},
      create: {
        userId: trainee.id,
        classroomId: classroom.id,
        status: approved ? "APPROVED" : "PENDING",
        approvedAt: approved ? new Date() : null,
        approvedById: approved ? trainer.id : null,
      },
    });
  }

  const weekStart = startOfIsoWeek();
  const categories: PointCategory[] = ["CLASS", "PROJECT", "PUBLIC_VOTE"];

  // Off-chain demo history so leaderboards are populated before any real
  // transaction is sent. Marked CONFIRMED with no txHash.
  const existingPoints = await prisma.pointLog.count({
    where: { classroomId: classroom.id },
  });

  if (existingPoints === 0) {
    let dayOffset = 0;
    for (const [index, trainee] of trainees.slice(0, 3).entries()) {
      for (let n = 0; n < 3; n += 1) {
        const points = 20 + index * 15 + n * 5;
        const createdAt = new Date(
          weekStart.getTime() + dayOffset * 12 * 60 * 60 * 1000,
        );
        dayOffset += 1;

        await prisma.pointLog.create({
          data: {
            classroomId: classroom.id,
            receiverId: trainee.id,
            receiverWallet: trainee.walletAddress,
            awardedById: trainer.id,
            points,
            amountWei: pointsToWei(points).toString(),
            category: categories[n % categories.length],
            note: "Seeded demo award",
            status: "CONFIRMED",
            confirmedAt: createdAt,
            createdAt,
          },
        });
      }
    }
  }

  // Two badges for the current periods, so BadgeStack renders counts.
  const topTrainee = trainees[2];
  await prisma.badgeAward.upsert({
    where: {
      classroomId_badgeType_periodKey: {
        classroomId: classroom.id,
        badgeType: "WEEKLY",
        periodKey: isoWeekKey(),
      },
    },
    update: {},
    create: {
      classroomId: classroom.id,
      userId: topTrainee.id,
      recipientWallet: topTrainee.walletAddress,
      badgeType: "WEEKLY",
      tokenId: BADGE_TOKEN_IDS.WEEKLY,
      periodKey: isoWeekKey(),
      status: "CONFIRMED",
    },
  });

  await prisma.badgeAward.upsert({
    where: {
      classroomId_badgeType_periodKey: {
        classroomId: classroom.id,
        badgeType: "MONTHLY",
        periodKey: monthKey(),
      },
    },
    update: {},
    create: {
      classroomId: classroom.id,
      userId: topTrainee.id,
      recipientWallet: topTrainee.walletAddress,
      badgeType: "MONTHLY",
      tokenId: BADGE_TOKEN_IDS.MONTHLY,
      periodKey: monthKey(),
      status: "CONFIRMED",
    },
  });

  console.log("Seed complete.");
  console.log(`  Trainer:   ${trainer.walletAddress}`);
  console.log(`  Classroom: ${classroom.name} (join code ${classroom.joinCode})`);
  console.log(`  Trainees:  ${trainees.length} (1 pending approval)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

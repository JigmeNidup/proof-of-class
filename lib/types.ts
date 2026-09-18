import type {
  BadgeType,
  MembershipStatus,
  PointCategory,
  Role,
  TrainerStatus,
  TxStatus,
} from "@prisma/client";

/**
 * Shapes returned by the API once Prisma models have been JSON-serialized:
 * dates become ISO strings and BigInt/Decimal become strings.
 */

export type UserDto = {
  id: string;
  walletAddress: string;
  role: Role;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  trainerStatus: TrainerStatus;
  trainerPitch: string | null;
  trainerRequestedAt: string | null;
  trainerReviewedAt: string | null;
  trainerReviewNote: string | null;
};

/** A user viewed through the platform owner's review queue. */
export type TrainerApplicationDto = UserDto & {
  createdAt: string;
  trainerReviewedBy: string | null;
  _count?: { ownedClassrooms: number; memberships: number };
};

/**
 * Being a trainer needs both halves: the role grants the capability, the status
 * records that the owner allowed it. Approval sets them together.
 */
export function isApprovedTrainer(
  user: Pick<UserDto, "role" | "trainerStatus"> | null | undefined,
): boolean {
  return user?.role === "TRAINER" && user.trainerStatus === "APPROVED";
}

export type ClassroomDto = {
  id: string;
  name: string;
  description: string | null;
  joinCode?: string;
  autoApprove: boolean;
  isActive: boolean;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  tokenDecimals: number;
  badgeAddress: string | null;
  chainId: number;
  deployedBlock: string | null;
  creatorId: string;
  createdAt: string;
  _count?: { memberships: number; points: number };
};

export type MembershipDto = {
  id: string;
  status: MembershipStatus;
  requestedAt: string;
  approvedAt: string | null;
  userId: string;
  classroomId: string;
  user: Pick<UserDto, "id" | "walletAddress" | "displayName" | "avatarUrl">;
};

export type PointLogDto = {
  id: string;
  points: number;
  amountWei: string;
  category: PointCategory;
  note: string | null;
  status: TxStatus;
  txHash: string | null;
  createdAt: string;
  confirmedAt: string | null;
  receiverWallet: string;
  receiver: Pick<UserDto, "id" | "displayName" | "walletAddress">;
};

export type BadgeAwardDto = {
  id: string;
  badgeType: BadgeType;
  tokenId: number;
  quantity: number;
  periodKey: string;
  status: TxStatus;
  txHash: string | null;
  awardedAt: string;
  recipientWallet: string;
  user: Pick<UserDto, "id" | "displayName" | "walletAddress">;
};

export type QuickCallDto = {
  id: string;
  question: string;
  options: Array<{ id: string; label: string }> | null;
  correctOptionId: string | null;
  startedAt: string;
  endedAt: string | null;
  _count?: { responses: number };
};

/** Order matters: these indexes are the uint8 category on ClassroomToken. */
export const POINT_CATEGORIES: Array<{
  value: PointCategory;
  label: string;
  onChainValue: number;
}> = [
  { value: "CLASS", label: "Class participation", onChainValue: 0 },
  { value: "PROJECT", label: "Project work", onChainValue: 1 },
  { value: "PUBLIC_VOTE", label: "Public vote", onChainValue: 2 },
];

export function categoryToUint8(category: PointCategory): number {
  return (
    POINT_CATEGORIES.find((entry) => entry.value === category)?.onChainValue ?? 0
  );
}

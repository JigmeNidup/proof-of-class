import { z } from "zod";

export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a 20-byte hex address");

export const txHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 32-byte transaction hash");

/**
 * Role is intentionally absent: it is only ever changed by the platform owner
 * reviewing a trainer request, never by the account itself.
 */
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).nullish(),
  bio: z.string().trim().max(280).nullish(),
  avatarUrl: z.string().trim().url().max(500).nullish(),
});

export const createTrainerApplicationSchema = z.object({
  pitch: z.string().trim().min(20).max(500),
});

export const reviewTrainerApplicationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(300).optional(),
});

export const createClassroomSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500).optional(),
  autoApprove: z.boolean().optional().default(false),
  tokenSymbol: z
    .string()
    .trim()
    .min(2)
    .max(8)
    .regex(/^[A-Za-z0-9]+$/, "Letters and digits only")
    .optional(),
});

export const updateClassroomSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  description: z.string().trim().max(500).nullish(),
  autoApprove: z.boolean().optional(),
  isActive: z.boolean().optional(),
  tokenAddress: addressSchema.optional(),
  badgeAddress: addressSchema.optional(),
  tokenSymbol: z.string().trim().min(2).max(8).optional(),
  deployedBlock: z.number().int().nonnegative().optional(),
});

export const joinClassroomSchema = z.object({
  joinCode: z.string().trim().min(4).max(16),
});

export const updateMembershipSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REMOVED"]),
});

export const createPointLogSchema = z.object({
  classroomId: z.string().min(1),
  /** Wallet of the trainee receiving the points. */
  receiverAddress: addressSchema,
  points: z.number().int().positive().max(1_000_000),
  category: z.enum(["CLASS", "PROJECT", "PUBLIC_VOTE"]),
  note: z.string().trim().max(200).optional(),
  txHash: txHashSchema.optional(),
});

export const createBadgeAwardSchema = z.object({
  classroomId: z.string().min(1),
  recipientAddress: addressSchema,
  badgeType: z.enum(["WEEKLY", "MONTHLY"]),
  periodKey: z
    .string()
    .trim()
    .regex(
      /^\d{4}-(W\d{2}|\d{2})$/,
      'Must look like "2026-W35" (weekly) or "2026-08" (monthly)',
    ),
  txHash: txHashSchema.optional(),
});

export const quickCallOptionSchema = z.object({
  id: z.string().trim().min(1).max(16),
  label: z.string().trim().min(1).max(120),
});

export const createQuickCallSchema = z.object({
  classroomId: z.string().min(1),
  question: z.string().trim().min(3).max(280),
  options: z.array(quickCallOptionSchema).max(6).optional(),
  correctOptionId: z.string().trim().max(16).optional(),
  /** Auto-close after this many seconds. 0 disables the timer. */
  durationSeconds: z.number().int().min(0).max(600).optional().default(30),
});

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type CreatePointLogInput = z.infer<typeof createPointLogSchema>;
export type CreateQuickCallInput = z.infer<typeof createQuickCallSchema>;
export type QuickCallOption = z.infer<typeof quickCallOptionSchema>;

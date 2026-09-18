import type { Server } from "socket.io";

import type {
  ClientToServerEvents,
  QuickCallOptionPayload,
  ServerToClientEvents,
  SocketData,
} from "./events";

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type ActiveAnswer = {
  userId: string;
  displayName: string;
  walletAddress: string;
  optionId: string | null;
  clientClickAt: number | null;
  serverReceivedAt: Date;
  latencyMs: number;
};

export type ActiveQuickCall = {
  id: string;
  classroomId: string;
  question: string;
  options: QuickCallOptionPayload[];
  correctOptionId: string | null;
  durationSeconds: number;
  /** Wall clock, for display and for the DB. */
  startedAt: Date;
  /** Monotonic reference used for latency, immune to clock changes. */
  startedAtHrNs: bigint;
  answers: Map<string, ActiveAnswer>;
  closeTimer: NodeJS.Timeout | null;
};

type RealtimeRegistry = {
  io: RealtimeServer | null;
  /** quickCallId -> live state */
  activeCalls: Map<string, ActiveQuickCall>;
  /** classroomId -> quickCallId, so a late joiner can be shown the open call. */
  activeByClassroom: Map<string, string>;
};

/**
 * Held on globalThis so the Socket.io server created in server.ts and the
 * Next.js route handlers - which are bundled separately but run in the same
 * process - share one instance.
 */
const globalForRealtime = globalThis as unknown as {
  __proofOfClassRealtime?: RealtimeRegistry;
};

export function getRegistry(): RealtimeRegistry {
  if (!globalForRealtime.__proofOfClassRealtime) {
    globalForRealtime.__proofOfClassRealtime = {
      io: null,
      activeCalls: new Map(),
      activeByClassroom: new Map(),
    };
  }
  return globalForRealtime.__proofOfClassRealtime;
}

export function setIo(io: RealtimeServer): void {
  getRegistry().io = io;
}

export function getIo(): RealtimeServer | null {
  return getRegistry().io;
}

/** Milliseconds elapsed since a monotonic reference point. */
export function elapsedMs(sinceHrNs: bigint): number {
  return Number((process.hrtime.bigint() - sinceHrNs) / 1_000_000n);
}

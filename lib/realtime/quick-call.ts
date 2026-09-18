import { prisma } from "../prisma";
import {
  classroomRoom,
  type QuickCallAnswerAck,
  type QuickCallEntry,
  type QuickCallOptionPayload,
  type QuickCallResultsPayload,
  type QuickCallStartPayload,
} from "./events";
import {
  elapsedMs,
  getIo,
  getRegistry,
  type ActiveAnswer,
  type ActiveQuickCall,
} from "./registry";

function toStartPayload(call: ActiveQuickCall): QuickCallStartPayload {
  return {
    quickCallId: call.id,
    classroomId: call.classroomId,
    question: call.question,
    options: call.options,
    startedAt: call.startedAt.getTime(),
    durationSeconds: call.durationSeconds,
  };
}

/** Answers ordered by server arrival time - the only ranking we trust. */
function rankAnswers(call: ActiveQuickCall): ActiveAnswer[] {
  return [...call.answers.values()].sort((a, b) => a.latencyMs - b.latencyMs);
}

function toEntries(call: ActiveQuickCall): QuickCallEntry[] {
  return rankAnswers(call).map((answer, index) => ({
    userId: answer.userId,
    displayName: answer.displayName,
    walletAddress: answer.walletAddress,
    optionId: answer.optionId,
    latencyMs: answer.latencyMs,
    rank: index + 1,
    isCorrect: call.correctOptionId
      ? answer.optionId === call.correctOptionId
      : null,
  }));
}

function broadcastResults(call: ActiveQuickCall, closed: boolean): void {
  const payload: QuickCallResultsPayload = {
    quickCallId: call.id,
    entries: toEntries(call),
    closed,
  };
  getIo()
    ?.to(classroomRoom(call.classroomId))
    .emit(closed ? "quickcall:end" : "quickcall:results", payload);
}

/**
 * Registers a freshly created quick call as live and pushes it to everyone in
 * the classroom room. The DB row must already exist.
 */
export function startQuickCall(input: {
  id: string;
  classroomId: string;
  question: string;
  options: QuickCallOptionPayload[];
  correctOptionId: string | null;
  durationSeconds: number;
  startedAt: Date;
}): QuickCallStartPayload {
  const registry = getRegistry();

  // Only one call can be open per classroom; close any leftover first.
  const previousId = registry.activeByClassroom.get(input.classroomId);
  if (previousId && previousId !== input.id) {
    void endQuickCall(previousId);
  }

  const call: ActiveQuickCall = {
    id: input.id,
    classroomId: input.classroomId,
    question: input.question,
    options: input.options,
    correctOptionId: input.correctOptionId,
    durationSeconds: input.durationSeconds,
    startedAt: input.startedAt,
    startedAtHrNs: process.hrtime.bigint(),
    answers: new Map(),
    closeTimer: null,
  };

  if (input.durationSeconds > 0) {
    call.closeTimer = setTimeout(() => {
      void endQuickCall(call.id);
    }, input.durationSeconds * 1000);
    // Do not hold the process open just for a pending quick call.
    call.closeTimer.unref?.();
  }

  registry.activeCalls.set(call.id, call);
  registry.activeByClassroom.set(call.classroomId, call.id);

  const payload = toStartPayload(call);
  getIo()?.to(classroomRoom(call.classroomId)).emit("quickcall:start", payload);
  return payload;
}

export function getActiveQuickCallForClassroom(
  classroomId: string,
): QuickCallStartPayload | null {
  const registry = getRegistry();
  const id = registry.activeByClassroom.get(classroomId);
  if (!id) return null;
  const call = registry.activeCalls.get(id);
  return call ? toStartPayload(call) : null;
}

export function getActiveQuickCall(
  quickCallId: string,
): ActiveQuickCall | undefined {
  return getRegistry().activeCalls.get(quickCallId);
}

/**
 * Records one trainee's answer. Latency is measured here, at arrival, from a
 * monotonic clock started when the call opened.
 */
export function submitAnswer(input: {
  quickCallId: string;
  userId: string;
  displayName: string;
  walletAddress: string;
  optionId?: string | null;
  clientClickAt?: number | null;
}): QuickCallAnswerAck {
  const call = getRegistry().activeCalls.get(input.quickCallId);
  if (!call) {
    return {
      quickCallId: input.quickCallId,
      accepted: false,
      reason: "unknown_call",
    };
  }

  if (call.answers.has(input.userId)) {
    return {
      quickCallId: call.id,
      accepted: false,
      reason: "already_answered",
    };
  }

  const latencyMs = Math.max(0, elapsedMs(call.startedAtHrNs));

  call.answers.set(input.userId, {
    userId: input.userId,
    displayName: input.displayName,
    walletAddress: input.walletAddress,
    optionId: input.optionId ?? null,
    clientClickAt: input.clientClickAt ?? null,
    serverReceivedAt: new Date(),
    latencyMs,
  });

  broadcastResults(call, false);

  const rank = rankAnswers(call).findIndex((a) => a.userId === input.userId) + 1;
  return { quickCallId: call.id, accepted: true, latencyMs, rank };
}

/**
 * Closes a quick call, flushes every answer to the database in one write, and
 * broadcasts the final ranking.
 */
export async function endQuickCall(
  quickCallId: string,
): Promise<QuickCallResultsPayload | null> {
  const registry = getRegistry();
  const call = registry.activeCalls.get(quickCallId);
  if (!call) return null;

  if (call.closeTimer) clearTimeout(call.closeTimer);
  registry.activeCalls.delete(call.id);
  if (registry.activeByClassroom.get(call.classroomId) === call.id) {
    registry.activeByClassroom.delete(call.classroomId);
  }

  const entries = toEntries(call);
  const ranked = rankAnswers(call);

  try {
    await prisma.$transaction([
      prisma.quickCallResponse.createMany({
        data: ranked.map((answer, index) => ({
          quickCallId: call.id,
          userId: answer.userId,
          optionId: answer.optionId,
          clientClickAt: answer.clientClickAt
            ? new Date(answer.clientClickAt)
            : null,
          serverReceivedAt: answer.serverReceivedAt,
          latencyMs: answer.latencyMs,
          rank: index + 1,
          isCorrect: call.correctOptionId
            ? answer.optionId === call.correctOptionId
            : null,
        })),
        skipDuplicates: true,
      }),
      prisma.quickCall.update({
        where: { id: call.id },
        data: { endedAt: new Date() },
      }),
    ]);
  } catch (error) {
    console.error("[quick-call] failed to persist responses", error);
  }

  const payload: QuickCallResultsPayload = {
    quickCallId: call.id,
    entries,
    closed: true,
  };
  getIo()?.to(classroomRoom(call.classroomId)).emit("quickcall:end", payload);
  return payload;
}

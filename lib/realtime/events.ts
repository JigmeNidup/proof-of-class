/**
 * Socket.io contract shared by the custom server and the browser.
 *
 * Timing rule: the server timestamps every answer on arrival and ranks by that
 * value. `clientClickAt` is carried along only so the UI can show a trainee
 * their own reaction time - it is never used for ordering, because a client
 * can set its own clock to anything.
 */

export type QuickCallOptionPayload = {
  id: string;
  label: string;
};

export type QuickCallStartPayload = {
  quickCallId: string;
  classroomId: string;
  question: string;
  options: QuickCallOptionPayload[];
  /** Server wall-clock time the call opened, epoch ms. */
  startedAt: number;
  /** 0 means the trainer will close it manually. */
  durationSeconds: number;
};

export type QuickCallEntry = {
  userId: string;
  displayName: string;
  walletAddress: string;
  optionId: string | null;
  /** Milliseconds from call start to server receipt. */
  latencyMs: number;
  rank: number;
  isCorrect: boolean | null;
};

export type QuickCallResultsPayload = {
  quickCallId: string;
  entries: QuickCallEntry[];
  /** True once the call is closed and results are final. */
  closed: boolean;
};

export type QuickCallAnswerAck = {
  quickCallId: string;
  accepted: boolean;
  reason?: "closed" | "already_answered" | "unknown_call" | "not_a_member";
  latencyMs?: number;
  rank?: number;
};

export type ServerToClientEvents = {
  "quickcall:start": (payload: QuickCallStartPayload) => void;
  "quickcall:results": (payload: QuickCallResultsPayload) => void;
  "quickcall:end": (payload: QuickCallResultsPayload) => void;
  "quickcall:active": (payload: QuickCallStartPayload | null) => void;
  "points:awarded": (payload: {
    classroomId: string;
    receiverAddress: string;
    points: number;
    category: string;
  }) => void;
  "badge:awarded": (payload: {
    classroomId: string;
    recipientAddress: string;
    badgeType: "WEEKLY" | "MONTHLY";
  }) => void;
};

export type ClientToServerEvents = {
  "classroom:join": (
    classroomId: string,
    ack: (result: { ok: boolean; error?: string }) => void,
  ) => void;
  "classroom:leave": (classroomId: string) => void;
  "quickcall:answer": (
    payload: {
      quickCallId: string;
      optionId?: string | null;
      /** Browser clock at click time, epoch ms. Display only. */
      clientClickAt?: number;
    },
    ack: (result: QuickCallAnswerAck) => void,
  ) => void;
};

export type SocketData = {
  userId: string;
  address: string;
  role: "TRAINER" | "TRAINEE";
};

export const SOCKET_PATH = "/api/socket.io";

export function classroomRoom(classroomId: string): string {
  return `classroom:${classroomId}`;
}

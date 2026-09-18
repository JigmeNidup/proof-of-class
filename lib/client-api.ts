"use client";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Thin wrapper over fetch that unwraps the `{ error, code }` shape produced by
 * lib/api.ts, so callers can just catch ApiError and show `error.message`.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json: body, ...rest } = init ?? {};

  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...rest.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : rest.body,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? `Request failed (${response.status})`,
      payload?.code,
    );
  }

  return payload as T;
}

export const queryKeys = {
  me: ["me"] as const,
  classrooms: ["classrooms"] as const,
  classroom: (id: string) => ["classroom", id] as const,
  members: (id: string, status?: string) =>
    ["classroom", id, "members", status ?? "all"] as const,
  leaderboard: (id: string, period: string) =>
    ["classroom", id, "leaderboard", period] as const,
  points: (id: string, receiverId?: string) =>
    ["classroom", id, "points", receiverId ?? "all"] as const,
  badges: (id: string, userId?: string) =>
    ["classroom", id, "badges", userId ?? "all"] as const,
  quickCalls: (id: string) => ["classroom", id, "quick-calls"] as const,
  trainerApplications: (status: string) =>
    ["trainer-applications", status] as const,
};

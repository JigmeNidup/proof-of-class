import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const unauthorized = (message = "Sign in required") =>
  new HttpError(401, message, "unauthorized");
export const forbidden = (message = "Not allowed") =>
  new HttpError(403, message, "forbidden");
export const notFound = (message = "Not found") =>
  new HttpError(404, message, "not_found");
export const badRequest = (message: string, code = "bad_request") =>
  new HttpError(400, message, code);
export const conflict = (message: string, code = "conflict") =>
  new HttpError(409, message, code);

/**
 * `Response.json` cannot serialize BigInt, and Prisma returns BigInt for
 * `blockNumber` / `deployedBlock`. Decimal already implements toJSON.
 */
export function json(data: unknown, init?: ResponseInit): Response {
  const body = JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  return new Response(body, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

/**
 * Wraps a route handler so thrown errors become consistent JSON responses
 * instead of opaque 500s.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }

      if (error instanceof ZodError) {
        return json(
          {
            error: "Invalid request body",
            code: "validation_error",
            issues: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
          { status: 422 },
        );
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return json(
            { error: "That record already exists", code: "duplicate" },
            { status: 409 },
          );
        }
        if (error.code === "P2025") {
          return json(
            { error: "Record not found", code: "not_found" },
            { status: 404 },
          );
        }
      }

      console.error("[api] unhandled error", error);
      return json(
        { error: "Internal server error", code: "internal_error" },
        { status: 500 },
      );
    }
  };
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
}

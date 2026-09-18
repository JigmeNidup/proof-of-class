/**
 * Next.js + Socket.io on a single port.
 *
 * The websocket layer needs to run in the same process as the API routes so
 * that a trainer hitting POST /api/quick-calls can push straight into the
 * classroom room without a message broker. Route handlers reach the io
 * instance through lib/realtime/registry, which is held on globalThis.
 */
import "dotenv/config";

import { createServer } from "node:http";

import next from "next";
import { getToken } from "next-auth/jwt";
import { Server } from "socket.io";

import { classroomRoom, SOCKET_PATH } from "./lib/realtime/events";
import { prisma } from "./lib/prisma";
import { submitAnswer } from "./lib/realtime/quick-call";
import { getActiveQuickCallForClassroom } from "./lib/realtime/quick-call";
import { setIo, type RealtimeServer } from "./lib/realtime/registry";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT ?? 3000);

// Auth.js prefixes the cookie with __Secure- when it is issued over https, and
// derives the JWT decryption salt from that same name - so this flag must match
// how the cookie was written or getToken silently returns null.
const useSecureCookies = (process.env.AUTH_URL ?? "").startsWith("https://");

async function main() {
  const app = next({ dev, hostname, port });
  await app.prepare();
  const handle = app.getRequestHandler();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io: RealtimeServer = new Server(httpServer, {
    path: SOCKET_PATH,
    serveClient: false,
    cors: dev ? { origin: true, credentials: true } : undefined,
  });

  io.use(async (socket, nextFn) => {
    try {
      const cookie = socket.handshake.headers.cookie ?? "";
      const token = await getToken({
        req: { headers: new Headers({ cookie }) },
        secret: process.env.AUTH_SECRET!,
        secureCookie: useSecureCookies,
      });

      if (!token?.id) return nextFn(new Error("unauthorized"));

      socket.data.userId = token.id;
      socket.data.address = token.address;
      socket.data.role = token.role;
      return nextFn();
    } catch (error) {
      console.error("[socket] handshake failed", error);
      return nextFn(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("classroom:join", async (classroomId, ack) => {
      try {
        // Room membership is re-checked here rather than trusted from the
        // client, otherwise anyone with a session could listen to any class.
        const classroom = await prisma.classroom.findUnique({
          where: { id: classroomId },
          select: { id: true, creatorId: true },
        });
        if (!classroom) {
          ack?.({ ok: false, error: "Classroom not found" });
          return;
        }

        const isTrainer = classroom.creatorId === socket.data.userId;
        if (!isTrainer) {
          const membership = await prisma.classMembership.findUnique({
            where: {
              userId_classroomId: {
                userId: socket.data.userId,
                classroomId,
              },
            },
            select: { status: true },
          });
          if (membership?.status !== "APPROVED") {
            ack?.({ ok: false, error: "Not an approved member" });
            return;
          }
        }

        await socket.join(classroomRoom(classroomId));
        ack?.({ ok: true });

        // A trainee who loads the page mid-call still gets the question.
        socket.emit(
          "quickcall:active",
          getActiveQuickCallForClassroom(classroomId),
        );
      } catch (error) {
        console.error("[socket] classroom:join failed", error);
        ack?.({ ok: false, error: "Could not join classroom" });
      }
    });

    socket.on("classroom:leave", (classroomId) => {
      void socket.leave(classroomRoom(classroomId));
    });

    socket.on("quickcall:answer", async (payload, ack) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: socket.data.userId },
          select: { displayName: true, walletAddress: true },
        });

        const result = submitAnswer({
          quickCallId: payload.quickCallId,
          userId: socket.data.userId,
          displayName: user?.displayName ?? socket.data.address,
          walletAddress: user?.walletAddress ?? socket.data.address,
          optionId: payload.optionId,
          clientClickAt: payload.clientClickAt,
        });

        ack?.(result);
      } catch (error) {
        console.error("[socket] quickcall:answer failed", error);
        ack?.({
          quickCallId: payload.quickCallId,
          accepted: false,
          reason: "unknown_call",
        });
      }
    });
  });

  setIo(io);

  httpServer.listen(port, () => {
    console.log(`> ProofOfClass ready on http://${hostname}:${port}`);
    console.log(`> Socket.io listening on ${SOCKET_PATH}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

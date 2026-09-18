"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";

import {
  SOCKET_PATH,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@/lib/realtime/events";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type SocketContextValue = {
  socket: AppSocket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

/**
 * Holds one websocket for the whole app. The connection is only opened once a
 * session cookie exists, because the server rejects unauthenticated handshakes.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<AppSocket | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    if (socketRef.current) return;

    const instance: AppSocket = io({
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    instance.on("connect", () => setConnected(true));
    instance.on("disconnect", () => setConnected(false));
    instance.on("connect_error", (error) => {
      setConnected(false);
      console.warn("[socket] connect_error", error.message);
    });

    socketRef.current = instance;
    setSocket(instance);

    return () => {
      instance.removeAllListeners();
      instance.disconnect();
      socketRef.current = null;
    };
  }, [status]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

/**
 * Joins the classroom room and leaves it on unmount. Re-joins automatically
 * after a reconnect, since rooms live on the server connection.
 */
export function useClassroomRoom(classroomId: string | undefined): {
  socket: AppSocket | null;
  connected: boolean;
  joined: boolean;
  error: string | null;
} {
  const { socket, connected } = useSocket();
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !connected || !classroomId) {
      setJoined(false);
      return;
    }

    let cancelled = false;
    socket.emit("classroom:join", classroomId, (result) => {
      if (cancelled) return;
      setJoined(result.ok);
      setError(result.ok ? null : (result.error ?? "Could not join"));
    });

    return () => {
      cancelled = true;
      socket.emit("classroom:leave", classroomId);
      setJoined(false);
    };
  }, [socket, connected, classroomId]);

  return { socket, connected, joined, error };
}

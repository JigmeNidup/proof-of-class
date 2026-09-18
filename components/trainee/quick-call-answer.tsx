"use client";

import { useEffect, useRef, useState } from "react";

import { useClassroomRoom } from "@/components/socket-provider";
import { Alert, Panel, Pill, Spinner } from "@/components/ui";
import type {
  QuickCallAnswerAck,
  QuickCallResultsPayload,
  QuickCallStartPayload,
} from "@/lib/realtime/events";
import { classNames, shortenAddress } from "@/lib/utils";

/**
 * The trainee buzzer.
 *
 * The click timestamp is captured synchronously in the handler and sent along,
 * but it only ever feeds the "your reaction time" readout. Placement comes from
 * the server's own arrival clock, which is why two trainees cannot tie by
 * fiddling with their system time.
 */
export function QuickCallAnswer({ classroomId }: { classroomId: string }) {
  const { socket, connected, joined, error: roomError } =
    useClassroomRoom(classroomId);

  const [call, setCall] = useState<QuickCallStartPayload | null>(null);
  const [ack, setAck] = useState<QuickCallAnswerAck | null>(null);
  const [results, setResults] = useState<QuickCallResultsPayload | null>(null);
  const [closed, setClosed] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const clickedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!socket) return;

    const onStart = (payload: QuickCallStartPayload) => {
      setCall(payload);
      setAck(null);
      setResults(null);
      setClosed(false);
      clickedAtRef.current = null;
    };
    const onActive = (payload: QuickCallStartPayload | null) => {
      if (payload) onStart(payload);
    };
    const onResults = (payload: QuickCallResultsPayload) => {
      setResults(payload);
    };
    const onEnd = (payload: QuickCallResultsPayload) => {
      setResults(payload);
      setClosed(true);
      setRemaining(null);
    };

    socket.on("quickcall:start", onStart);
    socket.on("quickcall:active", onActive);
    socket.on("quickcall:results", onResults);
    socket.on("quickcall:end", onEnd);

    return () => {
      socket.off("quickcall:start", onStart);
      socket.off("quickcall:active", onActive);
      socket.off("quickcall:results", onResults);
      socket.off("quickcall:end", onEnd);
    };
  }, [socket]);

  // Countdown is cosmetic; the server is what actually closes the call.
  useEffect(() => {
    if (!call || closed || call.durationSeconds === 0) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - call.startedAt) / 1000;
      setRemaining(Math.max(0, Math.ceil(call.durationSeconds - elapsed)));
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [call, closed]);

  function answer(optionId: string | null) {
    if (!socket || !call || ack?.accepted || closed) return;

    clickedAtRef.current = Date.now();
    socket.emit(
      "quickcall:answer",
      {
        quickCallId: call.quickCallId,
        optionId,
        clientClickAt: clickedAtRef.current,
      },
      (result) => setAck(result),
    );
  }

  if (!connected) {
    return (
      <Panel title="Quick-call">
        <div className="flex items-center gap-2 py-10 text-sm text-ink-400">
          <Spinner /> Connecting to the live channel…
        </div>
      </Panel>
    );
  }

  if (roomError) {
    return (
      <Panel title="Quick-call">
        <Alert tone="warning">{roomError}</Alert>
      </Panel>
    );
  }

  if (!call) {
    return (
      <Panel
        title="Quick-call"
        subtitle="Keep this page open. The buzzer appears the instant your trainer fires a question."
        actions={<Pill tone={joined ? "success" : "warning"}>
          {joined ? "listening" : "joining…"}
        </Pill>}
      >
        <div className="grid place-items-center py-16">
          <div className="size-24 animate-pulse rounded-full border-4 border-dashed border-ink-700" />
          <p className="mt-5 text-sm text-ink-400">Waiting for a question…</p>
        </div>
      </Panel>
    );
  }

  const answered = Boolean(ack?.accepted);

  return (
    <div className="space-y-4">
      <Panel
        title={closed ? "Round closed" : "Answer now"}
        actions={
          remaining !== null && !closed ? (
            <Pill tone={remaining <= 5 ? "danger" : "info"}>{remaining}s</Pill>
          ) : (
            <Pill tone="neutral">{closed ? "finished" : "open"}</Pill>
          )
        }
      >
        <p className="text-lg font-semibold leading-snug text-white">
          {call.question}
        </p>

        {call.options.length === 0 ? (
          <button
            type="button"
            onClick={() => answer(null)}
            disabled={answered || closed}
            className={classNames(
              "mt-6 grid h-48 w-full place-items-center rounded-2xl text-2xl font-black uppercase tracking-widest transition-transform",
              answered || closed
                ? "cursor-not-allowed bg-ink-800 text-ink-600"
                : "bg-brand-500 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-400 active:scale-[0.98]",
            )}
          >
            {answered ? "Locked in" : closed ? "Closed" : "Tap!"}
          </button>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {call.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => answer(option.id)}
                disabled={answered || closed}
                className={classNames(
                  "flex min-h-24 items-center gap-3 rounded-2xl px-5 py-4 text-left text-base font-medium transition-transform",
                  answered && ack?.accepted
                    ? "cursor-not-allowed bg-ink-800 text-ink-500"
                    : "bg-ink-800 text-white hover:bg-brand-500 active:scale-[0.98]",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink-900 text-sm font-bold">
                  {option.id}
                </span>
                {option.label}
              </button>
            ))}
          </div>
        )}

        {ack && !ack.accepted && (
          <Alert tone="warning">
            {ack.reason === "already_answered"
              ? "You already answered this one."
              : ack.reason === "unknown_call"
                ? "That round has closed."
                : "Answer not accepted."}
          </Alert>
        )}

        {answered && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
            <Pill tone="success">position #{ack?.rank}</Pill>
            <span className="text-sm text-ink-300">
              Server clocked you at{" "}
              <strong className="font-mono text-white">
                {ack?.latencyMs} ms
              </strong>
            </span>
          </div>
        )}
      </Panel>

      {results && results.entries.length > 0 && (
        <Panel title={closed ? "Final standings" : "Live standings"}>
          <ol className="space-y-1.5">
            {results.entries.map((entry) => (
              <li
                key={entry.userId}
                className="flex items-center gap-3 rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2"
              >
                <span className="w-6 text-center text-sm font-bold tabular-nums text-ink-300">
                  {entry.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">
                  {entry.displayName || shortenAddress(entry.walletAddress)}
                </span>
                {entry.isCorrect !== null && (
                  <Pill tone={entry.isCorrect ? "success" : "danger"}>
                    {entry.isCorrect ? "correct" : "wrong"}
                  </Pill>
                )}
                <span className="w-20 text-right font-mono text-xs tabular-nums text-ink-300">
                  {entry.latencyMs} ms
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}

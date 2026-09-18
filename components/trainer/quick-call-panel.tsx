"use client";

import { useEffect, useState } from "react";

import { useClassroomRoom } from "@/components/socket-provider";
import {
  Alert,
  Button,
  Field,
  Input,
  Panel,
  Pill,
  Select,
} from "@/components/ui";
import { apiFetch } from "@/lib/client-api";
import type {
  QuickCallEntry,
  QuickCallResultsPayload,
  QuickCallStartPayload,
} from "@/lib/realtime/events";
import { shortenAddress } from "@/lib/utils";

type OptionDraft = { id: string; label: string };

const DURATIONS = [10, 20, 30, 60, 0];

export function QuickCallPanel({
  classroomId,
  onAwardPoints,
}: {
  classroomId: string;
  /** Hands a finalist to the points form. Omit to hide the award actions. */
  onAwardPoints?: (question: string, entry: QuickCallEntry) => void;
}) {
  const { socket, connected, joined, error: roomError } =
    useClassroomRoom(classroomId);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [correctOptionId, setCorrectOptionId] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(30);

  const [active, setActive] = useState<QuickCallStartPayload | null>(null);
  const [results, setResults] = useState<QuickCallResultsPayload | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const onResults = (payload: QuickCallResultsPayload) => {
      setResults(payload);
      setClosed(payload.closed);
    };
    const onEnd = (payload: QuickCallResultsPayload) => {
      setResults(payload);
      setClosed(true);
    };
    const onActive = (payload: QuickCallStartPayload | null) => {
      if (payload) {
        setActive(payload);
        setClosed(false);
      }
    };

    socket.on("quickcall:results", onResults);
    socket.on("quickcall:end", onEnd);
    socket.on("quickcall:active", onActive);

    return () => {
      socket.off("quickcall:results", onResults);
      socket.off("quickcall:end", onEnd);
      socket.off("quickcall:active", onActive);
    };
  }, [socket]);

  async function startCall() {
    setError(null);
    setStarting(true);
    setResults(null);
    setClosed(false);

    try {
      const payload = await apiFetch<{ payload: QuickCallStartPayload }>(
        "/api/quick-calls",
        {
          method: "POST",
          json: {
            classroomId,
            question,
            options: options.length > 0 ? options : undefined,
            correctOptionId: correctOptionId || undefined,
            durationSeconds,
          },
        },
      );
      setActive(payload.payload);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start quick call",
      );
    } finally {
      setStarting(false);
    }
  }

  async function endCall() {
    if (!active) return;
    try {
      await apiFetch(`/api/quick-calls/${active.quickCallId}`, {
        method: "PATCH",
      });
      setClosed(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not close call");
    }
  }

  function addOption() {
    if (options.length >= 6) return;
    const nextId = String.fromCharCode(65 + options.length);
    setOptions([...options, { id: nextId, label: "" }]);
  }

  const isLive = Boolean(active) && !closed;

  // Awarding waits until the call closes: ranks shift while answers are still
  // landing, and the generated note quotes the rank as final.
  const canAward = Boolean(onAwardPoints) && closed;

  return (
    <div className="space-y-4">
      <Panel
        title="Quick-call"
        subtitle="Fires a buzzer to every connected trainee. Ranking uses server arrival time."
        actions={
          <Pill tone={connected && joined ? "success" : "warning"}>
            {connected ? (joined ? "live" : "joining…") : "offline"}
          </Pill>
        }
      >
        {roomError && <Alert tone="warning">{roomError}</Alert>}

        <div className="space-y-4">
          <Field label="Question">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What does the CREATE2 opcode let you predict?"
              maxLength={280}
              disabled={isLive}
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">
                Options
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addOption}
                disabled={isLive || options.length >= 6}
              >
                Add option
              </Button>
            </div>

            {options.length === 0 && (
              <p className="text-xs text-ink-400">
                No options means a pure speed race: first tap wins.
              </p>
            )}

            {options.map((option, index) => (
              <div key={option.id} className="flex items-center gap-2">
                <span className="w-6 text-center text-xs font-bold text-ink-400">
                  {option.id}
                </span>
                <Input
                  value={option.label}
                  onChange={(e) => {
                    const next = [...options];
                    next[index] = { ...option, label: e.target.value };
                    setOptions(next);
                  }}
                  placeholder={`Option ${option.id}`}
                  disabled={isLive}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isLive}
                  onClick={() =>
                    setOptions(options.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {options.length > 0 && (
              <Field label="Correct option" hint="Optional.">
                <Select
                  value={correctOptionId}
                  onChange={(e) => setCorrectOptionId(e.target.value)}
                  disabled={isLive}
                >
                  <option value="">Not graded</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.id} — {option.label || "(blank)"}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Auto-close after">
              <Select
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                disabled={isLive}
              >
                {DURATIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds === 0 ? "I will close it manually" : `${seconds}s`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={startCall}
              loading={starting}
              disabled={isLive || question.trim().length < 3 || !joined}
            >
              Fire quick-call
            </Button>
            {isLive && (
              <Button variant="danger" onClick={endCall}>
                Close now
              </Button>
            )}
          </div>

          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Panel>

      {active && (
        <Panel
          title={closed ? "Final results" : "Live responses"}
          subtitle={active.question}
          actions={
            <Pill tone={closed ? "neutral" : "info"}>
              {results?.entries.length ?? 0} answered
            </Pill>
          }
        >
          {(results?.entries.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">
              Waiting for the first tap…
            </p>
          ) : (
            <>
              {canAward && (
                <p className="mb-3 text-xs text-ink-400">
                  Pick a trainee to open the points form with the question and
                  their timing already filled in.
                </p>
              )}

              <ol className="space-y-1.5">
                {results!.entries.map((entry) => (
                  <li
                    key={entry.userId}
                    className="flex items-center gap-3 rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2"
                  >
                    <span className="w-6 text-center text-sm font-bold tabular-nums text-ink-300">
                      {entry.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      {entry.displayName ||
                        shortenAddress(entry.walletAddress)}
                    </span>
                    {entry.optionId && (
                      <Pill
                        tone={
                          entry.isCorrect === null
                            ? "neutral"
                            : entry.isCorrect
                              ? "success"
                              : "danger"
                        }
                      >
                        {entry.optionId}
                      </Pill>
                    )}
                    <span className="w-20 text-right font-mono text-xs tabular-nums text-ink-300">
                      {entry.latencyMs} ms
                    </span>
                    {canAward && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onAwardPoints!(active.question, entry)}
                      >
                        Award
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

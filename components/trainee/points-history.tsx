"use client";

import { useQuery } from "@tanstack/react-query";

import { EmptyState, Panel, Pill } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import { explorerTxUrl } from "@/lib/contracts";
import { POINT_CATEGORIES, type PointLogDto } from "@/lib/types";

const CATEGORY_LABEL = Object.fromEntries(
  POINT_CATEGORIES.map((entry) => [entry.value, entry.label]),
);

export function PointsHistory({
  classroomId,
  receiverId,
  title = "Points history",
}: {
  classroomId: string;
  receiverId?: string;
  title?: string;
}) {
  const { data } = useQuery({
    queryKey: queryKeys.points(classroomId, receiverId),
    queryFn: () =>
      apiFetch<{ points: PointLogDto[] }>(
        `/api/points?classroomId=${classroomId}${
          receiverId ? `&receiverId=${receiverId}` : ""
        }`,
      ),
    refetchInterval: 20_000,
  });

  const points = data?.points ?? [];
  const total = points
    .filter((log) => log.status !== "FAILED")
    .reduce((sum, log) => sum + log.points, 0);

  return (
    <Panel
      title={title}
      subtitle={`${total.toLocaleString()} points across ${points.length} award${points.length === 1 ? "" : "s"}.`}
    >
      {points.length === 0 ? (
        <EmptyState title="Nothing yet" description="Awards will show up here." />
      ) : (
        <ul className="divide-y divide-ink-800">
          {points.map((log) => {
            const href = log.txHash ? explorerTxUrl(log.txHash) : null;
            return (
              <li key={log.id} className="flex items-center gap-3 py-2.5">
                <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-white">
                  +{log.points}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-300">
                    {log.note || CATEGORY_LABEL[log.category]}
                  </p>
                  <p className="text-[0.6875rem] text-ink-400">
                    {CATEGORY_LABEL[log.category]} ·{" "}
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-400 hover:underline"
                  >
                    tx
                  </a>
                ) : null}
                <Pill
                  tone={
                    log.status === "CONFIRMED"
                      ? "success"
                      : log.status === "PENDING"
                        ? "warning"
                        : "danger"
                  }
                >
                  {log.status.toLowerCase()}
                </Pill>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

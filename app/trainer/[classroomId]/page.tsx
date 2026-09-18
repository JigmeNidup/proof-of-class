"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useRef, useState } from "react";

import { AuthGate } from "@/components/auth-gate";
import { Leaderboard } from "@/components/leaderboard";
import { SiteHeader } from "@/components/site-header";
import { AwardBadge } from "@/components/trainer/award-badge";
import { AwardPoints } from "@/components/trainer/award-points";
import { DeployContracts } from "@/components/trainer/deploy-contracts";
import { MembersPanel } from "@/components/trainer/members-panel";
import { QuickCallPanel } from "@/components/trainer/quick-call-panel";
import { Alert, Panel, Pill, Spinner, Tabs } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import {
  quickCallNote,
  type PointsPrefill,
} from "@/lib/quick-call-award";
import type { QuickCallEntry } from "@/lib/realtime/events";
import type { ClassroomDto } from "@/lib/types";

type TabKey = "members" | "points" | "badges" | "quickcall";

const TABS: Array<{ value: TabKey; label: string }> = [
  { value: "members", label: "Members" },
  { value: "points", label: "Points" },
  { value: "badges", label: "Badges" },
  { value: "quickcall", label: "Quick-call" },
];

export default function TrainerClassroomPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const { classroomId } = use(params);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <AuthGate>
          <ClassroomWorkspace classroomId={classroomId} />
        </AuthGate>
      </main>
    </div>
  );
}

function ClassroomWorkspace({ classroomId }: { classroomId: string }) {
  const [tab, setTab] = useState<TabKey>("members");
  const [pointsPrefill, setPointsPrefill] = useState<PointsPrefill | null>(null);
  const prefillNonce = useRef(0);

  function awardFromQuickCall(question: string, entry: QuickCallEntry) {
    prefillNonce.current += 1;
    setPointsPrefill({
      nonce: prefillNonce.current,
      receiverAddress: entry.walletAddress,
      note: quickCallNote(question, entry),
    });
    setTab("points");
  }

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.classroom(classroomId),
    queryFn: () =>
      apiFetch<{
        classroom: ClassroomDto;
        isTrainer: boolean;
        counts: { approved: number; pending: number };
      }>(`/api/classrooms/${classroomId}`),
  });

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-ink-400">
        <Spinner /> Loading classroom…
      </div>
    );
  }

  if (error) {
    return (
      <Alert tone="danger">
        {error instanceof Error ? error.message : "Could not load classroom"}
      </Alert>
    );
  }

  if (!data?.isTrainer) {
    return (
      <Alert tone="warning">
        You do not run this classroom.{" "}
        <Link href="/dashboard" className="underline">
          Open the trainee view instead
        </Link>
        .
      </Alert>
    );
  }

  const { classroom, counts } = data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/trainer"
            className="text-xs text-ink-400 hover:text-white"
          >
            ← All classrooms
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {classroom.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone="info">join code {classroom.joinCode}</Pill>
            <Pill>{counts.approved} approved</Pill>
            {counts.pending > 0 && (
              <Pill tone="warning">{counts.pending} pending</Pill>
            )}
          </div>
        </div>

        <Tabs value={tab} onChange={setTab} options={TABS} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {tab === "members" && <MembersPanel classroomId={classroom.id} />}
          {tab === "points" && (
            // Remounting per selection is what lets the prefill land in
            // initial state while leaving every field editable afterwards.
            <AwardPoints
              key={pointsPrefill?.nonce ?? "blank"}
              classroom={classroom}
              prefill={pointsPrefill}
            />
          )}
          {tab === "badges" && <AwardBadge classroom={classroom} />}

          {/* Stays mounted while other tabs show. Final results are only ever
              pushed over the socket once - the server drops the call from its
              registry on close - so unmounting would lose the ranking the
              trainer is about to award from. */}
          <div className={tab === "quickcall" ? "space-y-6" : "hidden"}>
            <QuickCallPanel
              classroomId={classroom.id}
              onAwardPoints={awardFromQuickCall}
            />
          </div>
        </div>

        <div className="space-y-6">
          <DeployContracts classroom={classroom} />
          <Leaderboard classroomId={classroom.id} />
          <Panel title="Join code" subtitle="Share this with your trainees.">
            <p className="text-center font-mono text-3xl font-bold tracking-[0.3em] text-brand-400">
              {classroom.joinCode}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

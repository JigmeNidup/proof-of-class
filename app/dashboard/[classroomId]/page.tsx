"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { use } from "react";

import { AuthGate } from "@/components/auth-gate";
import { Leaderboard } from "@/components/leaderboard";
import { SiteHeader } from "@/components/site-header";
import { MyBadges } from "@/components/trainee/my-badges";
import { PointsHistory } from "@/components/trainee/points-history";
import { Alert, Button, Panel, Spinner } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import type { ClassroomDto } from "@/lib/types";

export default function TraineeClassroomPage({
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
          <ClassroomView classroomId={classroomId} />
        </AuthGate>
      </main>
    </div>
  );
}

function ClassroomView({ classroomId }: { classroomId: string }) {
  const { data: session } = useSession();

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.classroom(classroomId),
    queryFn: () =>
      apiFetch<{
        classroom: ClassroomDto;
        creator: { displayName: string | null; walletAddress: string } | null;
        isTrainer: boolean;
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

  const { classroom, creator } = data!;
  const userId = session?.user?.id ?? "";
  const walletAddress = session?.user?.address ?? "";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-xs text-ink-400 hover:text-white"
          >
            ← All classrooms
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {classroom.name}
          </h1>
          {creator && (
            <p className="mt-1 text-sm text-ink-400">
              Run by {creator.displayName ?? creator.walletAddress}
            </p>
          )}
        </div>

        <Link href={`/dashboard/${classroom.id}/quick-call`}>
          <Button>Open quick-call buzzer</Button>
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Leaderboard
            classroomId={classroom.id}
            highlightUserId={userId}
            initialPeriod="week"
          />
          <PointsHistory
            classroomId={classroom.id}
            title="Your points"
          />
        </div>

        <div className="space-y-6">
          <MyBadges
            classroom={classroom}
            userId={userId}
            walletAddress={walletAddress}
          />
          {classroom.description && (
            <Panel title="About this classroom">
              <p className="text-sm leading-relaxed text-ink-400">
                {classroom.description}
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

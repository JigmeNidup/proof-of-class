"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { AuthGate } from "@/components/auth-gate";
import { SiteHeader } from "@/components/site-header";
import { JoinClassroom } from "@/components/trainee/join-classroom";
import { ProfileCard } from "@/components/trainee/profile-card";
import { EmptyState, Panel, Pill, Spinner } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import type { ClassroomDto, MembershipDto } from "@/lib/types";

type ClassroomsResponse = {
  owned: ClassroomDto[];
  memberships: Array<
    MembershipDto & {
      classroom: ClassroomDto & {
        creator: { displayName: string | null; walletAddress: string };
        _count: { memberships: number };
      };
    }
  >;
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <AuthGate
          title="Trainee sign-in"
          description="Connect the wallet that will hold your points and badges."
        >
          <TraineeHome />
        </AuthGate>
      </main>
    </div>
  );
}

function TraineeHome() {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.classrooms,
    queryFn: () => apiFetch<ClassroomsResponse>("/api/classrooms"),
  });

  const memberships = data?.memberships ?? [];
  const approved = memberships.filter((m) => m.status === "APPROVED");
  const waiting = memberships.filter((m) => m.status === "PENDING");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Your classrooms
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            Points land in your wallet as ERC-20 tokens; badges as ERC-1155 NFTs.
          </p>
        </div>

        {isPending && (
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Spinner /> Loading…
          </div>
        )}

        {!isPending && memberships.length === 0 && (
          <EmptyState
            title="You have not joined a classroom yet"
            description="Ask your trainer for the six-character join code."
          />
        )}

        {approved.map((membership) => (
          <Link
            key={membership.id}
            href={`/dashboard/${membership.classroom.id}`}
          >
            <Panel className="transition-colors hover:border-brand-400/50">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-white">
                    {membership.classroom.name}
                  </h2>
                  <p className="mt-1 text-sm text-ink-400">
                    Run by{" "}
                    {membership.classroom.creator?.displayName ??
                      "your trainer"}{" "}
                    · {membership.classroom._count?.memberships ?? 0} members
                  </p>
                </div>
                <Pill tone="success">joined</Pill>
              </div>
            </Panel>
          </Link>
        ))}

        {waiting.map((membership) => (
          <Panel key={membership.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-white">
                  {membership.classroom.name}
                </h2>
                <p className="mt-1 text-sm text-ink-400">
                  Waiting for the trainer to approve your request.
                </p>
              </div>
              <Pill tone="warning">pending</Pill>
            </div>
          </Panel>
        ))}
      </div>

      <div className="space-y-4">
        <JoinClassroom />
        <ProfileCard />
      </div>
    </div>
  );
}

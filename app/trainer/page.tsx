"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { AuthGate } from "@/components/auth-gate";
import { SiteHeader } from "@/components/site-header";
import { CreateClassroom } from "@/components/trainer/create-classroom";
import { TrainerApplication } from "@/components/trainer/trainer-application";
import { chainName } from "@/components/switch-network";
import { Alert, EmptyState, Panel, Pill, Spinner } from "@/components/ui";
import { apiFetch, queryKeys } from "@/lib/client-api";
import { CHAIN_ID } from "@/lib/contracts";
import { isPlatformOwner } from "@/lib/platform";
import { isApprovedTrainer, type ClassroomDto, type UserDto } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";

export default function TrainerPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <AuthGate
          title="Trainer sign-in"
          description="Connect the wallet that will own your classroom contracts."
        >
          <TrainerHome />
        </AuthGate>
      </main>
    </div>
  );
}

/**
 * Splits the trainer area in two: the approval flow for anyone the owner has
 * not cleared yet, and the real workspace for those they have. The API enforces
 * the same rule, so this is convenience rather than the security boundary.
 */
function TrainerHome() {
  const queryClient = useQueryClient();
  const { data: session, update } = useSession();
  const jwtSynced = useRef(false);

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<{ user: UserDto }>("/api/users/me"),
    // Poll only while waiting, so an approval lands without a manual reload.
    refetchInterval: (query) =>
      query.state.data?.user.trainerStatus === "PENDING" ? 20_000 : false,
  });

  const me = meQuery.data?.user;
  const owner = isPlatformOwner(me?.walletAddress);
  const canTeach = owner || isApprovedTrainer(me);

  // The JWT was minted before approval and still says TRAINEE. Refresh it once
  // so session-based UI agrees with the database.
  useEffect(() => {
    if (!canTeach || owner || jwtSynced.current) return;
    if (session?.user?.role === "TRAINER") return;
    jwtSynced.current = true;
    void update();
  }, [canTeach, owner, session?.user?.role, update]);

  if (meQuery.isPending) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-ink-400">
        <Spinner /> Loading your account…
      </div>
    );
  }

  if (meQuery.error || !me) {
    return (
      <Alert tone="danger">
        {meQuery.error instanceof Error
          ? meQuery.error.message
          : "Could not load your account"}
      </Alert>
    );
  }

  if (!canTeach) {
    return (
      <div className="mx-auto max-w-2xl">
        <TrainerApplication
          user={me}
          onRefresh={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.me });
            void update();
          }}
        />
      </div>
    );
  }

  return <TrainerWorkspace />;
}

function TrainerWorkspace() {
  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.classrooms,
    queryFn: () =>
      apiFetch<{ owned: ClassroomDto[] }>("/api/classrooms"),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Your classrooms
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            Each classroom gets its own points token and badge collection,
            deployed from and owned by your wallet.
          </p>
        </div>

        {isPending && (
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Spinner /> Loading…
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400">
            {error instanceof Error ? error.message : "Could not load"}
          </p>
        )}

        {data && data.owned.length === 0 && (
          <EmptyState
            title="No classrooms yet"
            description="Create one on the right, then deploy its contracts."
          />
        )}

        <div className="space-y-3">
          {data?.owned.map((classroom) => (
            <Link key={classroom.id} href={`/trainer/${classroom.id}`}>
              <Panel className="transition-colors hover:border-brand-400/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-white">
                      {classroom.name}
                    </h2>
                    {classroom.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-400">
                        {classroom.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Pill tone="info">code {classroom.joinCode}</Pill>
                      <Pill>
                        {classroom._count?.memberships ?? 0} approved
                      </Pill>
                      {classroom.tokenAddress ? (
                        <Pill tone="success">
                          token {shortenAddress(classroom.tokenAddress)}
                        </Pill>
                      ) : (
                        <Pill tone="warning">contracts not deployed</Pill>
                      )}
                      {/* Rows created before a network switch stay pinned to
                          the old chain and cannot be used from this one. */}
                      {classroom.chainId !== CHAIN_ID && (
                        <Pill tone="danger">
                          on {chainName(classroom.chainId)}
                        </Pill>
                      )}
                    </div>
                  </div>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      </div>

      <CreateClassroom />
    </div>
  );
}

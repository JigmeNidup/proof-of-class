"use client";

import Link from "next/link";
import { use } from "react";

import { AuthGate } from "@/components/auth-gate";
import { SiteHeader } from "@/components/site-header";
import { QuickCallAnswer } from "@/components/trainee/quick-call-answer";

export default function QuickCallPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const { classroomId } = use(params);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-10">
        <AuthGate>
          <div className="space-y-4">
            <Link
              href={`/dashboard/${classroomId}`}
              className="text-xs text-ink-400 hover:text-white"
            >
              ← Back to classroom
            </Link>
            <QuickCallAnswer classroomId={classroomId} />
          </div>
        </AuthGate>
      </main>
    </div>
  );
}

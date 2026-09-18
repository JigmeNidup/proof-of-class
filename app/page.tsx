import Link from "next/link";

import { BadgeLegend } from "@/components/badge-stack";
import { SiteHeader } from "@/components/site-header";
import { Panel } from "@/components/ui";

const FEATURES = [
  {
    title: "Points that actually settle",
    body: "Trainers mint ERC-20 reward points straight to a trainee's wallet. Every award carries its category on-chain, so the ledger is auditable without trusting the app.",
  },
  {
    title: "Two badge tiers",
    body: "Weekly toppers earn a cyan hexagon, monthly champions a gold eight-pointed star. Repeat wins stack as ERC-1155 balance rather than a wall of duplicate NFTs.",
  },
  {
    title: "Millisecond quick-calls",
    body: "The trainer fires a question and every connected trainee gets a full-screen buzzer. Ranking uses server arrival time, so a fast clock cannot fake a fast finger.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-5 py-14">
        <section className="max-w-2xl">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-brand-400">
            On-chain classroom rewards
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Proof of participation, not just attendance.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-300">
            ProofOfClass gives trainers a points token and badge collection
            owned by their own wallet — after the platform owner approves them.
            Trainees join with a code, earn points they can verify on a block
            explorer, and race each other in live quick-call rounds.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              Join as a trainee
            </Link>
            <Link
              href="/trainer"
              className="rounded-lg border border-ink-600 bg-ink-800 px-5 py-2.5 text-sm font-medium text-ink-300 transition-colors hover:border-ink-400 hover:text-white"
            >
              Run a classroom
            </Link>
          </div>
        </section>

        <section className="mt-14 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <Panel key={feature.title}>
              <h2 className="text-sm font-semibold text-white">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">
                {feature.body}
              </p>
            </Panel>
          ))}
        </section>

        <section className="mt-4">
          <Panel title="Badge tiers">
            <BadgeLegend />
          </Panel>
        </section>
      </main>
    </div>
  );
}

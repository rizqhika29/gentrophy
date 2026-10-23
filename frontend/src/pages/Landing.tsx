import { Link } from "react-router-dom";
import VanishRun from "@/components/ui/hero-ascii-tunnel";
import { StatsStrip } from "@/components/StatsStrip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";
import {
  ClipboardCheck,
  Coins,
  Gavel,
  Link2,
  Lock,
  Sparkles,
  Trophy,
  Workflow,
} from "lucide-react";

const features = [
  {
    icon: Gavel,
    title: "AI Consensus Judging",
    desc: "Independent GenLayer validators score submitted work against your plain-English rubric. No single judge, no admin key.",
  },
  {
    icon: Lock,
    title: "Escrowed Rewards",
    desc: "GEN is locked on-chain at creation. Solvers know the prize is real before they invest hours of work.",
  },
  {
    icon: Coins,
    title: "Automatic Payout",
    desc: "Score ≥ threshold → transfer emits immediately at decision. Fail → poster can reclaim. No manual claims.",
  },
  {
    icon: ClipboardCheck,
    title: "Rubric-Driven Scoring",
    desc: "You define the criteria in plain English. Validators return score 0–100, pass/fail, and human-readable feedback.",
  },
  {
    icon: Workflow,
    title: "Transparent Lifecycle",
    desc: "open → submitted → reviewing → paid / failed / refunded. Every transition is a decided on-chain transaction.",
  },
  {
    icon: Link2,
    title: "Work On The Open Web",
    desc: "Solvers submit public URLs. Anyone can verify what was judged — no opaque uploads or private attachments.",
  },
];

const steps = [
  {
    n: "01",
    title: "Post a bounty",
    desc: "Title, rubric, min_score, reward GEN, deadline. Funds escrow into the contract.",
  },
  {
    n: "02",
    title: "Submit work",
    desc: "Any solver attaches a public URL before the deadline. Status flips to submitted.",
  },
  {
    n: "03",
    title: "AI validators score",
    desc: "Consensus runs your rubric through independent LLM validators, ±tolerance agreement.",
  },
  {
    n: "04",
    title: "Payout or refund",
    desc: "Pass → GEN to solver. Fail → poster reclaims. Everything decided on-chain.",
  },
];

export function Landing() {
  return (
    <>
      <section id="top">
        <VanishRun cellSize={14} className="min-h-[85vh]">
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] tracking-widest text-primary uppercase">
            On GenLayer Studionet
          </span>
          <h1 className="bg-gradient-to-b from-foreground via-foreground/90 to-primary/70 bg-clip-text font-mono text-4xl font-bold tracking-tight text-transparent sm:text-6xl">
            GenTrophy
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Post a bounty. Submit work. AI validators score it against your
            rubric. GEN pays automatically — trustless, on-chain, transparent.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/app"
              className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Explore Bounties
            </Link>
            <Link to="/how-it-works">
              <Button variant="outline" size="lg">
                How It Works
              </Button>
            </Link>
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            escrow · consensus scoring · auto payout
          </p>
        </VanishRun>
      </section>

      <section className="mt-10">
        <StatsStrip />
      </section>

      <section className="mx-auto mt-20 w-full max-w-6xl px-4">
        <div className="mb-10 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Why GenTrophy</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
            Bounties without middlemen
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Escrow, judging, and payout live in one Intelligent Contract —
            executed by GenLayer’s AI consensus instead of a human admin.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="group transition-colors hover:border-primary/40">
              <CardContent className="p-5">
                <f.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 w-full max-w-6xl px-4">
        <div className="mb-10 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Lifecycle</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Four steps to settled work</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <Card key={s.n}>
              <CardContent className="p-5">
                <p className="font-mono text-2xl font-bold text-primary/80">{s.n}</p>
                <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link to="/how-it-works">
            <Button variant="secondary">
              <Workflow /> Read the full flow
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-24 w-full max-w-6xl px-4">
        <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-card via-card to-primary/5">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold sm:text-3xl">
              Ready to run a fair bounty?
            </h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              Connect your wallet, fund an escrow, and let AI consensus handle
              judging and payout — no spreadsheets, no trusted reviewer.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/app">
                <Button size="lg">
                  <Trophy /> Launch App
                </Button>
              </Link>
              <Link to="/features">
                <Button variant="outline" size="lg">
                  Explore Features
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

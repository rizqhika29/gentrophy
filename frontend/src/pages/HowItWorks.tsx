import { Link } from "react-router-dom";
import { Card, CardContent, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Coins,
  Gavel,
  RefreshCcw,
  Send,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

const roles = [
  {
    icon: UserPlus,
    role: "Poster",
    tone: "text-primary",
    steps: [
      {
        t: "Define the bounty",
        d: "Title, task type (article/feature), plain-English rubric (min 20 chars), min_score 0–100, reward GEN, deadline.",
      },
      {
        t: "Escrow the reward",
        d: "value is sent with the create_bounty tx. GEN is locked inside the contract — not to any operator.",
      },
      {
        t: "Wait for review",
        d: "Once a solver submits, anyone can trigger review_work. Validators reach consensus on a score.",
      },
      {
        t: "Outcome",
        d: "Pass → solver paid. Fail → you reclaim via reclaim_after_fail. Cancel before submission → full refund.",
      },
    ],
  },
  {
    icon: Send,
    role: "Solver",
    tone: "text-sky-300",
    steps: [
      {
        t: "Browse open bounties",
        d: "Every open bounty shows reward, rubric, min_score, and deadline — the full judging criteria up front.",
      },
      {
        t: "Submit a public URL",
        d: "Post your article, gist, repo, or demo link. HTTP(S) only; the work stays verifiable by anyone.",
      },
      {
        t: "Get scored",
        d: "Validators evaluate your work against the rubric and return score + feedback via consensus.",
      },
      {
        t: "Get paid",
        d: "If score ≥ min_score the contract emits a GEN transfer to you at decision (finalizes after appeal window).",
      },
    ],
  },
  {
    icon: Gavel,
    role: "AI Validators",
    tone: "text-success",
    steps: [
      {
        t: "Deterministic leader run",
        d: "A leader executes the review: fetch work, score vs rubric, return {score, pass, feedback}.",
      },
      {
        t: "Independent re-runs",
        d: "Other validators re-execute. Scores must agree within tolerance (±10) and cross the min_score gate.",
      },
      {
        t: "Consensus decision",
        d: "Majority agreement → ACCEPTED (e.g. MAJORITY_AGREE). Disagreement → rotated rounds, then decided result.",
      },
      {
        t: "State transition",
        d: "On success the contract sets status paid/failed, updates score+feedback, and emits payout if passed.",
      },
    ],
  },
];

const lifecycle = [
  { s: "open", d: "Escrowed. Accepts cancel (poster) or work submission (any solver).", tone: "text-primary" },
  { s: "submitted", d: "Work URL locked. review_work can be triggered.", tone: "text-sky-300" },
  { s: "reviewing", d: "AI consensus in progress — score being decided.", tone: "text-amber-300" },
  { s: "paid", d: "score ≥ min_score. Payout emitted to solver.", tone: "text-success" },
  { s: "failed", d: "score < min_score. Poster can reclaim escrow.", tone: "text-destructive" },
  { s: "refunded", d: "Cancelled or reclaimed — GEN back with poster.", tone: "text-muted-foreground" },
];

const faqs = [
  {
    q: "Who decides the score?",
    a: "A consensus of independent GenLayer validators running LLM reviews. No single party can force a verdict, and the leader’s execution is re-checked by others.",
  },
  {
    q: "Is the deadline enforced on-chain?",
    a: "The deadline is advisory — enforced by the UI. There is no primitive on-chain clock in GenVM, so the interface blocks late submissions while the rubric and payout remain on-chain.",
  },
  {
    q: "When does the solver actually receive GEN?",
    a: "The transfer is emitted when the review decision reaches ACCEPTED, but settlement finalizes at FINALIZED after the appeal window. UI states show both.",
  },
  {
    q: "What if validators disagree?",
    a: "Scores are compared with a ±10 tolerance plus the min_score gate. Persistent disagreement rotates leaders/validators until consensus or a decided failure result.",
  },
  {
    q: "Can the poster cheat after seeing work?",
    a: "Cancel is only allowed while status is open. Once submitted, the escrow is committed to the review outcome.",
  },
];

export function HowItWorks() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14">
      <div className="mb-12 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-primary">Docs</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">How It Works</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          GenTrophy turns bounty review into an on-chain, AI-judged state
          machine: escrow → submission → consensus score → payout or refund.
          Here’s the complete flow for every participant.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.role}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <r.icon className={`h-5 w-5 ${r.tone}`} />
                <h2 className="text-base font-semibold">{r.role}</h2>
              </div>
              <ol className="mt-5 space-y-5">
                {r.steps.map((s, i) => (
                  <li key={s.t} className="relative border-l border-border pl-4">
                    <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <p className="text-xs font-semibold text-foreground">
                      <span className="mr-1.5 font-mono text-muted-foreground">
                        {i + 1}.
                      </span>
                      {s.t}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {s.d}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="text-xl font-bold">Bounty lifecycle</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Every bounty is exactly one of these states — transitions only via
          decided transactions.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lifecycle.map((l) => (
            <Card key={l.s}>
              <CardContent className="p-4">
                <Badge className="uppercase" >
                  <span className={l.tone}>{l.s}</span>
                </Badge>
                <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                  {l.d}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, t: "Escrow-first", d: "Reward locked before any work begins." },
          { icon: Coins, t: "Auto settlement", d: "Pass → transfer emitted; fail → reclaim." },
          { icon: RefreshCcw, t: "Appeal window", d: "Decided once, finalized after cooling period." },
        ].map((c) => (
          <Card key={c.t}>
            <CardContent className="flex items-start gap-3 p-4">
              <c.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold">{c.t}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.d}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold">FAQ</h2>
        <div className="mt-5 space-y-3">
          {faqs.map((f) => (
            <Card key={f.q}>
              <CardContent className="p-5">
                <p className="flex items-start gap-2 text-sm font-semibold">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {f.q}
                </p>
                <p className="mt-2 pl-6 text-xs leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link to="/app">
          <Button>
            <Gavel /> Open the App
          </Button>
        </Link>
        <Link to="/features">
          <Button variant="outline">Explore Features</Button>
        </Link>
      </div>
    </div>
  );
}

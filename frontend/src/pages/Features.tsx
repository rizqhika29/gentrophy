import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ScoreBar, ConsensusPanel } from "@/components/Consensus";
import {
  BarChart3,
  BrainCircuit,
  Coins,
  FileText,
  Gauge,
  Lock,
  Network,
  ScrollText,
  Trophy,
} from "lucide-react";

const featureGroups = [
  {
    icon: Lock,
    title: "Trustless Escrow",
    items: [
      "create_bounty is payable — reward GEN locked in contract state",
      "Cancel only while open → full refund to poster",
      "Failed verdict → reclaim_after_fail returns escrow",
      "Dead work URL at review → consensus settles failed (never stuck)",
      "poster_retract frees a pending submission back to open",
      "Solver can verify funds exist before submitting work",
    ],
  },
  {
    icon: BrainCircuit,
    title: "AI Consensus Review",
    items: [
      "Leader executes review: fetch work URL, score vs rubric",
      "Validators re-run independently with ±10 score tolerance",
      "Custom min_score gate baked into agreement rules",
      "Error taxonomy: [EXPECTED] / [EXTERNAL] / [TRANSIENT] / [LLM_ERROR]",
    ],
  },
  {
    icon: Gauge,
    title: "Scoring Model",
    items: [
      "score 0–100 integer returned per review",
      "pass ⇔ score ≥ bounty.min_score",
      "Human-readable feedback stored on-chain with the verdict",
      "UI shows score bar with threshold marker for instant reading",
    ],
  },
  {
    icon: Network,
    title: "Consensus Transparency",
    items: [
      "Per-validator votes (agree / disagree / idle) from receipt",
      "Round count, leader address, execution result surfaced",
      "result_name (e.g. MAJORITY_AGREE) shown on every decision",
      "Direct explorer links for each transaction hash",
    ],
  },
  {
    icon: Coins,
    title: "Payout Mechanics",
    items: [
      "Pass → emit_transfer to solver at decision",
      "Poster total_paid_wei tracked in get_stats",
      "ACCEPTED ≠ settled — FINALIZED after appeal window",
      "UI distinguishes submitted / decided / finalized lifecycle",
    ],
  },
  {
    icon: ScrollText,
    title: "Rubric-Driven Criteria",
    items: [
      "Plain-English rubric up to 4,000 chars stored on-chain",
      "task_type tags: article or feature",
      "Deadline advisory — enforced by UI (no on-chain clock)",
      "Full criteria visible before any solver commits effort",
    ],
  },
];

const statsPreview = {
  score: 84,
  minScore: 70,
};

const sampleConsensus = {
  result_name: "MAJORITY_AGREE",
  num_rounds: "1",
  leader: "0x9f3c1a7e4b2d8f6051a9c3e7b4d2f8a1c6e5b903",
  votes: [
    { address: "0x9f3c1a7e4b2d8f6051a9c3e7b4d2f8a1c6e5b903", vote: "agree" },
    { address: "0x2b7d4f91c6e3a805f2d1b7c94e6a3f508d1c2b64", vote: "agree" },
    { address: "0x61e8a2d5c9f4b703e1d8a6c2f59b3d70e4a1c8f2", vote: "agree" },
    { address: "0x07f2b9c4e6a1d3805f9c2b7d4e6a1f38c5d9b2a0", vote: "idle" },
  ],
  leader_execution: "FINISHED_WITH_RETURN",
  leader_error: null,
};

export function Features() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14">
      <div className="mb-12 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-primary">Capabilities</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Features</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Everything GenTrophy does lives in one Intelligent Contract plus a
          thin, wallet-safe UI. Below is what each layer actually provides.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {featureGroups.map((g) => (
          <Card key={g.title} className="hover:border-primary/40">
            <CardContent className="p-6">
              <div className="flex items-center gap-2.5">
                <g.icon className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">{g.title}</h2>
              </div>
              <ul className="mt-4 space-y-2.5">
                {g.items.map((it) => (
                  <li
                    key={it}
                    className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {it}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Score vs threshold</h2>
            </div>
            <ScoreBar score={statsPreview.score} minScore={statsPreview.minScore} />
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              The marker shows <span className="text-foreground">min_score</span>{" "}
              for the bounty. Green = paid verdict; red = failed and reclaimable.
              Feedback text from validators is stored alongside the score.
            </p>
            <div className="mt-4 rounded-md border border-border bg-muted/20 p-3 text-xs text-foreground/90">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sample feedback
              </span>
              Clear structure and a concrete code example; missed edge-case
              discussion required by rubric item 3.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Consensus receipt panel</h2>
            </div>
            <ConsensusPanel
              consensus={sampleConsensus}
              statusLine="ACCEPTED / FINISHED_WITH_RETURN"
              txHash="0x78d9a52f2f095bb62b5311ef232411e2728ae4a3a70bff516f128960970dbf5a"
            />
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              After every write the UI surfaces vote breakdown, leader execution,
              round count, and an explorer link — so you never trust a silent
              spinner.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold">Contract surface</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Method</th>
                <th className="py-2 pr-4 font-medium">Kind</th>
                <th className="py-2 font-medium">Args / Returns</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[
                ["create_bounty", "payable write", "title, task_type, rubric, min_score, deadline"],
                ["submit_work", "write", "bounty_id, work_url"],
                ["review_work", "write", "bounty_id → runs AI consensus"],
                ["cancel_bounty", "write", "bounty_id (poster, open only)"],
                ["reclaim_after_fail", "write", "bounty_id (poster, failed only)"],
                ["poster_retract", "write", "bounty_id (poster, submitted only)"],
                ["get_bounty", "view", "bounty_id → full state dict"],
                ["get_open_bounties", "view", "→ open bounty summaries"],
                ["get_stats", "view", "→ total_created, total_paid_wei, next_id"],
              ].map(([m, k, a]) => (
                <tr key={m} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-primary">{m}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{k}</td>
                  <td className="py-2 text-foreground/80">{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14">
        <Card className="border-primary/30 bg-gradient-to-br from-card to-primary/5">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">See it in action</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Launch the app to post a bounty, submit work, and watch the
              consensus panel fill in live.
            </p>
            <div className="flex gap-3">
              <Link to="/app">
                <Button>
                  <Trophy /> Launch App
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button variant="outline">How It Works</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

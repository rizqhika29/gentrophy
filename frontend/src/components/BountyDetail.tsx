import { useState, type FormEvent } from "react";
import {
  ExternalLink,
  Trophy,
  XCircle,
  RotateCcw,
  ClipboardCheck,
  Send,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  Input,
  Label,
  Skeleton,
} from "@/components/ui/primitives";
import { ScoreBar } from "@/components/Consensus";
import { TxProgress } from "@/components/TxProgress";
import { useBounty, useTxRunner } from "@/hooks/useContract";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/components/ui/toast";
import { submitWorkBlock } from "@/lib/rules";
import { cn, formatGen, shortAddress } from "@/lib/utils";
import { CONTRACT_ADDRESS } from "@/lib/config";
import type { Bounty, BountyStatus } from "@/lib/types";

const STATUS_TONE: Record<BountyStatus, string> = {
  open: "border-primary/50 bg-primary/10 text-primary",
  submitted: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  reviewing: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  paid: "border-success/50 bg-success/10 text-success",
  failed: "border-destructive/50 bg-destructive/10 text-destructive",
  refunded: "border-border bg-muted/40 text-muted-foreground",
};

export function BountyStatusBadge({ status }: { status: BountyStatus }) {
  return <Badge className={cn("uppercase", STATUS_TONE[status] ?? "")}>{status}</Badge>;
}

function deadlineLabel(ts: number): string {
  if (!ts) return "no deadline";
  const d = new Date(ts * 1000);
  const diff = d.getTime() - Date.now();
  if (Number.isNaN(d.getTime())) return "invalid deadline";
  const abs = Math.abs(diff);
  const days = Math.round(abs / (24 * 3600 * 1000));
  const base = d.toISOString().slice(0, 10);
  if (ts * 1000 < Date.now()) return `${base} (${days}d ago)`;
  return `${base} (${days}d left · advisory)`;
}

function isValidHttpsUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
}

export function BountyDetail({
  bountyId,
  onClose,
}: {
  bountyId: number;
  onClose: () => void;
}) {
  const { address, wrongNetwork } = useWallet();
  const { bounty, loading, error, refresh } = useBounty(bountyId);
  const { run, progress, busy } = useTxRunner();
  const toast = useToast();
  const [workUrl, setWorkUrl] = useState("");

  const isPoster =
    address != null && bounty != null && bounty.poster.toLowerCase() === address.toLowerCase();
  const solverZero =
    bounty != null && /^0x0+$/i.test(bounty.solver);

  const urlValid = isValidHttpsUrl(workUrl.trim());

  // null = form available. Contract has no clock (GenVM has no timestamp
  // primitive), so the poster/expiry rules are enforced here — which is what
  // the FAQ ("the interface blocks late submissions") promises.
  const submitBlock = bounty ? submitWorkBlock(bounty, address) : "closed";
  const expired = submitBlock === "expired";
  const posterNote = submitBlock === "poster";

  const canSubmit = submitBlock === null;
  const canReview = bounty?.status === "submitted";
  const canCancel = bounty?.status === "open" && isPoster;
  const canReclaim = bounty?.status === "failed" && isPoster;
  const canRetract = bounty?.status === "submitted" && isPoster;

  const actionDisabled = busy || !address || wrongNetwork;

  const submitTx = async (
    functionName: string,
    args: unknown[],
    successTitle: string,
    value?: bigint,
  ) => {
    if (busy) return;
    const toastId = toast.push({
      kind: "pending",
      title: `${functionName}…`,
      description: "Waiting for wallet + consensus",
    });
    const result = await run({
      functionName,
      args,
      ...(value != null ? { value } : {}),
      successTitle,
      onDone: () => {
        void refresh();
      },
    });
    if (result.ok) {
      toast.update(toastId, {
        kind: "success",
        title: successTitle,
        description: result.statusLine
          ? `Decision: ${result.statusLine}. GEN moves only after FINALIZED.`
          : undefined,
        href: result.txHash
          ? `https://genlayer-explorer.vercel.app/tx/${result.txHash}`
          : undefined,
      });
      // refresh shortly after decision so score/status appear
      window.setTimeout(() => void refresh(), 1500);
    } else {
      // Post-submit failures carry the on-chain reason; TxProgress renders it
      // (progress.consensus) with the receipt + explorer link.
      toast.update(toastId, {
        kind: "error",
        title: `${functionName} failed`,
        description: result.error,
      });
    }
  };

  const onSubmitWork = (e: FormEvent) => {
    e.preventDefault();
    if (busy || !urlValid || !bounty) return;
    const block = submitWorkBlock(bounty, address);
    if (block) return;
    void submitTx("submit_work", [BigInt(bounty.bounty_id), workUrl.trim()], "Work submitted");
  };

  if (loading && !bounty) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XCircle /> Close
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!bounty) return null;

  return (
    <Card className="relative">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                #{bounty.bounty_id}
              </span>
              <BountyStatusBadge status={bounty.status} />
              <Badge className="border-border text-muted-foreground">{bounty.task_type}</Badge>
            </div>
            <h3 className="text-lg font-semibold leading-tight">{bounty.title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close detail">
            <XCircle />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <Meta label="Reward" value={formatGen(bounty.reward_wei)} />
          <Meta label="min_score" value={String(bounty.min_score)} />
          <Meta label="Poster" value={shortAddress(bounty.poster)} mono />
          <Meta
            label="Solver"
            value={solverZero ? "—" : shortAddress(bounty.solver)}
            mono={!solverZero}
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rubric
          </p>
          <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-3 text-sm leading-relaxed text-foreground/90">
            {bounty.rubric}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          deadline: {deadlineLabel(bounty.deadline)} — enforced off-chain by UI
          {expired ? " (passed: submissions are blocked)" : ""}
        </p>

        {bounty.work_url ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Work URL
            </p>
            <a
              href={bounty.work_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 break-all text-sm text-primary hover:underline"
            >
              {bounty.work_url} <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        ) : null}

        {posterNote ? (
          <p className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            This is your bounty — you cannot submit work to it.
          </p>
        ) : null}

        {expired && bounty.status === "open" ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
            Deadline has passed — the UI blocks late submissions for this bounty.
          </p>
        ) : null}

        {canSubmit ? (
          <form onSubmit={onSubmitWork} className="space-y-2 rounded-md border border-border p-3">
            <Label htmlFor="work-url">Submit work URL (http/https)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="work-url"
                value={workUrl}
                onChange={(e) => setWorkUrl(e.target.value)}
                placeholder="https://gist.github.com/… or article link"
                disabled={actionDisabled}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={actionDisabled || !urlValid}
                loading={busy}
              >
                <Send /> Submit Work
              </Button>
            </div>
            {workUrl && !urlValid ? (
              <p className="text-xs text-destructive">Enter a valid http(s) URL</p>
            ) : null}
            {!address ? (
              <p className="text-xs text-muted-foreground">Connect wallet to submit work.</p>
            ) : null}
          </form>
        ) : null}

        {canReview ? (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
            <p className="mb-2 text-sm text-foreground/90">
              Work is on-chain. Trigger AI validator consensus review.
            </p>
            <Button
              onClick={() =>
                void submitTx("review_work", [BigInt(bounty.bounty_id)], "Review complete")
              }
              disabled={actionDisabled}
              loading={busy}
            >
              <ClipboardCheck /> Run AI Review
            </Button>
          </div>
        ) : null}

        {canRetract ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="mb-2 text-sm text-foreground/90">
              Poster recovery: retract the pending submission to reopen the
              bounty — escrow stays locked, solver slot is freed. Prefer
              running the review; retract if the URL is dead or the round is stuck.
            </p>
            <Button
              variant="secondary"
              onClick={() =>
                void submitTx("poster_retract", [BigInt(bounty.bounty_id)], "Submission retracted")
              }
              disabled={actionDisabled}
              loading={busy}
            >
              <Undo2 /> Retract & Reopen
            </Button>
          </div>
        ) : null}

        {canCancel ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={() =>
                void submitTx("cancel_bounty", [BigInt(bounty.bounty_id)], "Bounty cancelled")
              }
              disabled={actionDisabled}
              loading={busy}
            >
              <XCircle /> Cancel & Refund
            </Button>
          </div>
        ) : null}

        {canReclaim ? (
          <Button
            variant="secondary"
            onClick={() =>
              void submitTx(
                "reclaim_after_fail",
                [BigInt(bounty.bounty_id)],
                "Reclaimed after fail",
              )
            }
            disabled={actionDisabled}
            loading={busy}
          >
            <RotateCcw /> Reclaim Funds
          </Button>
        ) : null}

        {(bounty.status === "paid" ||
          bounty.status === "failed" ||
          bounty.status === "refunded") && (
          <ScoreAndVerdict bounty={bounty} />
        )}

        {bounty.status === "submitted" || bounty.status === "reviewing" ? (
          <p className="text-xs text-muted-foreground">
            Awaiting review… scores appear after AI consensus decides.
          </p>
        ) : null}

        {/* decision, receipt, explorer link and consensus (success or failure)
            all come from the runner's progress — a single source of truth */}
        <TxProgress progress={progress} />
      </CardContent>
    </Card>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/15 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm text-foreground", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function ScoreAndVerdict({ bounty }: { bounty: Bounty }) {
  const passed = bounty.score >= bounty.min_score && bounty.status === "paid";
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        {passed ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-success/50 bg-success/10 px-2 py-1 text-xs font-semibold text-success">
            <Trophy className="h-3.5 w-3.5" /> PAID
          </span>
        ) : bounty.status === "failed" ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
            <XCircle className="h-3.5 w-3.5" /> FAILED
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            {bounty.status === "refunded" ? "REFUNDED" : bounty.status}
          </span>
        )}
      </div>
      {bounty.status === "paid" || bounty.status === "failed" ? (
        <ScoreBar score={bounty.score} minScore={bounty.min_score} />
      ) : null}
      {bounty.feedback ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            AI feedback
          </p>
          <p className="text-sm leading-relaxed text-foreground/90">{bounty.feedback}</p>
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        GEN payout finalizes after the appeal window (FINALIZED), not at ACCEPTED.
      </p>
    </div>
  );
}

export const CONTRACT_SHORT =
  CONTRACT_ADDRESS.slice(0, 10) + "…" + CONTRACT_ADDRESS.slice(-6);

import { Link } from "react-router-dom";
import { CONTRACT_SHORT } from "@/components/BountyDetail";
import { CONTRACT_ADDRESS, EXPLORER_TX, FAUCET_URL } from "@/lib/config";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/60 py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <span className="text-primary">◆</span> GenTrophy
          </p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Trustless AI-judged bounty review & payout on GenLayer. Post work,
            let consensus score it, GEN moves automatically.
          </p>
        </div>
        <div className="text-xs">
          <p className="mb-3 font-semibold uppercase tracking-wide text-muted-foreground">
            Explore
          </p>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li><Link to="/how-it-works" className="hover:text-primary">How It Works</Link></li>
            <li><Link to="/features" className="hover:text-primary">Features</Link></li>
            <li><Link to="/app" className="hover:text-primary">Launch App</Link></li>
          </ul>
        </div>
        <div className="text-xs">
          <p className="mb-3 font-semibold uppercase tracking-wide text-muted-foreground">
            Network
          </p>
          <ul className="space-y-2 text-muted-foreground">
            <li><span className="rounded border border-border px-2 py-0.5">GenLayer Studionet</span></li>
            <li>
              <a
                href={`https://genlayer-explorer.vercel.app/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono hover:text-primary"
              >
                {CONTRACT_SHORT}
              </a>
            </li>
            <li>
              <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="hover:text-primary">
                Faucet
              </a>
              <span className="mx-2 opacity-40">·</span>
              <a
                href={EXPLORER_TX("").replace(/\/tx\/$/, "")}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary"
              >
                Explorer
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-8 flex w-full max-w-6xl flex-col items-center justify-between gap-2 border-t border-border/40 px-4 pt-6 text-[11px] text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} GenTrophy — Work that pays. Judged by AI consensus.</p>
        <p className="font-mono">on-chain · deterministic · optimistic</p>
      </div>
    </footer>
  );
}

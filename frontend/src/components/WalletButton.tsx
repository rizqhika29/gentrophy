import { useState } from "react";
import { Wallet, LogOut, ChevronDown, AlertTriangle } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { shortAddress, extractErrorMessage } from "@/lib/utils";
import { CHAIN_ID_DEC, FAUCET_URL } from "@/lib/config";
import { useToast } from "@/components/ui/toast";

export function WalletButton() {
  const {
    address,
    chainId,
    connecting,
    wallets,
    needsWallet,
    wrongNetwork,
    connect,
    disconnect,
    switchNetwork,
  } = useWallet();
  const toast = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (needsWallet) {
    return (
      <a
        href="https://metamask.io"
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Wallet className="h-4 w-4" /> Install MetaMask
      </a>
    );
  }

  if (!address) {
    const onClick = async () => {
      try {
        if (wallets.length > 1) {
          setPickerOpen((v) => !v);
          return;
        }
        await connect(wallets[0]?.id);
      } catch (err) {
        toast.error("Connect failed", extractErrorMessage(err));
      }
    };

    return (
      <div className="relative">
        <Button onClick={() => void onClick()} loading={connecting}>
          <Wallet /> {connecting ? "Connecting…" : "Connect Wallet"}
        </Button>
        {pickerOpen && wallets.length > 1 ? (
          <div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-md border bg-popover p-1 shadow-xl">
            {wallets.map((w) => (
              <button
                key={w.id}
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent"
                onClick={() => {
                  setPickerOpen(false);
                  void connect(w.id).catch((err) =>
                    toast.error("Connect failed", extractErrorMessage(err)),
                  );
                }}
              >
                {w.label}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (wrongNetwork) {
    return (
      <div className="flex items-center gap-2">
        <BadgeWarn text={`Chain ${chainId ?? "?"} ≠ ${CHAIN_ID_DEC}`} />
        <Button variant="destructive" onClick={() => void switchNetwork().catch((e) => toast.error("Switch failed", extractErrorMessage(e)))} loading={connecting}>
          Switch to Studionet
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={FAUCET_URL}
        target="_blank"
        rel="noreferrer"
        className="hidden h-9 items-center rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-accent sm:inline-flex"
      >
        Faucet
      </a>
      <span className="hidden rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-foreground sm:inline">
        {shortAddress(address)}
      </span>
      <Button variant="outline" size="sm" onClick={disconnect} title="Disconnect">
        <LogOut /> Disconnect
      </Button>
    </div>
  );
}

function BadgeWarn({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
      <AlertTriangle className="h-3 w-3" /> {text}
    </span>
  );
}

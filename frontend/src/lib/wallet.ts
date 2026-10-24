/**
 * Multi-wallet-safe EIP-1193 detection.
 * Never hijacks window.ethereum; never requests accounts on an unselected provider.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  isMetaMask?: boolean;
  isRabby?: boolean;
  providers?: Eip1193Provider[];
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export interface WalletOption {
  id: string;
  label: string;
  provider: Eip1193Provider;
}

function getWindowEthereum(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
}

export function listWalletProviders(): WalletOption[] {
  const eth = getWindowEthereum();
  if (!eth) return [];

  const raw: Eip1193Provider[] = Array.isArray(eth.providers) && eth.providers.length
    ? eth.providers
    : [eth];

  const seen = new Set<string>();
  const options: WalletOption[] = [];

  for (const p of raw) {
    let label = "Browser Wallet";
    let id = "injected";
    if (p.isMetaMask) {
      label = "MetaMask";
      id = "metamask";
    } else if (p.isRabby) {
      label = "Rabby";
      id = "rabby";
    }
    if (seen.has(id)) continue;
    seen.add(id);
    options.push({ id, label, provider: p });
  }

  return options;
}

export function hasInjectedWallet(): boolean {
  return listWalletProviders().length > 0;
}

export async function requestAccounts(provider: Eip1193Provider): Promise<string[]> {
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.length) throw new Error("No accounts returned by wallet");
  return accounts;
}

export async function getChainId(provider: Eip1193Provider): Promise<number> {
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  return Number.parseInt(hex, 16);
}

export async function switchToStudionet(provider: Eip1193Provider): Promise<void> {
  const chainIdHex = "0xf22f";
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: "GenLayer Studio Network",
            nativeCurrency: { name: "GenLayer", symbol: "GEN", decimals: 18 },
            rpcUrls: ["https://studio.genlayer.com/api"],
          },
        ],
      });
      return;
    }
    throw err;
  }
}

export function subscribeProviderEvents(
  provider: Eip1193Provider,
  handlers: {
    onAccountsChanged?: (accounts: string[]) => void;
    onChainChanged?: (chainId: string) => void;
  },
): () => void {
  const onAccounts = (...args: unknown[]) => {
    handlers.onAccountsChanged?.((args[0] as string[]) ?? []);
  };
  const onChain = (...args: unknown[]) => {
    handlers.onChainChanged?.(String(args[0] ?? ""));
  };
  provider.on?.("accountsChanged", onAccounts);
  provider.on?.("chainChanged", onChain);
  return () => {
    provider.removeListener?.("accountsChanged", onAccounts);
    provider.removeListener?.("chainChanged", onChain);
  };
}

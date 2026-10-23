import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createReadClient,
  createWriteClient,
  ensureWalletOnNetwork,
} from "@/lib/genlayer";
import {
  getChainId,
  listWalletProviders,
  requestAccounts,
  subscribeProviderEvents,
  switchToStudionet,
  type Eip1193Provider,
  type WalletOption,
} from "@/lib/wallet";
import { CHAIN_ID_DEC } from "@/lib/config";

interface WalletState {
  address: string | null;
  chainId: number | null;
  connecting: boolean;
  provider: Eip1193Provider | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeClient: any;
  wallets: WalletOption[];
  needsWallet: boolean;
  wrongNetwork: boolean;
  connect: (walletId?: string) => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

function asHexAddress(a: string): `0x${string}` {
  return a as `0x${string}`;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const readClient = useMemo(() => createReadClient(), []);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setWallets(listWalletProviders());
  }, []);

  const cleanup = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setAddress(null);
    setChainId(null);
    setProvider(null);
  }, [cleanup]);

  const connect = useCallback(
    async (walletId?: string) => {
      const options = listWalletProviders();
      if (!options.length) {
        throw new Error(
          "No EIP-1193 wallet found. Install MetaMask or another browser wallet.",
        );
      }
      const selected =
        options.find((w) => w.id === walletId) ??
        (options.length === 1 ? options[0] : options.find((w) => w.id === "metamask"));
      if (!selected) {
        throw new Error("Select a wallet to continue.");
      }

      setConnecting(true);
      try {
        const accounts = await requestAccounts(selected.provider);
        const cid = await getChainId(selected.provider);
        cleanup();
        setProvider(selected.provider);
        setAddress(asHexAddress(accounts[0]));
        setChainId(cid);
        unsubRef.current = subscribeProviderEvents(selected.provider, {
          onAccountsChanged: (accs) => {
            if (!accs.length) {
              disconnect();
              return;
            }
            setAddress(asHexAddress(accs[0]));
          },
          onChainChanged: (cidHex) => {
            setChainId(Number.parseInt(cidHex, 16));
          },
        });

        if (cid !== CHAIN_ID_DEC) {
          try {
            await switchToStudionet(selected.provider);
            setChainId(CHAIN_ID_DEC);
          } catch {
            // leave wrongNetwork banner visible — user can switch manually
          }
        }
      } finally {
        setConnecting(false);
      }
    },
    [cleanup, disconnect],
  );

  const switchNetwork = useCallback(async () => {
    if (!provider) throw new Error("Connect a wallet first");
    setConnecting(true);
    try {
      await switchToStudionet(provider);
      await ensureWalletOnNetwork(provider);
      setChainId(await getChainId(provider));
    } finally {
      setConnecting(false);
    }
  }, [provider]);

  const writeClient = useMemo(() => {
    if (!address || !provider) return null;
    return createWriteClient(asHexAddress(address), provider);
  }, [address, provider]);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      connecting,
      provider,
      readClient,
      writeClient,
      wallets,
      needsWallet: wallets.length === 0,
      wrongNetwork: address != null && chainId != null && chainId !== CHAIN_ID_DEC,
      connect,
      disconnect,
      switchNetwork,
    }),
    [
      address,
      chainId,
      connecting,
      provider,
      readClient,
      writeClient,
      wallets,
      connect,
      disconnect,
      switchNetwork,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

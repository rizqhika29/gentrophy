export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x2C02539A051F62007254abFdFcF0982f0Fa4e7Ec") as `0x${string}`;

export const NETWORK = (import.meta.env.VITE_NETWORK || "studionet") as
  | "studionet"
  | "localnet"
  | "testnetBradbury"
  | "testnetAsimov";

export const CHAIN_ID_DEC = 61999;
export const CHAIN_ID_HEX = "0xf22f";
export const EXPLORER_TX = (hash: string) =>
  `https://genlayer-explorer.vercel.app/tx/${hash}`;
export const FAUCET_URL = "https://studio.genlayer.com/faucet";

import {defineChain} from 'viem';

function required(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const appId = required(import.meta.env.VITE_PRIVY_APP_ID);
const clientId = required(import.meta.env.VITE_PRIVY_CLIENT_ID);
const rpcUrl = required(import.meta.env.VITE_MONAD_RPC_URL);
const explorerUrl = required(import.meta.env.VITE_MONAD_EXPLORER_URL);
const chainIdText = required(import.meta.env.VITE_MONAD_CHAIN_ID);
const chainId = chainIdText && /^\d+$/.test(chainIdText) ? Number(chainIdText) : undefined;

export const privyConfig = {
  appId,
  clientId,
  isConfigured: Boolean(appId && rpcUrl && chainId),
  chain: rpcUrl && chainId
    ? defineChain({
        id: chainId,
        name: required(import.meta.env.VITE_MONAD_CHAIN_NAME) ?? 'Monad Testnet',
        nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
        rpcUrls: {default: {http: [rpcUrl]}},
        blockExplorers: explorerUrl
          ? {default: {name: 'Explorer', url: explorerUrl}}
          : undefined,
        testnet: true,
      })
    : undefined,
};

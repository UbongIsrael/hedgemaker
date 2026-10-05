import {defineChain, getAddress, isAddress, type Address} from 'viem';

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalAddress(value: string | undefined): Address | undefined {
  const text = optionalText(value);
  return text && isAddress(text) ? getAddress(text) : undefined;
}

function optionalPositiveInteger(value: string | undefined): bigint | undefined {
  const text = optionalText(value);
  return text && /^\d+$/.test(text) && BigInt(text) > 0n ? BigInt(text) : undefined;
}

const rpcUrl = optionalText(import.meta.env.VITE_MONAD_RPC_URL);
const explorerUrl = optionalText(import.meta.env.VITE_MONAD_EXPLORER_URL);
const chainIdValue = optionalPositiveInteger(import.meta.env.VITE_MONAD_CHAIN_ID);
const chainId = chainIdValue && chainIdValue <= BigInt(Number.MAX_SAFE_INTEGER)
  ? Number(chainIdValue)
  : undefined;
const deploymentBlock = optionalPositiveInteger(import.meta.env.VITE_DEPLOYMENT_BLOCK);
const marketConfigAddress = optionalAddress(import.meta.env.VITE_MARKET_CONFIG_ADDRESS);
const orderBookAddress = optionalAddress(import.meta.env.VITE_ORDER_BOOK_ADDRESS);
const rateOracleAddress = optionalAddress(import.meta.env.VITE_RATE_ORACLE_ADDRESS);

const missing: string[] = [];
if (!rpcUrl) missing.push('Monad RPC URL');
if (!chainId) missing.push('Monad chain ID');
if (!deploymentBlock) missing.push('deployment block');
if (!marketConfigAddress) missing.push('MarketConfig address');
if (!orderBookAddress) missing.push('OrderBook address');
if (!rateOracleAddress) missing.push('RateOracle address');

export const protocolReadConfig = {
  deploymentId: optionalText(import.meta.env.VITE_DEPLOYMENT_ID) ?? 'unconfigured',
  deploymentBlock,
  rpcUrl,
  marketConfigAddress,
  orderBookAddress,
  rateOracleAddress,
  missing,
  isConfigured: missing.length === 0,
  chain: rpcUrl && chainId
    ? defineChain({
        id: chainId,
        name: optionalText(import.meta.env.VITE_MONAD_CHAIN_NAME) ?? 'Monad Testnet',
        nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
        rpcUrls: {default: {http: [rpcUrl]}},
        blockExplorers: explorerUrl
          ? {default: {name: 'Explorer', url: explorerUrl}}
          : undefined,
        testnet: true,
      })
    : undefined,
};

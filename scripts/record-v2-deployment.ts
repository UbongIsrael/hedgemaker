import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPublicClient, defineChain, getAddress, http, isAddress, type Address} from 'viem';

const CHAIN_ID = 10_143;
const deploymentId = process.env.HEDGEMAKER_IGNITION_DEPLOYMENT_ID?.trim() || 'hedgemaker-v2-monad-testnet-final';
const moduleId = process.env.HEDGEMAKER_IGNITION_MODULE_ID?.trim() || 'HedgeMakerV2RecoveryFinal';
const rpcUrl = process.env.MONAD_TESTNET_RPC_URL?.trim();
if (!rpcUrl) throw new Error('Missing MONAD_TESTNET_RPC_URL.');
const inputPath = resolve(`./ignition/deployments/${deploymentId}/deployed_addresses.json`);
const outputPath = resolve(process.env.HEDGEMAKER_DEPLOYMENT_MANIFEST?.trim() || './config/deployments/monad-testnet-v2.json');
const raw = JSON.parse(await readFile(inputPath, 'utf8')) as Record<string, string>;
const take = (name: string): Address => {
  const value = raw[`${moduleId}#${name}`];
  if (!value || !isAddress(value)) throw new Error(`Ignition output is missing ${moduleId}#${name}.`);
  return getAddress(value);
};
const contracts = {
  accessManager: take('HedgeMakerAccessManager'),
  settlementToken: take('MockUSDC'),
  vault: take('CollateralVault'),
  marketConfig: take('MarketConfig'),
  rateOracle: take('RateOracleV2'),
  positionManager: take('PositionManager'),
  orderBook: take('OrderBook'),
};
const chain = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
  rpcUrls: {default: {http: [rpcUrl]}},
  testnet: true,
});
const client = createPublicClient({chain, transport: http(rpcUrl)});
if (await client.getChainId() !== CHAIN_ID) throw new Error('RPC returned the wrong chain.');
for (const [name, address] of Object.entries(contracts)) {
  const code = await client.getCode({address});
  if (!code || code === '0x') throw new Error(`${name} has no code at ${address}.`);
}
// This command must run immediately after deployment and before initialization.
// Starting event scans at the current block is safe because orders and positions
// cannot exist until the later initialization step.
const deploymentBlock = await client.getBlockNumber();
const manifest = {
  schemaVersion: '1.0.0',
  deploymentId: 'hedgemaker-monad-testnet-v2',
  chainId: CHAIN_ID,
  deploymentBlock: deploymentBlock.toString(),
  contracts,
};
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, {flag: 'wx'});
console.log(`Recorded verified V2 deployment: ${outputPath}`);

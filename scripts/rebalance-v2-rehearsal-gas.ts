import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  parseEther,
  type Hex,
} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';

const CHAIN_ID = 10_143;
function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator > 0) values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}
function required(values: Record<string, string>, name: string) {
  const value = values[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
function validKey(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
function minimum(left: bigint, right: bigint) {
  return left < right ? left : right;
}

const operatorPath = resolve(process.env.HEDGEMAKER_OPERATOR_ENV_FILE?.trim() || './.env.operator.local');
const operator = parseEnv(await readFile(operatorPath, 'utf8'));
const manifest = JSON.parse(await readFile(resolve(required(operator, 'HEDGEMAKER_V2_MANIFEST')), 'utf8')) as {
  mode: string;
  productionReady: boolean;
  chainId: number;
};
if (manifest.chainId !== CHAIN_ID || manifest.productionReady || manifest.mode !== 'SYNTHETIC_TESTNET_REHEARSAL') {
  throw new Error('Gas rebalance is restricted to the explicit synthetic Monad rehearsal.');
}
const rpcUrl = required(operator, 'MONAD_TESTNET_RPC_URL');
const deployerKey = required(operator, 'MONAD_TESTNET_PRIVATE_KEY');
const resolverKey = required(operator, 'HEDGEMAKER_RESOLVER_PRIVATE_KEY');
if (!validKey(deployerKey) || !validKey(resolverKey)) throw new Error('Operator keys are invalid.');
const deployer = privateKeyToAccount(deployerKey);
const resolver = privateKeyToAccount(resolverKey);
const chain = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
  rpcUrls: {default: {http: [rpcUrl]}},
  testnet: true,
});
const client = createPublicClient({chain, transport: http(rpcUrl, {timeout: 20_000})});
const wallet = createWalletClient({account: resolver, chain, transport: http(rpcUrl, {timeout: 20_000})});
const [deployerBalance, resolverBalance] = await Promise.all([
  client.getBalance({address: deployer.address}),
  client.getBalance({address: resolver.address}),
]);
const target = parseEther(process.env.HEDGEMAKER_SUBMITTER_MON_TARGET?.trim() || '5.0');
const resolverReserve = parseEther(process.env.HEDGEMAKER_RESOLVER_MON_RESERVE?.trim() || '0.2');
if (deployerBalance >= target) {
  console.log(`Submitter already has ${formatEther(deployerBalance)} MON; no transfer required.`);
  process.exit(0);
}
if (resolverBalance <= resolverReserve) throw new Error('Resolver balance is at or below its protected reserve.');
const amount = minimum(target - deployerBalance, resolverBalance - resolverReserve);
if (amount <= 0n) throw new Error('No safe rebalance amount is available.');
const hash = await wallet.sendTransaction({to: deployer.address, value: amount});
const receipt = await client.waitForTransactionReceipt({hash, timeout: 120_000});
if (receipt.status !== 'success') throw new Error(`Gas rebalance reverted: ${hash}`);
const [finalDeployer, finalResolver] = await Promise.all([
  client.getBalance({address: deployer.address}),
  client.getBalance({address: resolver.address}),
]);
console.log(JSON.stringify({
  transaction: hash,
  transferredTestMon: formatEther(amount),
  submitter: {address: deployer.address, balance: formatEther(finalDeployer)},
  resolver: {address: resolver.address, balance: formatEther(finalResolver)},
  environment: manifest.mode,
}, null, 2));

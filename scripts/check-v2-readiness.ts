import {access, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPublicClient, defineChain, formatEther, http, parseEther, type Hex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';

function parseEnv(text: string) {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator > 0) result[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return result;
}
function validKey(value: string | undefined): value is Hex {
  return Boolean(value && /^0x[0-9a-fA-F]{64}$/.test(value));
}
async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const operatorPath = resolve(process.env.HEDGEMAKER_OPERATOR_ENV_FILE?.trim() || './.env.operator.local');
const frontendPath = resolve(process.env.HEDGEMAKER_FRONTEND_ENV_FILE?.trim() || './.env');
const operator = parseEnv(await readFile(operatorPath, 'utf8'));
const frontend = parseEnv(await readFile(frontendPath, 'utf8'));
if (!validKey(operator.MONAD_TESTNET_PRIVATE_KEY)) throw new Error('Operator deployer key is missing or invalid.');
if (!validKey(operator.HEDGEMAKER_RESOLVER_PRIVATE_KEY)) throw new Error('Resolver key is missing or invalid.');
const signerKeys = operator.HEDGEMAKER_ORACLE_SIGNER_KEYS?.split(',').map((value) => value.trim()) ?? [];
if (signerKeys.length !== 5 || signerKeys.some((value) => !validKey(value))) throw new Error('Exactly five valid signer keys are required.');
const rpcUrl = operator.MONAD_TESTNET_RPC_URL?.trim();
if (!rpcUrl) throw new Error('Operator Monad RPC URL is missing.');
const deployer = privateKeyToAccount(operator.MONAD_TESTNET_PRIVATE_KEY);
const resolver = privateKeyToAccount(operator.HEDGEMAKER_RESOLVER_PRIVATE_KEY);
const chain = defineChain({
  id: 10_143,
  name: 'Monad Testnet',
  nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
  rpcUrls: {default: {http: [rpcUrl]}},
  testnet: true,
});
const client = createPublicClient({chain, transport: http(rpcUrl, {timeout: 15_000})});
if (await client.getChainId() !== 10_143) throw new Error('Operator RPC is not Monad testnet chain 10143.');
const [deployerBalance, resolverBalance] = await Promise.all([
  client.getBalance({address: deployer.address}),
  client.getBalance({address: resolver.address}),
]);
const deploymentPath = resolve(operator.HEDGEMAKER_DEPLOYMENT_MANIFEST || './config/deployments/monad-testnet-v2.json');
const marketPath = resolve(operator.HEDGEMAKER_V2_MANIFEST || './config/testnet-rehearsal.v2.json');
const privyReady = Boolean(frontend.VITE_PRIVY_APP_ID && frontend.VITE_MONAD_RPC_URL && frontend.VITE_MONAD_CHAIN_ID === '10143');
const deploymentRecorded = await exists(deploymentPath);
const marketMaterialized = await exists(marketPath);
const minimumDeployerBalance = deploymentRecorded ? parseEther('0.1') : parseEther('1.5');

console.log(`Privy/Monad frontend configuration: ${privyReady ? 'ready' : 'incomplete'}`);
console.log(`Deployer ${deployer.address}: ${formatEther(deployerBalance)} MON`);
console.log(`Resolver ${resolver.address}: ${formatEther(resolverBalance)} MON`);
console.log('Offline oracle signer set: 5 valid keys');
console.log(`V2 deployment manifest: ${deploymentRecorded ? 'recorded' : 'not deployed yet'}`);
console.log(`Immutable market/calendar manifest: ${marketMaterialized ? 'materialized' : 'generate after deployment funding'}`);
if (!privyReady || deployerBalance < minimumDeployerBalance || resolverBalance === 0n) {
  console.error(`Readiness: blocked — deployer needs at least ${formatEther(minimumDeployerBalance)} MON at this stage, resolver must be funded, and frontend configuration must be complete.`);
  process.exitCode = 1;
} else {
  console.log(`Readiness: operator identities and funding are ready for V2 ${deploymentRecorded ? 'operation' : 'deployment'}.`);
}

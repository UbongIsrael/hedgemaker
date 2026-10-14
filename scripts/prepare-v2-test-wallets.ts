import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseEther,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts';

const CHAIN_ID = 10_143;
const TRADER_COUNT = 5;
const tokenAbi = parseAbi([
  'function owner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function faucetMinted(address) view returns (uint256)',
  'function FAUCET_CAP_PER_ADDRESS() view returns (uint256)',
  'function claimFaucet(uint256)',
  'function mint(address,uint256)',
]);

interface Deployment {
  chainId: number;
  contracts: {settlementToken: string};
}

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

function validKey(value: string | undefined): value is Hex {
  return Boolean(value && /^0x[0-9a-fA-F]{64}$/.test(value));
}

function upsertLine(text: string, name: string, value: string) {
  const line = `${name}=${value}`;
  const expression = new RegExp(`^${name}=.*$`, 'm');
  if (expression.test(text)) return text.replace(expression, line);
  return `${text.trimEnd()}\n${line}\n`;
}

function min(left: bigint, right: bigint) {
  return left < right ? left : right;
}

async function requireSuccess(client: ReturnType<typeof createPublicClient>, hash: Hex, label: string) {
  const receipt = await client.waitForTransactionReceipt({hash, timeout: 120_000});
  if (receipt.status !== 'success') throw new Error(`${label} reverted: ${hash}`);
  return receipt;
}

const operatorPath = resolve(process.env.HEDGEMAKER_OPERATOR_ENV_FILE?.trim() || './.env.operator.local');
let operatorText = await readFile(operatorPath, 'utf8');
let operator = parseEnv(operatorText);
if (!validKey(operator.MONAD_TESTNET_PRIVATE_KEY)) throw new Error('Operator deployer key is missing or invalid.');
const rpcUrl = operator.MONAD_TESTNET_RPC_URL?.trim();
if (!rpcUrl) throw new Error('Operator Monad RPC URL is missing.');

let traderKeys = operator.HEDGEMAKER_TEST_TRADER_PRIVATE_KEYS
  ?.split(',')
  .map((value) => value.trim())
  .filter(Boolean) ?? [];
if (traderKeys.length === 0) {
  traderKeys = Array.from({length: TRADER_COUNT}, () => generatePrivateKey());
  operatorText = upsertLine(operatorText, 'HEDGEMAKER_TEST_TRADER_PRIVATE_KEYS', traderKeys.join(','));
  await writeFile(operatorPath, operatorText, {mode: 0o600});
  operator = parseEnv(operatorText);
  console.log(`Created ${TRADER_COUNT} dedicated test-only trader identities in the ignored operator file.`);
}
if (traderKeys.length !== TRADER_COUNT || traderKeys.some((value) => !validKey(value))) {
  throw new Error(`HEDGEMAKER_TEST_TRADER_PRIVATE_KEYS must contain exactly ${TRADER_COUNT} valid private keys.`);
}

const deploymentPath = resolve(operator.HEDGEMAKER_DEPLOYMENT_MANIFEST || './config/deployments/monad-testnet-v2.json');
const deployment = JSON.parse(await readFile(deploymentPath, 'utf8')) as Deployment;
if (deployment.chainId !== CHAIN_ID || !isAddress(deployment.contracts.settlementToken)) {
  throw new Error('Deployment manifest is not a valid Monad testnet deployment.');
}

const chain = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
  rpcUrls: {default: {http: [rpcUrl]}},
  testnet: true,
});
const publicClient = createPublicClient({chain, transport: http(rpcUrl, {timeout: 20_000})});
if (await publicClient.getChainId() !== CHAIN_ID) throw new Error('RPC is not Monad testnet.');
const deployerAccount = privateKeyToAccount(operator.MONAD_TESTNET_PRIVATE_KEY as Hex);
const deployerClient = createWalletClient({account: deployerAccount, chain, transport: http(rpcUrl, {timeout: 20_000})});
const traderAccounts = traderKeys.map((key) => privateKeyToAccount(key as Hex));
const token = getAddress(deployment.contracts.settlementToken);
const tokenOwner = await publicClient.readContract({address: token, abi: tokenAbi, functionName: 'owner'});
if (tokenOwner.toLowerCase() !== deployerAccount.address.toLowerCase()) {
  throw new Error('Configured deployer is not the mUSDC test-token owner.');
}

const monTarget = parseEther(process.env.HEDGEMAKER_TEST_WALLET_MON_TARGET?.trim() || '0.1');
const musdcTarget = parseUnits(process.env.HEDGEMAKER_TEST_WALLET_MUSDC_TARGET?.trim() || '5000', 6);
const recipients: Array<{label: string; address: Address}> = traderAccounts.map((account, index) => ({
  label: index === 0 ? 'buyer' : `seller-${index}`,
  address: account.address,
}));
const privyValue = process.env.HEDGEMAKER_PRIVY_TEST_WALLET?.trim();
if (privyValue) {
  if (!isAddress(privyValue)) throw new Error('HEDGEMAKER_PRIVY_TEST_WALLET is invalid.');
  recipients.push({label: 'privy-wallet', address: getAddress(privyValue)});
}

for (const recipient of recipients) {
  const current = await publicClient.getBalance({address: recipient.address});
  if (current < monTarget) {
    const amount = monTarget - current;
    const hash = await deployerClient.sendTransaction({to: recipient.address, value: amount});
    await requireSuccess(publicClient, hash, `Fund ${recipient.label}`);
    console.log(`Funded ${recipient.label} ${recipient.address} with ${formatEther(amount)} test MON: ${hash}`);
  }
}

const faucetCap = await publicClient.readContract({address: token, abi: tokenAbi, functionName: 'FAUCET_CAP_PER_ADDRESS'});
for (let index = 0; index < traderAccounts.length; index += 1) {
  const account = traderAccounts[index];
  const [balance, alreadyMinted] = await Promise.all([
    publicClient.readContract({address: token, abi: tokenAbi, functionName: 'balanceOf', args: [account.address]}),
    publicClient.readContract({address: token, abi: tokenAbi, functionName: 'faucetMinted', args: [account.address]}),
  ]);
  if (balance < musdcTarget && alreadyMinted < faucetCap) {
    const amount = min(musdcTarget - balance, faucetCap - alreadyMinted);
    const client = createWalletClient({account, chain, transport: http(rpcUrl, {timeout: 20_000})});
    const hash = await client.writeContract({address: token, abi: tokenAbi, functionName: 'claimFaucet', args: [amount]});
    await requireSuccess(publicClient, hash, `Claim mUSDC for trader ${index + 1}`);
    console.log(`Trader ${index + 1} claimed ${formatUnits(amount, 6)} mUSDC: ${hash}`);
  }
}

if (privyValue) {
  const privyAddress = getAddress(privyValue);
  const balance = await publicClient.readContract({address: token, abi: tokenAbi, functionName: 'balanceOf', args: [privyAddress]});
  if (balance < musdcTarget) {
    const amount = musdcTarget - balance;
    const hash = await deployerClient.writeContract({address: token, abi: tokenAbi, functionName: 'mint', args: [privyAddress, amount]});
    await requireSuccess(publicClient, hash, 'Mint mUSDC for Privy wallet');
    console.log(`Minted ${formatUnits(amount, 6)} mUSDC to Privy wallet ${privyAddress}: ${hash}`);
  }
}

const rows = [];
for (const recipient of recipients) {
  const [mon, musdc] = await Promise.all([
    publicClient.getBalance({address: recipient.address}),
    publicClient.readContract({address: token, abi: tokenAbi, functionName: 'balanceOf', args: [recipient.address]}),
  ]);
  rows.push({role: recipient.label, address: recipient.address, mon: formatEther(mon), mUSDC: formatUnits(musdc, 6)});
}
console.table(rows);
console.log('Test wallets are live-funded; private keys remain only in the ignored mode-0600 operator file.');

import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  parseAbi,
  toFunctionSelector,
  type Address,
  type Hex,
} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';

const CHAIN_ID = 10_143;
const CONFIG_ROLE = 1n;
const PAUSER_ROLE = 2n;
const ORACLE_POLICY_ROLE = 3n;
const TREASURY_ROLE = 4n;
const accessAbi = parseAbi([
  'function hasRole(uint64,address) view returns (bool,uint32)',
  'function getTargetFunctionRole(address,bytes4) view returns (uint64)',
  'function grantRole(uint64,address,uint32)',
  'function labelRole(uint64,string)',
  'function setTargetFunctionRole(address,bytes4[],uint64)',
]);

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Load .env.operator.local first.`);
  return value;
}
const rpcUrl = required('MONAD_TESTNET_RPC_URL');
const privateKey = required('MONAD_TESTNET_PRIVATE_KEY');
const resolverKey = required('HEDGEMAKER_RESOLVER_PRIVATE_KEY');
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey) || !/^0x[0-9a-fA-F]{64}$/.test(resolverKey)) throw new Error('Operator keys are invalid.');
const admin = privateKeyToAccount(privateKey as Hex);
const resolver = privateKeyToAccount(resolverKey as Hex);
const deployment = JSON.parse(await readFile(resolve(required('HEDGEMAKER_DEPLOYMENT_MANIFEST')), 'utf8')) as {
  chainId: number;
  contracts: Record<'accessManager' | 'vault' | 'marketConfig' | 'rateOracle' | 'orderBook', string>;
};
if (deployment.chainId !== CHAIN_ID) throw new Error('Deployment manifest is not Monad testnet.');
const address = (name: keyof typeof deployment.contracts): Address => {
  const value = deployment.contracts[name];
  if (!isAddress(value)) throw new Error(`${name} address is invalid.`);
  return getAddress(value);
};
const accessManager = address('accessManager');
const chain = defineChain({id: CHAIN_ID, name: 'Monad Testnet', nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18}, rpcUrls: {default: {http: [rpcUrl]}}, testnet: true});
const publicClient = createPublicClient({chain, transport: http(rpcUrl)});
const walletClient = createWalletClient({account: admin, chain, transport: http(rpcUrl)});
const [isAdmin] = await publicClient.readContract({address: accessManager, abi: accessAbi, functionName: 'hasRole', args: [0n, admin.address]});
if (!isAdmin) throw new Error(`${admin.address} is not the deployment AccessManager admin.`);

const send = async (functionName: 'grantRole' | 'labelRole' | 'setTargetFunctionRole', args: readonly unknown[]) => {
  const simulation = await publicClient.simulateContract({address: accessManager, abi: accessAbi, functionName, args, account: admin} as never);
  const hash = await walletClient.writeContract(simulation.request as never);
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted: ${hash}`);
  console.log(`${functionName}: ${hash}`);
};
const roles = [
  {id: CONFIG_ROLE, label: 'CONFIG_ROLE', account: admin.address},
  {id: PAUSER_ROLE, label: 'PAUSER_ROLE', account: resolver.address},
  {id: ORACLE_POLICY_ROLE, label: 'ORACLE_POLICY_ROLE', account: admin.address},
  {id: TREASURY_ROLE, label: 'TREASURY_ROLE', account: admin.address},
] as const;
for (const role of roles) {
  const [member, delay] = await publicClient.readContract({address: accessManager, abi: accessAbi, functionName: 'hasRole', args: [role.id, role.account]});
  if (!member || delay !== 0) await send('grantRole', [role.id, role.account, 0]);
  await send('labelRole', [role.id, role.label]);
}

const assignments = [
  {
    target: address('marketConfig'),
    role: CONFIG_ROLE,
    signatures: [
      'createVersion((address,uint8,uint256,uint256,uint256,uint256,uint256,uint256,uint16,uint16,uint16,uint16,uint16,uint16,uint256,uint32,uint32,uint32,uint32,uint32,uint32,uint32,uint32,uint32,uint32,uint16,bytes32,bytes32,bytes32,bytes32,address,address,address,address))',
      'activateVersion(uint64)',
      'retireActiveVersion()',
      'addSeries(uint64,bytes32,(bytes32,uint64,uint64,uint64,uint16,bytes32,bytes32))',
    ],
  },
  {
    target: address('rateOracle'),
    role: ORACLE_POLICY_ROLE,
    signatures: [
      'configureFeed(uint64,(address,bytes32,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint16,uint16,uint128,uint128,uint128),(bytes32,bytes32,uint64)[],address[])',
      'scheduleRound(uint64,uint64,uint64,uint64)',
    ],
  },
  {
    target: address('orderBook'),
    role: PAUSER_ROLE,
    signatures: ['setNewRiskPaused(bool)'],
  },
  {
    target: address('vault'),
    role: TREASURY_ROLE,
    signatures: ['withdrawEarnedFees(address,uint256)'],
  },
] as const;
for (const assignment of assignments) {
  const selectors = assignment.signatures.map((signature) => toFunctionSelector(signature));
  const mismatched: Hex[] = [];
  for (const selector of selectors) {
    const existing = await publicClient.readContract({address: accessManager, abi: accessAbi, functionName: 'getTargetFunctionRole', args: [assignment.target, selector]});
    if (existing !== assignment.role) mismatched.push(selector);
  }
  if (mismatched.length > 0) await send('setTargetFunctionRole', [assignment.target, mismatched, assignment.role]);
}
console.log('AccessManager V2 role membership and restricted selector assignments verified.');

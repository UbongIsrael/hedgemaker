import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPublicClient, createWalletClient, defineChain, getAddress, http, isAddress, keccak256, parseAbi, stringToHex, type Hex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';

const CHAIN_ID = 10_143;
const abi = parseAbi([
  'function latestSampleId(uint64) view returns (uint64)',
  'function sample(uint64,uint64) view returns (((uint64 configVersion,uint64 sampleId,uint64 observedAt,uint64 validUntil,uint128 medianRateRaw,bytes32 observationsHash,bytes32 evidenceRoot) report,bytes32 digest,uint64 challengeEndsAt,uint128 referenceRateRaw,uint8 status) result)',
  'function resolveSample(uint64,uint64,bool,bytes32,uint64)',
  'function nextRoundId(uint64) view returns (uint64)',
  'function activeCandidate(uint64,uint64) view returns (bytes32)',
  'function candidate(bytes32) view returns (((uint64 configVersion,uint64 roundId,bytes32 candidateId,uint64 firstSampleId,uint64 lastSampleId,uint128 rateRaw,bytes32 sampleRoot,uint64 validUntil) report,bytes32 digest,uint64 challengeEndsAt,uint128 referenceRateRaw,uint8 status) result)',
  'function resolveRound(bytes32,bool,bytes32,uint64)',
]);

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
const action = required('HEDGEMAKER_V2_RESOLUTION_ACTION');
if (action !== 'sample' && action !== 'round') throw new Error('HEDGEMAKER_V2_RESOLUTION_ACTION must be sample or round.');
const decision = required('HEDGEMAKER_V2_RESOLUTION_ACCEPT').toLowerCase();
if (decision !== 'true' && decision !== 'false') throw new Error('HEDGEMAKER_V2_RESOLUTION_ACCEPT must be true or false.');
const accept = decision === 'true';
const rationaleHash = keccak256(stringToHex(required('HEDGEMAKER_V2_RESOLUTION_RATIONALE')));
const rpcUrl = required('MONAD_TESTNET_RPC_URL');
const resolverKey = required('HEDGEMAKER_RESOLVER_PRIVATE_KEY');
if (!/^0x[0-9a-fA-F]{64}$/.test(resolverKey)) throw new Error('HEDGEMAKER_RESOLVER_PRIVATE_KEY is invalid.');
const resolver = privateKeyToAccount(resolverKey as Hex);
const deployment = JSON.parse(await readFile(resolve(required('HEDGEMAKER_DEPLOYMENT_MANIFEST')), 'utf8')) as {chainId: number; contracts: {rateOracle: string}};
const manifest = JSON.parse(await readFile(resolve(required('HEDGEMAKER_V2_MANIFEST')), 'utf8')) as {chainId: number; configVersion: string; oracle: {resolver: string}};
if (deployment.chainId !== CHAIN_ID || manifest.chainId !== CHAIN_ID || !isAddress(deployment.contracts.rateOracle)) throw new Error('Invalid Monad V2 manifests.');
if (resolver.address.toLowerCase() !== getAddress(manifest.oracle.resolver).toLowerCase()) throw new Error('Resolver key does not match the immutable manifest.');
const version = BigInt(manifest.configVersion);
const oracle = getAddress(deployment.contracts.rateOracle);
const chain = defineChain({id: CHAIN_ID, name: 'Monad Testnet', nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18}, rpcUrls: {default: {http: [rpcUrl]}}, testnet: true});
const publicClient = createPublicClient({chain, transport: http(rpcUrl)});
const walletClient = createWalletClient({account: resolver, chain, transport: http(rpcUrl)});

let functionName: 'resolveSample' | 'resolveRound';
let args: readonly unknown[];
if (action === 'sample') {
  const sampleId = await publicClient.readContract({address: oracle, abi, functionName: 'latestSampleId', args: [version]});
  if (sampleId === 0n) throw new Error('No sample exists.');
  const sample = await publicClient.readContract({address: oracle, abi, functionName: 'sample', args: [version, sampleId]});
  functionName = 'resolveSample';
  args = [version, sampleId, accept, rationaleHash, sample.report.validUntil];
} else {
  const roundId = await publicClient.readContract({address: oracle, abi, functionName: 'nextRoundId', args: [version]});
  const candidateId = await publicClient.readContract({address: oracle, abi, functionName: 'activeCandidate', args: [version, roundId]});
  if (/^0x0{64}$/i.test(candidateId)) throw new Error('No active next-round candidate exists.');
  const candidate = await publicClient.readContract({address: oracle, abi, functionName: 'candidate', args: [candidateId]});
  functionName = 'resolveRound';
  args = [candidateId, accept, rationaleHash, candidate.report.validUntil];
}
const simulation = await publicClient.simulateContract({address: oracle, abi, functionName, args, account: resolver} as never);
const hash = await walletClient.writeContract(simulation.request as never);
const receipt = await publicClient.waitForTransactionReceipt({hash});
if (receipt.status !== 'success') throw new Error(`${functionName} reverted: ${hash}`);
console.log(`${functionName}: ${hash}`);
console.log(`Decision: ${accept ? 'accept' : 'reject'}; rationaleHash: ${rationaleHash}`);

import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';

const CHAIN_ID = 10_143;
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const accessAbi = parseAbi(['function hasRole(uint64,address) view returns (bool,uint32)']);
const tokenAbi = parseAbi(['function decimals() view returns (uint8)']);
const vaultAbi = parseAbi(['function controller() view returns (address)']);
const positionAbi = parseAbi(['function orderBook() view returns (address)']);
const orderBookAbi = parseAbi(['function newRiskPaused() view returns (bool)']);
const configAbi = parseAbi([
  'function latestVersion() view returns (uint64)',
  'function activeVersion() view returns (uint64)',
  'function getConfig(uint64) view returns ((address settlementToken,uint8 tokenDecimals,uint256 lotNotionalRaw,uint256 tickSizeRaw,uint256 minRateRaw,uint256 maxRateRaw,uint256 minStrikeRaw,uint256 maxStrikeRaw,uint16 strikeBandBps,uint16 initialMarginBps,uint16 maintenanceMarginBps,uint16 referenceTakerFeeBps,uint16 effectiveTakerFeeBps,uint16 circuitBreakerBps,uint256 maxNotionalRaw,uint32 maxLotsPerOrder,uint32 maxOrdersPerSeries,uint32 maxOrdersPerWallet,uint32 maxOrdersPerMarket,uint32 maxMatchBatch,uint32 maxScanBatch,uint32 maxSyncBatch,uint32 maxOrderLifetime,uint32 maxPegLifetimeRounds,uint32 marginGracePeriodSeconds,uint16 maxOffsetBps,bytes32 oraclePolicyHash,bytes32 methodologyHash,bytes32 feePolicyHash,bytes32 sponsorshipPolicyHash,address vault,address orderBook,address positionManager,address rateOracle))',
  'function getSeries(bytes32) view returns ((bytes32 marketId,uint64 fixingAt,uint64 expiryRoundId,uint64 oracleFailureDeadline,uint16 strikeBandBps,bytes32 calendarHash,bytes32 oraclePolicyHash,address settlementToken,uint64 configVersion,bool exists))',
]);
const oracleAbi = parseAbi([
  'function policyHashes(uint64) view returns (bytes32)',
  'function sources(uint64) view returns ((bytes32 sourceId,bytes32 independenceGroupId,uint64 maxAgeSeconds)[])',
  'function signers(uint64) view returns (address[])',
  'function nextScheduleRoundId(uint64) view returns (uint64)',
  'function scheduledRound(uint64,uint64) view returns ((uint64 observationTime,uint64 failureDeadline,bool configured))',
  'function latestSampleId(uint64) view returns (uint64)',
  'function nextRoundId(uint64) view returns (uint64)',
  'function feedStatus(uint64) view returns (uint8)',
]);

interface Deployment {
  chainId: number;
  deploymentBlock: string;
  contracts: Record<string, string>;
}
interface Manifest {
  chainId: number;
  configVersion: string;
  oracle: {resolver: string; sources: Array<{sourceId: Hex; independenceGroupId: Hex}>; signers: string[]};
  calendar: {
    rounds: Array<{roundId: string; observationTime: string; failureDeadline: string}>;
    series: Array<{seriesId: Hex; marketId: Hex; fixingAt: string; expiryRoundId: string; oracleFailureDeadline: string}>;
  };
}
function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
function address(value: string | undefined, label: string): Address {
  if (!value || !isAddress(value)) throw new Error(`${label} is not a valid address.`);
  return getAddress(value);
}
function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const deployment = JSON.parse(
  await readFile(resolve(required('HEDGEMAKER_DEPLOYMENT_MANIFEST')), 'utf8'),
) as Deployment;
const manifest = JSON.parse(
  await readFile(resolve(required('HEDGEMAKER_V2_MANIFEST')), 'utf8'),
) as Manifest;
assert(deployment.chainId === CHAIN_ID && manifest.chainId === CHAIN_ID, 'Manifest chain mismatch.');
const version = BigInt(manifest.configVersion);
const contracts = Object.fromEntries(
  Object.entries(deployment.contracts).map(([name, value]) => [name, address(value, `contracts.${name}`)]),
) as Record<string, Address>;
const rpcUrl = required('MONAD_TESTNET_RPC_URL');
const chain = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
  rpcUrls: {default: {http: [rpcUrl]}},
  testnet: true,
});
const client = createPublicClient({chain, transport: http(rpcUrl, {timeout: 15_000})});
const block = await client.getBlock();
for (const [name, contract] of Object.entries(contracts)) {
  const code = await client.getCode({address: contract, blockNumber: block.number});
  assert(code && code !== '0x', `${name} has no bytecode.`);
}
const [vaultController, boundOrderBook, decimals, latestVersion, activeVersion, paused, policyHash, sources, signers, nextScheduleRoundId, latestSampleId, nextRoundId, feedStatus] = await Promise.all([
  client.readContract({address: contracts.vault, abi: vaultAbi, functionName: 'controller', blockNumber: block.number}),
  client.readContract({address: contracts.positionManager, abi: positionAbi, functionName: 'orderBook', blockNumber: block.number}),
  client.readContract({address: contracts.settlementToken, abi: tokenAbi, functionName: 'decimals', blockNumber: block.number}),
  client.readContract({address: contracts.marketConfig, abi: configAbi, functionName: 'latestVersion', blockNumber: block.number}),
  client.readContract({address: contracts.marketConfig, abi: configAbi, functionName: 'activeVersion', blockNumber: block.number}),
  client.readContract({address: contracts.orderBook, abi: orderBookAbi, functionName: 'newRiskPaused', blockNumber: block.number}),
  client.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'policyHashes', args: [version], blockNumber: block.number}),
  client.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'sources', args: [version], blockNumber: block.number}),
  client.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'signers', args: [version], blockNumber: block.number}),
  client.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'nextScheduleRoundId', args: [version], blockNumber: block.number}),
  client.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'latestSampleId', args: [version], blockNumber: block.number}),
  client.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'nextRoundId', args: [version], blockNumber: block.number}),
  client.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'feedStatus', args: [version], blockNumber: block.number}),
]);
assert(sameAddress(vaultController, contracts.positionManager), 'Vault controller binding mismatch.');
assert(sameAddress(boundOrderBook, contracts.orderBook), 'PositionManager OrderBook binding mismatch.');
assert(decimals === 6, 'Settlement token does not have six decimals.');
assert(latestVersion === version && activeVersion === version, 'Manifest configuration is not the active latest version.');
assert(!paused, 'OrderBook new-risk pause is unexpectedly active.');
assert(policyHash !== ZERO_BYTES32, 'Oracle policy is not configured.');
assert(sources.length === manifest.oracle.sources.length && sources.length >= 3, 'Oracle source count mismatch.');
assert(signers.length === manifest.oracle.signers.length && signers.length === 5, 'Oracle signer count mismatch.');
assert(nextScheduleRoundId === BigInt(manifest.calendar.rounds.length + 1), 'Oracle schedule length mismatch.');
for (const expected of manifest.calendar.rounds) {
  const actual = await client.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'scheduledRound', args: [version, BigInt(expected.roundId)], blockNumber: block.number});
  assert(actual.configured && actual.observationTime === BigInt(expected.observationTime) && actual.failureDeadline === BigInt(expected.failureDeadline), `Round ${expected.roundId} schedule mismatch.`);
}
const config = await client.readContract({address: contracts.marketConfig, abi: configAbi, functionName: 'getConfig', args: [version], blockNumber: block.number});
assert(sameAddress(config.settlementToken, contracts.settlementToken), 'Config settlement token mismatch.');
assert(sameAddress(config.vault, contracts.vault) && sameAddress(config.orderBook, contracts.orderBook) && sameAddress(config.positionManager, contracts.positionManager) && sameAddress(config.rateOracle, contracts.rateOracle), 'Config component address mismatch.');
assert(config.oraclePolicyHash === policyHash, 'Config oracle policy hash mismatch.');
for (const expected of manifest.calendar.series) {
  const actual = await client.readContract({address: contracts.marketConfig, abi: configAbi, functionName: 'getSeries', args: [expected.seriesId], blockNumber: block.number});
  assert(actual.exists && actual.marketId === expected.marketId && actual.fixingAt === BigInt(expected.fixingAt) && actual.expiryRoundId === BigInt(expected.expiryRoundId) && actual.oracleFailureDeadline === BigInt(expected.oracleFailureDeadline), `Series ${expected.seriesId} mismatch.`);
}
const [admin, resolver] = [
  address(process.env.HEDGEMAKER_ADMIN_ADDRESS || '0xB90dAb356768fA59da074E1AbB5555c0B3F925Bb', 'admin'),
  address(manifest.oracle.resolver, 'resolver'),
];
const [[adminMember], [resolverMember]] = await Promise.all([
  client.readContract({address: contracts.accessManager, abi: accessAbi, functionName: 'hasRole', args: [0n, admin], blockNumber: block.number}),
  client.readContract({address: contracts.accessManager, abi: accessAbi, functionName: 'hasRole', args: [2n, resolver], blockNumber: block.number}),
]);
assert(adminMember && resolverMember, 'Required admin/resolver role membership is missing.');

console.log(JSON.stringify({
  chainId: CHAIN_ID,
  blockNumber: block.number.toString(),
  blockTimestamp: block.timestamp.toString(),
  configVersion: version.toString(),
  deploymentBlock: deployment.deploymentBlock,
  contractsVerified: Object.keys(contracts).length,
  sourceCount: sources.length,
  signerQuorum: `3-of-${signers.length}`,
  scheduledRounds: manifest.calendar.rounds.length,
  listedSeries: manifest.calendar.series.length,
  latestSampleId: latestSampleId.toString(),
  nextRoundId: nextRoundId.toString(),
  feedStatus: Number(feedStatus),
  newRiskPaused: paused,
  status: 'verified',
}, null, 2));

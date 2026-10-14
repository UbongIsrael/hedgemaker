import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  isHex,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';

const CHAIN_ID = 10_143;
const oracleAbi = parseAbi([
  'function policyHashes(uint64) view returns (bytes32)',
  'function policies(uint64) view returns (address resolver,bytes32 methodologyHash,uint64 sourceSetVersion,uint64 signerSetVersion,uint64 challengePeriod,uint64 maxSubmissionDelay,uint64 maxFailureDelay,uint64 staleAfter,uint64 maxSourceSkew,uint64 maxSampleGap,uint64 maxHold,uint16 circuitBreakerBps,uint16 maxSourceSpreadBps,uint128 minRateRaw,uint128 maxRateRaw,uint128 bootstrapRateRaw)',
  'function sources(uint64) view returns ((bytes32 sourceId,bytes32 independenceGroupId,uint64 maxAgeSeconds)[])',
  'function signers(uint64) view returns (address[])',
  'function configureFeed(uint64,(address resolver,bytes32 methodologyHash,uint64 sourceSetVersion,uint64 signerSetVersion,uint64 challengePeriod,uint64 maxSubmissionDelay,uint64 maxFailureDelay,uint64 staleAfter,uint64 maxSourceSkew,uint64 maxSampleGap,uint64 maxHold,uint16 circuitBreakerBps,uint16 maxSourceSpreadBps,uint128 minRateRaw,uint128 maxRateRaw,uint128 bootstrapRateRaw),(bytes32 sourceId,bytes32 independenceGroupId,uint64 maxAgeSeconds)[],address[])',
  'function nextScheduleRoundId(uint64) view returns (uint64)',
  'function scheduledRound(uint64,uint64) view returns ((uint64 observationTime,uint64 failureDeadline,bool configured))',
  'function scheduleRound(uint64,uint64,uint64,uint64)',
]);
const configAbi = parseAbi([
  'function latestVersion() view returns (uint64)',
  'function activeVersion() view returns (uint64)',
  'function getConfig(uint64) view returns ((address settlementToken,uint8 tokenDecimals,uint256 lotNotionalRaw,uint256 tickSizeRaw,uint256 minRateRaw,uint256 maxRateRaw,uint256 minStrikeRaw,uint256 maxStrikeRaw,uint16 strikeBandBps,uint16 initialMarginBps,uint16 maintenanceMarginBps,uint16 referenceTakerFeeBps,uint16 effectiveTakerFeeBps,uint16 circuitBreakerBps,uint256 maxNotionalRaw,uint32 maxLotsPerOrder,uint32 maxOrdersPerSeries,uint32 maxOrdersPerWallet,uint32 maxOrdersPerMarket,uint32 maxMatchBatch,uint32 maxScanBatch,uint32 maxSyncBatch,uint32 maxOrderLifetime,uint32 maxPegLifetimeRounds,uint32 marginGracePeriodSeconds,uint16 maxOffsetBps,bytes32 oraclePolicyHash,bytes32 methodologyHash,bytes32 feePolicyHash,bytes32 sponsorshipPolicyHash,address vault,address orderBook,address positionManager,address rateOracle))',
  'function createVersion((address settlementToken,uint8 tokenDecimals,uint256 lotNotionalRaw,uint256 tickSizeRaw,uint256 minRateRaw,uint256 maxRateRaw,uint256 minStrikeRaw,uint256 maxStrikeRaw,uint16 strikeBandBps,uint16 initialMarginBps,uint16 maintenanceMarginBps,uint16 referenceTakerFeeBps,uint16 effectiveTakerFeeBps,uint16 circuitBreakerBps,uint256 maxNotionalRaw,uint32 maxLotsPerOrder,uint32 maxOrdersPerSeries,uint32 maxOrdersPerWallet,uint32 maxOrdersPerMarket,uint32 maxMatchBatch,uint32 maxScanBatch,uint32 maxSyncBatch,uint32 maxOrderLifetime,uint32 maxPegLifetimeRounds,uint32 marginGracePeriodSeconds,uint16 maxOffsetBps,bytes32 oraclePolicyHash,bytes32 methodologyHash,bytes32 feePolicyHash,bytes32 sponsorshipPolicyHash,address vault,address orderBook,address positionManager,address rateOracle)) returns (uint64)',
  'function activateVersion(uint64)',
  'error InvalidSeriesId()',
  'function getSeries(bytes32) view returns ((bytes32 marketId,uint64 fixingAt,uint64 expiryRoundId,uint64 oracleFailureDeadline,uint16 strikeBandBps,bytes32 calendarHash,bytes32 oraclePolicyHash,address settlementToken,uint64 configVersion,bool exists))',
  'function addSeries(uint64,bytes32,(bytes32 marketId,uint64 fixingAt,uint64 expiryRoundId,uint64 oracleFailureDeadline,uint16 strikeBandBps,bytes32 calendarHash,bytes32 oraclePolicyHash))',
]);

interface Deployment {
  chainId: number;
  contracts: Record<'accessManager' | 'settlementToken' | 'vault' | 'marketConfig' | 'rateOracle' | 'positionManager' | 'orderBook', string>;
}
interface Manifest {
  mode: string;
  productionReady: boolean;
  chainId: number;
  configVersion: string;
  economics: Record<string, string | number>;
  oracle: Record<string, unknown> & {
    resolver: string;
    signerThreshold: number;
    signerCount: number;
    twapWindowSeconds: number;
    sources: Array<Record<string, string | number>>;
    signers: string[];
  };
  calendar: {
    rounds: Array<Record<string, string>>;
    series: Array<Record<string, string | number>>;
  };
}
interface ExistingSeries {
  marketId: Hex;
  fixingAt: bigint;
  expiryRoundId: bigint;
  oracleFailureDeadline: bigint;
  strikeBandBps: number;
  calendarHash: Hex;
  oraclePolicyHash: Hex;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
function uint(value: unknown, label: string) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) {
    throw new Error(`${label} must be an unsigned integer.`);
  }
  return BigInt(value);
}
function number(value: unknown, label: string, max: number) {
  const parsed = uint(value, label);
  if (parsed > BigInt(max)) throw new Error(`${label} is too large.`);
  return Number(parsed);
}
function bytes32(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !isHex(value) || value.length !== 66 || /^0x0{64}$/i.test(value)) {
    throw new Error(`${label} must be a non-zero bytes32.`);
  }
  return value;
}
function address(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !isAddress(value)) throw new Error(`${label} must be an address.`);
  return getAddress(value);
}
function same(left: unknown, right: unknown) {
  return String(left).toLowerCase() === String(right).toLowerCase();
}

const rpcUrl = required('MONAD_TESTNET_RPC_URL');
const privateKey = required('MONAD_TESTNET_PRIVATE_KEY');
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('MONAD_TESTNET_PRIVATE_KEY is invalid.');
const deployment = JSON.parse(await readFile(resolve(required('HEDGEMAKER_DEPLOYMENT_MANIFEST')), 'utf8')) as Deployment;
const manifest = JSON.parse(await readFile(resolve(required('HEDGEMAKER_V2_MANIFEST')), 'utf8')) as Manifest;
if (manifest.productionReady || manifest.mode !== 'SYNTHETIC_TESTNET_REHEARSAL') {
  throw new Error('This initializer is limited to the explicitly synthetic rehearsal profile.');
}
if (manifest.oracle.signerThreshold !== 3 || manifest.oracle.signerCount !== 5 || manifest.oracle.twapWindowSeconds !== 3_600) {
  throw new Error('Manifest quorum/window differs from the immutable 3-of-5, 60-minute V2 contract policy.');
}
if (deployment.chainId !== CHAIN_ID || manifest.chainId !== CHAIN_ID) throw new Error('Manifest chain IDs must be Monad testnet 10143.');
const contracts = Object.fromEntries(Object.entries(deployment.contracts).map(([name, value]) => [name, address(value, `contracts.${name}`)])) as Record<keyof Deployment['contracts'], Address>;
const account = privateKeyToAccount(privateKey as Hex);
const chain = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
  rpcUrls: {default: {http: [rpcUrl]}},
  testnet: true,
});
const publicClient = createPublicClient({chain, transport: http(rpcUrl)});
const walletClient = createWalletClient({account, chain, transport: http(rpcUrl)});
if (await publicClient.getChainId() !== CHAIN_ID) throw new Error('RPC returned the wrong chain.');
for (const [name, contract] of Object.entries(contracts)) {
  const code = await publicClient.getCode({address: contract});
  if (!code || code === '0x') throw new Error(`${name} has no deployed code at ${contract}.`);
}

const version = uint(manifest.configVersion, 'configVersion');
const economics = manifest.economics;
const oracle = manifest.oracle;
const policy = {
  resolver: address(oracle.resolver, 'oracle.resolver'),
  methodologyHash: bytes32(economics.methodologyHash, 'economics.methodologyHash'),
  sourceSetVersion: uint(oracle.sourceSetVersion, 'oracle.sourceSetVersion'),
  signerSetVersion: uint(oracle.signerSetVersion, 'oracle.signerSetVersion'),
  challengePeriod: uint(oracle.challengePeriod, 'oracle.challengePeriod'),
  maxSubmissionDelay: uint(oracle.maxSubmissionDelay, 'oracle.maxSubmissionDelay'),
  maxFailureDelay: uint(oracle.maxFailureDelay, 'oracle.maxFailureDelay'),
  staleAfter: uint(oracle.staleAfter, 'oracle.staleAfter'),
  maxSourceSkew: uint(oracle.maxSourceSkew, 'oracle.maxSourceSkew'),
  maxSampleGap: uint(oracle.maxSampleGap, 'oracle.maxSampleGap'),
  maxHold: uint(oracle.maxHold, 'oracle.maxHold'),
  circuitBreakerBps: number(economics.circuitBreakerBps, 'economics.circuitBreakerBps', 10_000),
  maxSourceSpreadBps: number(oracle.maxSourceSpreadBps, 'oracle.maxSourceSpreadBps', 10_000),
  minRateRaw: uint(economics.minRateRaw, 'economics.minRateRaw'),
  maxRateRaw: uint(economics.maxRateRaw, 'economics.maxRateRaw'),
  bootstrapRateRaw: uint(oracle.bootstrapRateRaw, 'oracle.bootstrapRateRaw'),
};
const sources = oracle.sources.map((source, index) => ({
  sourceId: bytes32(source.sourceId, `oracle.sources[${index}].sourceId`),
  independenceGroupId: bytes32(source.independenceGroupId, `oracle.sources[${index}].independenceGroupId`),
  maxAgeSeconds: uint(source.maxAgeSeconds, `oracle.sources[${index}].maxAgeSeconds`),
}));
const signers = oracle.signers.map((signer, index) => address(signer, `oracle.signers[${index}]`));
if (signers.length !== 5) throw new Error('Exactly five sorted signer addresses are required.');
for (let index = 1; index < signers.length; index += 1) {
  if (signers[index].toLowerCase() <= signers[index - 1].toLowerCase()) throw new Error('Signer addresses must be strictly sorted.');
}
const rounds = manifest.calendar.rounds.map((round, index) => ({
  roundId: uint(round.roundId, `rounds[${index}].roundId`),
  observationTime: uint(round.observationTime, `rounds[${index}].observationTime`),
  failureDeadline: uint(round.failureDeadline, `rounds[${index}].failureDeadline`),
}));
const series = manifest.calendar.series.map((item, index) => ({
  seriesId: bytes32(item.seriesId, `series[${index}].seriesId`),
  marketId: bytes32(item.marketId, `series[${index}].marketId`),
  fixingAt: uint(item.fixingAt, `series[${index}].fixingAt`),
  expiryRoundId: uint(item.expiryRoundId, `series[${index}].expiryRoundId`),
  oracleFailureDeadline: uint(item.oracleFailureDeadline, `series[${index}].oracleFailureDeadline`),
  strikeBandBps: number(item.strikeBandBps, `series[${index}].strikeBandBps`, 10_000),
  calendarHash: bytes32(item.calendarHash, `series[${index}].calendarHash`),
}));

const send = async (request: Record<string, unknown>) => {
  const simulation = await publicClient.simulateContract({...request, account} as never);
  const hash = await walletClient.writeContract(simulation.request as never);
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  if (receipt.status !== 'success') throw new Error(`${String(request.functionName)} reverted: ${hash}`);
  console.log(`${String(request.functionName)}: ${hash}`);
};

const existingPolicyHash = await publicClient.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'policyHashes', args: [version]});
if (/^0x0{64}$/i.test(existingPolicyHash)) {
  await send({address: contracts.rateOracle, abi: oracleAbi, functionName: 'configureFeed', args: [version, policy, sources, signers]});
} else {
  const [existingPolicy, existingSources, existingSigners] = await Promise.all([
    publicClient.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'policies', args: [version]}),
    publicClient.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'sources', args: [version]}),
    publicClient.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'signers', args: [version]}),
  ]);
  const policyKeys = Object.keys(policy) as Array<keyof typeof policy>;
  const policyValues = Object.values(policy);
  for (let index = 0; index < policyKeys.length; index += 1) {
    if (!same(existingPolicy[index], policyValues[index])) throw new Error(`Existing V2 policy differs at ${policyKeys[index]}.`);
  }
  if (JSON.stringify(existingSources, (_, value) => typeof value === 'bigint' ? value.toString() : value).toLowerCase()
      !== JSON.stringify(sources, (_, value) => typeof value === 'bigint' ? value.toString() : value).toLowerCase()) {
    throw new Error('Existing V2 source set differs from the manifest.');
  }
  if (existingSigners.map((value) => value.toLowerCase()).join(',') !== signers.map((value) => value.toLowerCase()).join(',')) {
    throw new Error('Existing V2 signer set differs from the manifest.');
  }
}

let nextSchedule = await publicClient.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'nextScheduleRoundId', args: [version]});
for (const round of rounds) {
  if (round.roundId < nextSchedule) {
    const existing = await publicClient.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'scheduledRound', args: [version, round.roundId]});
    if (!existing.configured || existing.observationTime !== round.observationTime || existing.failureDeadline !== round.failureDeadline) {
      throw new Error(`Existing scheduled round ${round.roundId} differs from the manifest.`);
    }
  } else {
    if (round.roundId !== nextSchedule) throw new Error(`Manifest skips required round ${nextSchedule}.`);
    await send({address: contracts.rateOracle, abi: oracleAbi, functionName: 'scheduleRound', args: [version, round.roundId, round.observationTime, round.failureDeadline]});
    nextSchedule += 1n;
  }
}

const oraclePolicyHash = await publicClient.readContract({address: contracts.rateOracle, abi: oracleAbi, functionName: 'policyHashes', args: [version]});
const config = {
  settlementToken: contracts.settlementToken,
  tokenDecimals: 6,
  lotNotionalRaw: uint(economics.lotNotionalRaw, 'economics.lotNotionalRaw'),
  tickSizeRaw: uint(economics.tickSizeRaw, 'economics.tickSizeRaw'),
  minRateRaw: uint(economics.minRateRaw, 'economics.minRateRaw'),
  maxRateRaw: uint(economics.maxRateRaw, 'economics.maxRateRaw'),
  minStrikeRaw: uint(economics.minStrikeRaw, 'economics.minStrikeRaw'),
  maxStrikeRaw: uint(economics.maxStrikeRaw, 'economics.maxStrikeRaw'),
  strikeBandBps: number(economics.strikeBandBps, 'economics.strikeBandBps', 10_000),
  initialMarginBps: number(economics.initialMarginBps, 'economics.initialMarginBps', 10_000),
  maintenanceMarginBps: number(economics.maintenanceMarginBps, 'economics.maintenanceMarginBps', 10_000),
  referenceTakerFeeBps: number(economics.referenceTakerFeeBps, 'economics.referenceTakerFeeBps', 10_000),
  effectiveTakerFeeBps: number(economics.effectiveTakerFeeBps, 'economics.effectiveTakerFeeBps', 10_000),
  circuitBreakerBps: number(economics.circuitBreakerBps, 'economics.circuitBreakerBps', 10_000),
  maxNotionalRaw: uint(economics.maxNotionalRaw, 'economics.maxNotionalRaw'),
  maxLotsPerOrder: number(economics.maxLotsPerOrder, 'economics.maxLotsPerOrder', 0xffff_ffff),
  maxOrdersPerSeries: number(economics.maxOrdersPerSeries, 'economics.maxOrdersPerSeries', 0xffff_ffff),
  maxOrdersPerWallet: number(economics.maxOrdersPerWallet, 'economics.maxOrdersPerWallet', 0xffff_ffff),
  maxOrdersPerMarket: number(economics.maxOrdersPerMarket, 'economics.maxOrdersPerMarket', 0xffff_ffff),
  maxMatchBatch: number(economics.maxMatchBatch, 'economics.maxMatchBatch', 0xffff_ffff),
  maxScanBatch: number(economics.maxScanBatch, 'economics.maxScanBatch', 0xffff_ffff),
  maxSyncBatch: number(economics.maxSyncBatch, 'economics.maxSyncBatch', 0xffff_ffff),
  maxOrderLifetime: number(economics.maxOrderLifetime, 'economics.maxOrderLifetime', 0xffff_ffff),
  maxPegLifetimeRounds: number(economics.maxPegLifetimeRounds, 'economics.maxPegLifetimeRounds', 0xffff_ffff),
  marginGracePeriodSeconds: number(economics.marginGracePeriodSeconds, 'economics.marginGracePeriodSeconds', 0xffff_ffff),
  maxOffsetBps: number(economics.maxOffsetBps, 'economics.maxOffsetBps', 10_000),
  oraclePolicyHash,
  methodologyHash: bytes32(economics.methodologyHash, 'economics.methodologyHash'),
  feePolicyHash: bytes32(economics.feePolicyHash, 'economics.feePolicyHash'),
  sponsorshipPolicyHash: bytes32(economics.sponsorshipPolicyHash, 'economics.sponsorshipPolicyHash'),
  vault: contracts.vault,
  orderBook: contracts.orderBook,
  positionManager: contracts.positionManager,
  rateOracle: contracts.rateOracle,
};
const latestVersion = await publicClient.readContract({address: contracts.marketConfig, abi: configAbi, functionName: 'latestVersion'});
if (latestVersion < version) {
  if (latestVersion + 1n !== version) throw new Error(`Manifest version ${version} skips MarketConfig version ${latestVersion + 1n}.`);
  await send({address: contracts.marketConfig, abi: configAbi, functionName: 'createVersion', args: [config]});
} else if (latestVersion > version) {
  throw new Error(`MarketConfig latest version ${latestVersion} is not manifest version ${version}.`);
} else {
  const existing = await publicClient.readContract({address: contracts.marketConfig, abi: configAbi, functionName: 'getConfig', args: [version]});
  for (const key of Object.keys(config) as Array<keyof typeof config>) {
    if (!same(existing[key], config[key])) throw new Error(`Existing market config differs at ${key}.`);
  }
}
const activeVersion = await publicClient.readContract({address: contracts.marketConfig, abi: configAbi, functionName: 'activeVersion'});
if (activeVersion !== version) await send({address: contracts.marketConfig, abi: configAbi, functionName: 'activateVersion', args: [version]});

for (const item of series) {
  const input = {
    marketId: item.marketId,
    fixingAt: item.fixingAt,
    expiryRoundId: item.expiryRoundId,
    oracleFailureDeadline: item.oracleFailureDeadline,
    strikeBandBps: item.strikeBandBps,
    calendarHash: item.calendarHash,
    oraclePolicyHash,
  };
  let existing: ExistingSeries | undefined;
  try {
    existing = await publicClient.readContract({address: contracts.marketConfig, abi: configAbi, functionName: 'getSeries', args: [item.seriesId]}) as ExistingSeries;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('InvalidSeriesId') && !message.includes('0xb44d147d')) throw error;
  }
  if (existing === undefined) await send({address: contracts.marketConfig, abi: configAbi, functionName: 'addSeries', args: [version, item.seriesId, input]});
  else {
    for (const key of Object.keys(input) as Array<keyof typeof input>) {
      if (!same(existing[key], input[key])) throw new Error(`Existing series ${item.seriesId} differs at ${key}.`);
    }
  }
}

console.log('V2 synthetic rehearsal initialized and ready for its 60-minute sample warmup.');

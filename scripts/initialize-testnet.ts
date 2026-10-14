import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  decodeErrorResult,
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
const ADDRESSES = {
  settlementToken: getAddress('0x1104E65eDDC14Db1661667Ee3C3E9BA8717D6395'),
  vault: getAddress('0xC42674265F553889B845641cee0F0E2E65Af5d0b'),
  marketConfig: getAddress('0xd272BD0f3F3951B8926ed10a15747837047861ed'),
  rateOracle: getAddress('0x01124Fa39104a6c56550c2328503D5FD51a96c9b'),
  positionManager: getAddress('0x3F8ae4Ec8C1A98b79286065338ABe16D81aB2a1d'),
  orderBook: getAddress('0xdAF7ABc4594868676f4106e788BA88074Cb8CA21'),
} as const;

const marketConfigAbi = parseAbi([
  'error InvalidSeriesId()',
  'function latestVersion() view returns (uint64)',
  'function activeVersion() view returns (uint64)',
  'function getConfig(uint64 version) view returns ((address settlementToken,uint8 tokenDecimals,uint256 lotNotionalRaw,uint256 tickSizeRaw,uint256 minRateRaw,uint256 maxRateRaw,uint256 minStrikeRaw,uint256 maxStrikeRaw,uint16 strikeBandBps,uint16 initialMarginBps,uint16 maintenanceMarginBps,uint16 referenceTakerFeeBps,uint16 effectiveTakerFeeBps,uint16 circuitBreakerBps,uint256 maxNotionalRaw,uint32 maxLotsPerOrder,uint32 maxOrdersPerSeries,uint32 maxOrdersPerWallet,uint32 maxOrdersPerMarket,uint32 maxMatchBatch,uint32 maxScanBatch,uint32 maxSyncBatch,uint32 maxOrderLifetime,uint32 maxPegLifetimeRounds,uint32 marginGracePeriodSeconds,uint16 maxOffsetBps,bytes32 oraclePolicyHash,bytes32 methodologyHash,bytes32 feePolicyHash,bytes32 sponsorshipPolicyHash,address vault,address orderBook,address positionManager,address rateOracle) config)',
  'function createVersion((address settlementToken,uint8 tokenDecimals,uint256 lotNotionalRaw,uint256 tickSizeRaw,uint256 minRateRaw,uint256 maxRateRaw,uint256 minStrikeRaw,uint256 maxStrikeRaw,uint16 strikeBandBps,uint16 initialMarginBps,uint16 maintenanceMarginBps,uint16 referenceTakerFeeBps,uint16 effectiveTakerFeeBps,uint16 circuitBreakerBps,uint256 maxNotionalRaw,uint32 maxLotsPerOrder,uint32 maxOrdersPerSeries,uint32 maxOrdersPerWallet,uint32 maxOrdersPerMarket,uint32 maxMatchBatch,uint32 maxScanBatch,uint32 maxSyncBatch,uint32 maxOrderLifetime,uint32 maxPegLifetimeRounds,uint32 marginGracePeriodSeconds,uint16 maxOffsetBps,bytes32 oraclePolicyHash,bytes32 methodologyHash,bytes32 feePolicyHash,bytes32 sponsorshipPolicyHash,address vault,address orderBook,address positionManager,address rateOracle) config) returns (uint64 version)',
  'function activateVersion(uint64 version)',
  'function getSeries(bytes32 seriesId) view returns ((bytes32 marketId,uint64 fixingAt,uint64 expiryRoundId,uint64 oracleFailureDeadline,uint16 strikeBandBps,bytes32 calendarHash,bytes32 oraclePolicyHash,address settlementToken,uint64 configVersion,bool exists) series)',
  'function addSeries(uint64 version,bytes32 seriesId,(bytes32 marketId,uint64 fixingAt,uint64 expiryRoundId,uint64 oracleFailureDeadline,uint16 strikeBandBps,bytes32 calendarHash,bytes32 oraclePolicyHash) series)',
]);

const rateOracleAbi = parseAbi([
  'function nextScheduleRoundId(uint64 version) view returns (uint64)',
  'function feedPolicies(uint64 version) view returns (address signer,address resolver,bytes32 methodologyHash,uint64 challengePeriod,uint64 maxPublicationDelay,uint64 maxFailureDelay,uint64 staleAfter,uint16 circuitBreakerBps,uint128 minRateRaw,uint128 maxRateRaw,bool configured)',
  'function scheduledRound(uint64 version,uint64 roundId) view returns ((uint64 observationTime,uint64 failureDeadline,bool configured) round)',
  'function configureFeed(uint64 version,(address signer,address resolver,bytes32 methodologyHash,uint64 challengePeriod,uint64 maxPublicationDelay,uint64 maxFailureDelay,uint64 staleAfter,uint16 circuitBreakerBps,uint128 minRateRaw,uint128 maxRateRaw,bool configured) policy)',
  'function scheduleRound(uint64 version,uint64 roundId,uint64 observationTime,uint64 failureDeadline)',
]);

interface RawManifest {
  config: Record<string, string | number>;
  oraclePolicy: Record<string, string | number | boolean>;
  rounds: Array<Record<string, string | number>>;
  series: Array<Record<string, string | number>>;
}

interface ExistingSeries {
  marketId: unknown;
  fixingAt: unknown;
  expiryRoundId: unknown;
  oracleFailureDeadline: unknown;
  strikeBandBps: unknown;
  calendarHash: unknown;
  oraclePolicyHash: unknown;
  settlementToken: unknown;
  configVersion: unknown;
  exists: boolean;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function unsigned(value: unknown, name: string) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) {
    throw new Error(`${name} must be an unsigned integer string.`);
  }
  return BigInt(value);
}

function boundedNumber(value: unknown, name: string, maximum: number) {
  const parsed = unsigned(value, name);
  if (parsed > BigInt(maximum)) throw new Error(`${name} exceeds ${maximum}.`);
  return Number(parsed);
}

function bytes32(value: unknown, name: string): Hex {
  if (typeof value !== 'string' || !isHex(value) || value.length !== 66 || /^0x0{64}$/i.test(value)) {
    throw new Error(`${name} must be a non-zero bytes32 value.`);
  }
  return value;
}

function address(value: unknown, name: string): Address {
  if (typeof value !== 'string' || !isAddress(value)) throw new Error(`${name} must be an EVM address.`);
  return getAddress(value);
}

async function main() {
  const rpcUrl = required('MONAD_TESTNET_RPC_URL');
  const privateKey = required('MONAD_TESTNET_PRIVATE_KEY');
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('MONAD_TESTNET_PRIVATE_KEY is invalid.');
  const manifestPath = resolve(required('HEDGEMAKER_MARKET_MANIFEST'));
  const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as RawManifest;
  if (!raw.config || !raw.oraclePolicy || !raw.rounds?.length || !raw.series?.length) {
    throw new Error('Manifest must include config, oraclePolicy, at least two rounds, and at least one series.');
  }

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
  if (await publicClient.getChainId() !== CHAIN_ID) throw new Error('RPC is not Monad Testnet chain 10143.');

  const config = {
    settlementToken: ADDRESSES.settlementToken,
    tokenDecimals: 6,
    lotNotionalRaw: unsigned(raw.config.lotNotionalRaw, 'config.lotNotionalRaw'),
    tickSizeRaw: unsigned(raw.config.tickSizeRaw, 'config.tickSizeRaw'),
    minRateRaw: unsigned(raw.config.minRateRaw, 'config.minRateRaw'),
    maxRateRaw: unsigned(raw.config.maxRateRaw, 'config.maxRateRaw'),
    minStrikeRaw: unsigned(raw.config.minStrikeRaw, 'config.minStrikeRaw'),
    maxStrikeRaw: unsigned(raw.config.maxStrikeRaw, 'config.maxStrikeRaw'),
    strikeBandBps: boundedNumber(raw.config.strikeBandBps, 'config.strikeBandBps', 10_000),
    initialMarginBps: boundedNumber(raw.config.initialMarginBps, 'config.initialMarginBps', 10_000),
    maintenanceMarginBps: boundedNumber(raw.config.maintenanceMarginBps, 'config.maintenanceMarginBps', 10_000),
    referenceTakerFeeBps: boundedNumber(raw.config.referenceTakerFeeBps, 'config.referenceTakerFeeBps', 10_000),
    effectiveTakerFeeBps: boundedNumber(raw.config.effectiveTakerFeeBps, 'config.effectiveTakerFeeBps', 10_000),
    circuitBreakerBps: boundedNumber(raw.config.circuitBreakerBps, 'config.circuitBreakerBps', 10_000),
    maxNotionalRaw: unsigned(raw.config.maxNotionalRaw, 'config.maxNotionalRaw'),
    maxLotsPerOrder: boundedNumber(raw.config.maxLotsPerOrder, 'config.maxLotsPerOrder', 0xffff_ffff),
    maxOrdersPerSeries: boundedNumber(raw.config.maxOrdersPerSeries, 'config.maxOrdersPerSeries', 0xffff_ffff),
    maxOrdersPerWallet: boundedNumber(raw.config.maxOrdersPerWallet, 'config.maxOrdersPerWallet', 0xffff_ffff),
    maxOrdersPerMarket: boundedNumber(raw.config.maxOrdersPerMarket, 'config.maxOrdersPerMarket', 0xffff_ffff),
    maxMatchBatch: boundedNumber(raw.config.maxMatchBatch, 'config.maxMatchBatch', 0xffff_ffff),
    maxScanBatch: boundedNumber(raw.config.maxScanBatch, 'config.maxScanBatch', 0xffff_ffff),
    maxSyncBatch: boundedNumber(raw.config.maxSyncBatch, 'config.maxSyncBatch', 0xffff_ffff),
    maxOrderLifetime: boundedNumber(raw.config.maxOrderLifetime, 'config.maxOrderLifetime', 0xffff_ffff),
    maxPegLifetimeRounds: boundedNumber(raw.config.maxPegLifetimeRounds, 'config.maxPegLifetimeRounds', 0xffff_ffff),
    marginGracePeriodSeconds: boundedNumber(raw.config.marginGracePeriodSeconds, 'config.marginGracePeriodSeconds', 0xffff_ffff),
    maxOffsetBps: boundedNumber(raw.config.maxOffsetBps, 'config.maxOffsetBps', 10_000),
    oraclePolicyHash: bytes32(raw.config.oraclePolicyHash, 'config.oraclePolicyHash'),
    methodologyHash: bytes32(raw.config.methodologyHash, 'config.methodologyHash'),
    feePolicyHash: bytes32(raw.config.feePolicyHash, 'config.feePolicyHash'),
    sponsorshipPolicyHash: bytes32(raw.config.sponsorshipPolicyHash, 'config.sponsorshipPolicyHash'),
    vault: ADDRESSES.vault,
    orderBook: ADDRESSES.orderBook,
    positionManager: ADDRESSES.positionManager,
    rateOracle: ADDRESSES.rateOracle,
  } as const;
  const policy = {
    signer: address(raw.oraclePolicy.signer, 'oraclePolicy.signer'),
    resolver: address(raw.oraclePolicy.resolver, 'oraclePolicy.resolver'),
    methodologyHash: bytes32(raw.oraclePolicy.methodologyHash, 'oraclePolicy.methodologyHash'),
    challengePeriod: boundedNumber(raw.oraclePolicy.challengePeriod, 'oraclePolicy.challengePeriod', Number.MAX_SAFE_INTEGER),
    maxPublicationDelay: boundedNumber(raw.oraclePolicy.maxPublicationDelay, 'oraclePolicy.maxPublicationDelay', Number.MAX_SAFE_INTEGER),
    maxFailureDelay: boundedNumber(raw.oraclePolicy.maxFailureDelay, 'oraclePolicy.maxFailureDelay', Number.MAX_SAFE_INTEGER),
    staleAfter: boundedNumber(raw.oraclePolicy.staleAfter, 'oraclePolicy.staleAfter', Number.MAX_SAFE_INTEGER),
    circuitBreakerBps: boundedNumber(raw.oraclePolicy.circuitBreakerBps, 'oraclePolicy.circuitBreakerBps', 10_000),
    minRateRaw: unsigned(raw.oraclePolicy.minRateRaw, 'oraclePolicy.minRateRaw'),
    maxRateRaw: unsigned(raw.oraclePolicy.maxRateRaw, 'oraclePolicy.maxRateRaw'),
    configured: false,
  } as const;
  if (policy.methodologyHash !== config.methodologyHash) throw new Error('Config and oracle methodology hashes differ.');
  if (raw.rounds.length < 2) throw new Error('At least two sequential oracle rounds are required to open trading.');
  const expectedVersion = unsigned(raw.config.expectedVersion, 'config.expectedVersion');
  const rounds = raw.rounds.map((item, index) => {
    const roundId = unsigned(item.roundId, `rounds[${index}].roundId`);
    if (roundId !== BigInt(index + 1)) throw new Error('Rounds must be sequential and start at 1.');
    return {
      roundId,
      observationTime: unsigned(item.observationTime, `rounds[${index}].observationTime`),
      failureDeadline: unsigned(item.failureDeadline, `rounds[${index}].failureDeadline`),
    };
  });
  const seriesInputs = raw.series.map((item, index) => ({
    seriesId: bytes32(item.seriesId, `series[${index}].seriesId`),
    input: {
      marketId: bytes32(item.marketId, `series[${index}].marketId`),
      fixingAt: unsigned(item.fixingAt, `series[${index}].fixingAt`),
      expiryRoundId: unsigned(item.expiryRoundId, `series[${index}].expiryRoundId`),
      oracleFailureDeadline: unsigned(item.oracleFailureDeadline, `series[${index}].oracleFailureDeadline`),
      strikeBandBps: boundedNumber(item.strikeBandBps, `series[${index}].strikeBandBps`, 10_000),
      calendarHash: bytes32(item.calendarHash, `series[${index}].calendarHash`),
      oraclePolicyHash: bytes32(item.oraclePolicyHash, `series[${index}].oraclePolicyHash`),
    },
  }));
  for (const series of seriesInputs) {
    const fixingRound = rounds.find((round) => round.roundId === series.input.expiryRoundId);
    if (!fixingRound) throw new Error(`Series ${series.seriesId} refers to an unscheduled expiry round.`);
    if (
      fixingRound.observationTime !== series.input.fixingAt
        || fixingRound.failureDeadline !== series.input.oracleFailureDeadline
    ) {
      throw new Error(`Series ${series.seriesId} does not exactly match its fixing round.`);
    }
    if (series.input.oraclePolicyHash !== config.oraclePolicyHash) {
      throw new Error(`Series ${series.seriesId} has a different oracle policy hash.`);
    }
  }

  const send = async (request: Record<string, unknown>) => {
    const simulation = await publicClient.simulateContract({...request, account} as never);
    const hash = await walletClient.writeContract(simulation.request as never);
    const receipt = await publicClient.waitForTransactionReceipt({hash});
    if (receipt.status !== 'success') throw new Error(`Transaction ${hash} reverted.`);
    console.log(`${String(request.functionName)}: ${hash}`);
  };

  // Complete every immutable-state check before the first transaction. This also
  // makes a partially completed fresh initialization resumable without accepting
  // a different manifest halfway through.
  const latestVersion = await publicClient.readContract({address: ADDRESSES.marketConfig, abi: marketConfigAbi, functionName: 'latestVersion'});
  const fresh = latestVersion === 0n;
  if (!fresh && latestVersion !== expectedVersion) {
    throw new Error(`Latest version is ${latestVersion}; manifest expects ${expectedVersion}. Refusing to modify another version.`);
  }
  if (fresh) {
    if (expectedVersion !== 1n) throw new Error('A fresh deployment can only create expected version 1.');
  }
  const version = expectedVersion;
  if (!fresh) {
    const existingConfig = await publicClient.readContract({address: ADDRESSES.marketConfig, abi: marketConfigAbi, functionName: 'getConfig', args: [version]});
    for (const key of Object.keys(config) as Array<keyof typeof config>) {
      if (String(existingConfig[key]).toLowerCase() !== String(config[key]).toLowerCase()) {
        throw new Error(`Existing immutable config differs at ${key}.`);
      }
    }
  }

  const existingPolicy = await publicClient.readContract({address: ADDRESSES.rateOracle, abi: rateOracleAbi, functionName: 'feedPolicies', args: [version]});
  if (existingPolicy[10] && (
    getAddress(existingPolicy[0]) !== policy.signer
      || getAddress(existingPolicy[1]) !== policy.resolver
      || existingPolicy[2] !== policy.methodologyHash
      || existingPolicy[3] !== BigInt(policy.challengePeriod)
      || existingPolicy[4] !== BigInt(policy.maxPublicationDelay)
      || existingPolicy[5] !== BigInt(policy.maxFailureDelay)
      || existingPolicy[6] !== BigInt(policy.staleAfter)
      || existingPolicy[7] !== policy.circuitBreakerBps
      || existingPolicy[8] !== policy.minRateRaw
      || existingPolicy[9] !== policy.maxRateRaw
  )) {
    throw new Error('An incompatible oracle policy already exists for this version.');
  }

  const roundStates = [];
  for (const {roundId, observationTime, failureDeadline} of rounds) {
    const existing = await publicClient.readContract({address: ADDRESSES.rateOracle, abi: rateOracleAbi, functionName: 'scheduledRound', args: [version, roundId]});
    if (existing.configured && (existing.observationTime !== observationTime || existing.failureDeadline !== failureDeadline)) {
      throw new Error(`Round ${roundId} already exists with different immutable times.`);
    }
    roundStates.push({roundId, observationTime, failureDeadline, configured: existing.configured});
  }
  const nextScheduleRoundId = await publicClient.readContract({address: ADDRESSES.rateOracle, abi: rateOracleAbi, functionName: 'nextScheduleRoundId', args: [version]});
  const expectedNextScheduleRoundId = BigInt(rounds.length + 1);
  if (nextScheduleRoundId > expectedNextScheduleRoundId) {
    throw new Error(`Oracle has scheduled rounds beyond the manifest (next round is ${nextScheduleRoundId}; manifest ends at ${rounds.length}).`);
  }

  const activeVersion = await publicClient.readContract({address: ADDRESSES.marketConfig, abi: marketConfigAbi, functionName: 'activeVersion'});
  if (activeVersion !== 0n && activeVersion !== version) throw new Error(`Version ${activeVersion} is already active.`);

  const seriesStates = [];
  for (const {seriesId, input} of seriesInputs) {
    let existing: ExistingSeries | undefined;
    try {
      existing = await publicClient.readContract({address: ADDRESSES.marketConfig, abi: marketConfigAbi, functionName: 'getSeries', args: [seriesId]});
    } catch (error) {
      const missingSeries = findRevertData(error);
      if (!missingSeries) throw error;
      try {
        if (decodeErrorResult({abi: marketConfigAbi, data: missingSeries}).errorName !== 'InvalidSeriesId') throw error;
      } catch {
        throw error;
      }
    }
    if (existing && existing.exists) {
      const expectedSeries = {
        ...input,
        settlementToken: config.settlementToken,
        configVersion: version,
        exists: true,
      };
      for (const key of Object.keys(expectedSeries) as Array<keyof typeof expectedSeries>) {
        if (String(existing[key]).toLowerCase() !== String(expectedSeries[key]).toLowerCase()) {
          throw new Error(`Existing immutable series ${seriesId} differs at ${key}.`);
        }
      }
    }
    seriesStates.push({seriesId, input, exists: Boolean(existing?.exists)});
  }

  if (fresh) {
    await send({address: ADDRESSES.marketConfig, abi: marketConfigAbi, functionName: 'createVersion', args: [config]});
  }
  if (!existingPolicy[10]) {
    await send({address: ADDRESSES.rateOracle, abi: rateOracleAbi, functionName: 'configureFeed', args: [version, policy]});
  }
  for (const {roundId, observationTime, failureDeadline, configured} of roundStates) {
    if (!configured) {
      await send({address: ADDRESSES.rateOracle, abi: rateOracleAbi, functionName: 'scheduleRound', args: [version, roundId, observationTime, failureDeadline]});
    }
  }
  if (activeVersion === 0n) {
    await send({address: ADDRESSES.marketConfig, abi: marketConfigAbi, functionName: 'activateVersion', args: [version]});
  }
  for (const {seriesId, input, exists} of seriesStates) {
    if (!exists) {
      await send({
        address: ADDRESSES.marketConfig,
        abi: marketConfigAbi,
        functionName: 'addSeries',
        args: [version, seriesId, input],
      });
    }
  }

  console.log(`Initialized version ${version} from ${manifestPath}. No oracle observation was fabricated or submitted.`);
}

function findRevertData(value: unknown, seen = new Set<unknown>()): Hex | undefined {
  if (typeof value !== 'object' || value === null || seen.has(value)) return undefined;
  seen.add(value);
  const record = value as Record<string, unknown>;
  if (typeof record.data === 'string' && /^0x[0-9a-fA-F]{8,}$/.test(record.data)) return record.data as Hex;
  return findRevertData(record.cause, seen);
}

await main();

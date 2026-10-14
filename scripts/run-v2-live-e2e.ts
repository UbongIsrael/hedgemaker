import {readFile, rename, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  formatUnits,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import {privateKeyToAccount, type PrivateKeyAccount} from 'viem/accounts';

const CHAIN_ID = 10_143;
const EXPECTED_TRADERS = 5;
const POSITION_STATUS_MATURED = 3;
const ORDER_STATUS_FILLED = 2;
const SAFE_TRADING_WINDOW_SECONDS = 90n;
const APPROVAL_RAW = 1_000_000_000n;
const MAX_PULL_RAW = 100_000_000n;
const sleep = (milliseconds: number) => new Promise((accept) => setTimeout(accept, milliseconds));

const tokenAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]);
const oracleAbi = parseAbi([
  'function canOpen(uint64) view returns (bool)',
  'function feedStatus(uint64) view returns (uint8)',
  'function latestSampleId(uint64) view returns (uint64)',
  'function latestFinalizedRound(uint64) view returns ((uint64 roundId,uint64 observationTime,uint64 finalizedAt,uint128 rateRaw,bytes32 candidateId,bytes32 sourceHash))',
]);
const configAbi = parseAbi([
  'function getConfig(uint64) view returns ((address settlementToken,uint8 tokenDecimals,uint256 lotNotionalRaw,uint256 tickSizeRaw,uint256 minRateRaw,uint256 maxRateRaw,uint256 minStrikeRaw,uint256 maxStrikeRaw,uint16 strikeBandBps,uint16 initialMarginBps,uint16 maintenanceMarginBps,uint16 referenceTakerFeeBps,uint16 effectiveTakerFeeBps,uint16 circuitBreakerBps,uint256 maxNotionalRaw,uint32 maxLotsPerOrder,uint32 maxOrdersPerSeries,uint32 maxOrdersPerWallet,uint32 maxOrdersPerMarket,uint32 maxMatchBatch,uint32 maxScanBatch,uint32 maxSyncBatch,uint32 maxOrderLifetime,uint32 maxPegLifetimeRounds,uint32 marginGracePeriodSeconds,uint16 maxOffsetBps,bytes32 oraclePolicyHash,bytes32 methodologyHash,bytes32 feePolicyHash,bytes32 sponsorshipPolicyHash,address vault,address orderBook,address positionManager,address rateOracle))',
  'function getSeries(bytes32) view returns ((bytes32 marketId,uint64 fixingAt,uint64 expiryRoundId,uint64 oracleFailureDeadline,uint16 strikeBandBps,bytes32 calendarHash,bytes32 oraclePolicyHash,address settlementToken,uint64 configVersion,bool exists))',
]);
const orderBookAbi = parseAbi([
  'function nextOrderId() view returns (uint256)',
  'function activeOrderIds(bytes32) view returns (uint256[])',
  'function getOrder(uint256) view returns ((address owner,bytes32 intentId,bytes32 marketId,bytes32 seriesId,uint64 configVersion,uint64 sequence,uint64 validUntil,uint64 boundRoundId,uint64 lastExecutableRoundId,uint128 limitStrikeRaw,uint128 reservePerLotRaw,uint128 feeEscrowRemaining,uint128 cumulativeTakerNotional,uint32 lotsTotal,uint32 lotsFilled,int16 offsetBps,uint8 side,uint8 priceType,uint8 timeInForce,uint8 status))',
  'function placeOrder((bytes32 intentId,bytes32 seriesId,uint8 side,uint8 priceType,uint8 timeInForce,uint32 lots,uint32 minimumImmediateFillLots,uint64 validUntil,uint64 submitBy,uint64 boundRoundId,uint64 lastExecutableRoundId,uint128 limitStrikeRaw,uint128 maxTokenPullRaw,int16 offsetBps)) returns (uint256)',
  'event OrderPlaced(uint256 indexed orderId,address indexed owner,bytes32 indexed seriesId,uint8 side,uint8 priceType,uint32 lots,uint128 reservePerLotRaw,uint128 feeEscrow,uint64 sequence)',
  'event OrderFilled(uint256 indexed orderId,uint256 indexed positionId,uint32 fillLots,uint128 executionStrikeRaw,bool maker,uint256 feeCharged)',
]);
const positionAbi = parseAbi([
  'function nextPositionId() view returns (uint256)',
  'function settleRounds(uint256,uint32) returns (uint32)',
  'function getPosition(uint256) view returns ((address buyer,address seller,bytes32 seriesId,uint64 configVersion,uint64 entryRoundId,uint64 lastRoundId,uint64 buyerCallDeadline,uint64 sellerCallDeadline,uint128 strikeRaw,uint256 notionalRaw,int256 lastValue,uint256 unpaidShortfall,uint8 status),(address buyer,address seller,uint128 buyerCollateral,uint128 sellerCollateral,bool active))',
]);
const vaultAbi = parseAbi([
  'function claimable(address) view returns (uint256)',
  'function withdrawClaimable(uint256)',
  'function positionLedger(uint256) view returns ((address buyer,address seller,uint128 buyerCollateral,uint128 sellerCollateral,bool active))',
]);

interface Deployment {
  deploymentId: string;
  chainId: number;
  contracts: Record<'settlementToken' | 'vault' | 'marketConfig' | 'rateOracle' | 'positionManager' | 'orderBook', string>;
}
interface Manifest {
  chainId: number;
  configVersion: string;
  economics: {lotNotionalRaw: string; tickSizeRaw: string; maxSyncBatch: number};
  calendar: {
    sampleStart: string;
    sampleCadenceSeconds: number;
    series: Array<{seriesId: Hex; expiryRoundId: string; fixingAt: string}>;
  };
}
interface Evidence {
  schemaVersion: string;
  runId: string;
  status: 'initialized' | 'approved' | 'trading' | 'traded' | 'settling' | 'settled-and-withdrawn';
  deploymentId: string;
  chainId: number;
  configVersion: string;
  seriesId: Hex;
  expiryRoundId: string;
  participants: Array<{role: string; address: Address}>;
  approvalTransactions: Hex[];
  operations?: Array<{
    label: string;
    hash: Hex;
    status: 'broadcast' | 'confirmed';
    submittedAt: string;
    blockNumber?: string;
  }>;
  trade?: {
    entryRoundId: string;
    strikeRaw: string;
    buyerOrderId: string;
    sellerOrderIds: string[];
    positionIds: string[];
    orderTransactions: Hex[];
    sellerLots: number[];
    totalNotionalRaw: string;
    verifiedAtBlock: string;
  };
  settlement?: {
    finalRoundId: string;
    settlementTransactions: Hex[];
    withdrawalTransactions: Hex[];
    totalClaimsWithdrawnRaw: string;
    finalWalletBalancesRaw: Record<string, string>;
    verifiedAtBlock: string;
  };
  updatedAt: string;
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
function required(values: Record<string, string>, name: string) {
  const value = values[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}
function minimum(left: bigint, right: bigint) {
  return left < right ? left : right;
}
function roundedTick(rate: bigint, tick: bigint) {
  return ((rate + tick / 2n) / tick) * tick;
}

const operatorPath = resolve(process.env.HEDGEMAKER_OPERATOR_ENV_FILE?.trim() || './.env.operator.local');
const operator = parseEnv(await readFile(operatorPath, 'utf8'));
const rpcUrl = required(operator, 'MONAD_TESTNET_RPC_URL');
const traderKeys = required(operator, 'HEDGEMAKER_TEST_TRADER_PRIVATE_KEYS').split(',').map((value) => value.trim());
assert(traderKeys.length === EXPECTED_TRADERS && traderKeys.every(validKey), 'Exactly five dedicated trader keys are required.');
const deployment = JSON.parse(await readFile(resolve(required(operator, 'HEDGEMAKER_DEPLOYMENT_MANIFEST')), 'utf8')) as Deployment;
const manifest = JSON.parse(await readFile(resolve(required(operator, 'HEDGEMAKER_V2_MANIFEST')), 'utf8')) as Manifest;
assert(deployment.chainId === CHAIN_ID && manifest.chainId === CHAIN_ID, 'Manifest chain mismatch.');
const seriesManifest = manifest.calendar.series[0];
assert(seriesManifest, 'The rehearsal manifest has no listed series.');
const configVersion = BigInt(manifest.configVersion);
const expiryRoundId = BigInt(seriesManifest.expiryRoundId);
const seriesId = seriesManifest.seriesId;
const chain = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
  rpcUrls: {default: {http: [rpcUrl]}},
  testnet: true,
});
const publicClient = createPublicClient({chain, transport: http(rpcUrl, {timeout: 20_000})});
const accounts = traderKeys.map((key) => privateKeyToAccount(key as Hex));
const wallets = accounts.map((account) => createWalletClient({account, chain, transport: http(rpcUrl, {timeout: 20_000})}));
const addresses = Object.fromEntries(Object.entries(deployment.contracts).map(([name, value]) => {
  assert(isAddress(value), `${name} address is invalid.`);
  return [name, getAddress(value)];
})) as Record<keyof Deployment['contracts'], Address>;
const roles = ['buyer', 'seller-200', 'seller-100', 'seller-50', 'seller-150'];
const participants = accounts.map((account, index) => ({role: roles[index], address: account.address}));
const evidencePath = resolve(
  process.env.HEDGEMAKER_E2E_EVIDENCE_FILE?.trim()
  || `./config/monad-testnet-v2-config-${configVersion}-live-e2e.json`,
);

const newEvidence: Evidence = {
  schemaVersion: '1.0.0',
  runId: `${deployment.deploymentId}-${Date.now()}`,
  status: 'initialized',
  deploymentId: deployment.deploymentId,
  chainId: CHAIN_ID,
  configVersion: configVersion.toString(),
  seriesId,
  expiryRoundId: expiryRoundId.toString(),
  participants,
  approvalTransactions: [],
  operations: [],
  updatedAt: new Date().toISOString(),
};
let evidence = newEvidence;
try {
  const existing = JSON.parse(await readFile(evidencePath, 'utf8')) as Evidence;
  assert(
    existing.schemaVersion === newEvidence.schemaVersion
    && existing.deploymentId === newEvidence.deploymentId
    && existing.chainId === newEvidence.chainId
    && existing.configVersion === newEvidence.configVersion
    && existing.seriesId.toLowerCase() === newEvidence.seriesId.toLowerCase()
    && existing.expiryRoundId === newEvidence.expiryRoundId
    && existing.participants.every((participant, index) => sameAddress(participant.address, participants[index]?.address ?? '')),
    'Existing E2E evidence does not belong to this deployment, configuration, series, and participant set.',
  );
  if (existing.status === 'trading' || existing.status === 'settling' || existing.status === 'traded') {
    throw new Error(`Existing E2E evidence is already ${existing.status}; reconcile it before resuming money-moving actions.`);
  }
  if (existing.status === 'settled-and-withdrawn') {
    throw new Error('This E2E evidence is already complete; use a new listed series for another run.');
  }
  evidence = {...existing, operations: existing.operations ?? []};
  console.log(`Resuming untouched evidence ${evidence.runId} at status ${evidence.status}.`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
async function saveEvidence() {
  evidence.updatedAt = new Date().toISOString();
  const temporaryPath = `${evidencePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, {flag: 'w', mode: 0o644});
  await rename(temporaryPath, evidencePath);
}
await saveEvidence();

async function receipt(hash: Hex, label: string) {
  evidence.operations ??= [];
  let operation = evidence.operations.find((item) => item.hash.toLowerCase() === hash.toLowerCase());
  if (!operation) {
    operation = {label, hash, status: 'broadcast', submittedAt: new Date().toISOString()};
    evidence.operations.push(operation);
    await saveEvidence();
  }
  while (true) {
    try {
      const result = await publicClient.getTransactionReceipt({hash});
      if (result.status !== 'success') throw new Error(`${label} reverted: ${hash}`);
      operation.status = 'confirmed';
      operation.blockNumber = result.blockNumber.toString();
      await saveEvidence();
      console.log(`${label}: ${hash}`);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('reverted:')) throw error;
      console.warn(`${label} receipt is not available yet; preserving ${hash} and retrying.`);
      await sleep(5_000);
    }
  }
}
async function latestState() {
  const [block, canOpen, feedStatus, latestSampleId, round] = await Promise.all([
    publicClient.getBlock(),
    publicClient.readContract({address: addresses.rateOracle, abi: oracleAbi, functionName: 'canOpen', args: [configVersion]}),
    publicClient.readContract({address: addresses.rateOracle, abi: oracleAbi, functionName: 'feedStatus', args: [configVersion]}),
    publicClient.readContract({address: addresses.rateOracle, abi: oracleAbi, functionName: 'latestSampleId', args: [configVersion]}),
    publicClient.readContract({address: addresses.rateOracle, abi: oracleAbi, functionName: 'latestFinalizedRound', args: [configVersion]}),
  ]);
  return {block, canOpen, feedStatus: Number(feedStatus), latestSampleId, round};
}

assert(await publicClient.getChainId() === CHAIN_ID, 'RPC is not Monad testnet.');
const [config, series] = await Promise.all([
  publicClient.readContract({address: addresses.marketConfig, abi: configAbi, functionName: 'getConfig', args: [configVersion]}),
  publicClient.readContract({address: addresses.marketConfig, abi: configAbi, functionName: 'getSeries', args: [seriesId]}),
]);
assert(series.exists && series.configVersion === configVersion && series.expiryRoundId === expiryRoundId, 'Series does not match the active rehearsal manifest.');
assert(sameAddress(config.settlementToken, addresses.settlementToken) && sameAddress(config.vault, addresses.vault), 'Economic configuration address mismatch.');
assert(config.lotNotionalRaw === BigInt(manifest.economics.lotNotionalRaw), 'Lot notional mismatch.');

const [existingActiveOrders, existingClaims] = await Promise.all([
  publicClient.readContract({address: addresses.orderBook, abi: orderBookAbi, functionName: 'activeOrderIds', args: [seriesId]}),
  Promise.all(accounts.map((account) => publicClient.readContract({
    address: addresses.vault,
    abi: vaultAbi,
    functionName: 'claimable',
    args: [account.address],
  }))),
]);
assert(existingActiveOrders.length === 0, 'The target series already has active orders; use a clean series for deterministic E2E evidence.');
assert(existingClaims.every((claim) => claim === 0n), 'A participant has a pre-existing Vault claim; withdraw it before deterministic E2E accounting.');

for (let index = 0; index < accounts.length; index += 1) {
  const allowance = await publicClient.readContract({
    address: addresses.settlementToken,
    abi: tokenAbi,
    functionName: 'allowance',
    args: [accounts[index].address, addresses.vault],
  });
  if (allowance < MAX_PULL_RAW) {
    const hash = await wallets[index].writeContract({
      address: addresses.settlementToken,
      abi: tokenAbi,
      functionName: 'approve',
      args: [addresses.vault, APPROVAL_RAW],
    });
    await receipt(hash, `Approve vault for ${roles[index]}`);
    evidence.approvalTransactions.push(hash);
    await saveEvidence();
  }
}
evidence.status = 'approved';
await saveEvidence();

console.log(`Waiting for a healthy oracle window before round ${expiryRoundId}...`);
async function waitForTradingWindow(requiredRoundId?: bigint) {
  let state = await latestState();
  while (true) {
    if (state.round.roundId >= expiryRoundId) throw new Error('The first series is already at or beyond expiry; materialize a new series.');
    if (requiredRoundId !== undefined && state.round.roundId !== requiredRoundId) {
      throw new Error(`The entry round changed from ${requiredRoundId} to ${state.round.roundId}; stop instead of mixing entry references.`);
    }
    const nextSampleAt = BigInt(manifest.calendar.sampleStart)
      + state.latestSampleId * BigInt(manifest.calendar.sampleCadenceSeconds);
    const enoughSampleHeadroom = state.block.timestamp + SAFE_TRADING_WINDOW_SECONDS < nextSampleAt;
    const enoughSeriesHeadroom = state.block.timestamp + 300n < series.fixingAt;
    if (state.canOpen && state.round.roundId > 0n && enoughSampleHeadroom && enoughSeriesHeadroom) return state;
    console.log(JSON.stringify({
      phase: 'waiting-for-trading-window',
      blockTimestamp: state.block.timestamp.toString(),
      feedStatus: state.feedStatus,
      latestSampleId: state.latestSampleId.toString(),
      latestRoundId: state.round.roundId.toString(),
      nextSampleAt: nextSampleAt.toString(),
    }));
    await sleep(10_000);
    state = await latestState();
  }
}

const entry = await waitForTradingWindow();

const strikeRaw = roundedTick(entry.round.rateRaw, config.tickSizeRaw);
assert(strikeRaw >= config.minStrikeRaw && strikeRaw <= config.maxStrikeRaw, 'Rounded strike is outside configured bounds.');
const sellerLots = [4, 2, 1, 3];
const orderTransactions: Hex[] = [];

async function place(
  account: PrivateKeyAccount,
  walletIndex: number,
  side: 0 | 1,
  lots: number,
  role: string,
): Promise<{orderId: bigint; positionId?: bigint; blockNumber: bigint}> {
  const live = await waitForTradingWindow(entry.round.roundId);
  assert(live.round.rateRaw === entry.round.rateRaw, 'Entry rate changed while placing the split orders.');
  const validUntil = minimum(series.fixingAt - 1n, live.block.timestamp + 1_200n);
  const submitBy = minimum(validUntil, live.block.timestamp + 300n);
  const intentId = keccak256(toHex(`${evidence.runId}:${role}`));
  const hash = await wallets[walletIndex].writeContract({
    account,
    address: addresses.orderBook,
    abi: orderBookAbi,
    functionName: 'placeOrder',
    args: [{
      intentId,
      seriesId,
      side,
      priceType: 0,
      timeInForce: 0,
      lots,
      minimumImmediateFillLots: 0,
      validUntil,
      submitBy,
      boundRoundId: entry.round.roundId,
      lastExecutableRoundId: 0n,
      limitStrikeRaw: strikeRaw,
      maxTokenPullRaw: MAX_PULL_RAW,
      offsetBps: 0,
    }],
  });
  const mined = await receipt(hash, `Place ${role} order`);
  orderTransactions.push(hash);
  evidence.status = 'trading';
  await saveEvidence();
  const decoded = mined.logs
    .filter((log) => sameAddress(log.address, addresses.orderBook))
    .map((log) => {
      try {
        return decodeEventLog({abi: orderBookAbi, data: log.data, topics: log.topics, strict: false});
      } catch {
        return undefined;
      }
    })
    .filter((event) => event !== undefined);
  const placed = decoded.find((event) => event.eventName === 'OrderPlaced' && sameAddress(String(event.args.owner), account.address));
  assert(placed?.eventName === 'OrderPlaced', `${role} receipt has no matching OrderPlaced event.`);
  assert(typeof placed.args.orderId === 'bigint', `${role} OrderPlaced event has no order ID.`);
  const orderId = placed.args.orderId;
  const fill = decoded.find((event) => event.eventName === 'OrderFilled' && event.args.orderId === orderId);
  let positionId: bigint | undefined;
  if (fill?.eventName === 'OrderFilled') {
    assert(typeof fill.args.positionId === 'bigint', `${role} OrderFilled event has no position ID.`);
    positionId = fill.args.positionId;
  }
  const order = await publicClient.readContract({address: addresses.orderBook, abi: orderBookAbi, functionName: 'getOrder', args: [orderId]});
  assert(sameAddress(order.owner, account.address) && order.intentId === intentId, `${role} order identity mismatch.`);
  return {orderId, positionId, blockNumber: mined.blockNumber};
}

const buyerResult = await place(accounts[0], 0, 0, 10, 'buyer-500');
const sellerOrderIds: bigint[] = [];
const positionIds: bigint[] = [];
let verifiedBlock = buyerResult.blockNumber;
for (let index = 0; index < sellerLots.length; index += 1) {
  const result = await place(accounts[index + 1], index + 1, 1, sellerLots[index], roles[index + 1]);
  sellerOrderIds.push(result.orderId);
  assert(result.positionId !== undefined, `${roles[index + 1]} order did not emit an OrderFilled position.`);
  positionIds.push(result.positionId);
  verifiedBlock = result.blockNumber;
}

const buyerOrder = await publicClient.readContract({address: addresses.orderBook, abi: orderBookAbi, functionName: 'getOrder', args: [buyerResult.orderId]});
assert(Number(buyerOrder.status) === ORDER_STATUS_FILLED && buyerOrder.lotsFilled === 10, 'The $500 buyer order was not fully filled.');
for (let index = 0; index < sellerOrderIds.length; index += 1) {
  const order = await publicClient.readContract({address: addresses.orderBook, abi: orderBookAbi, functionName: 'getOrder', args: [sellerOrderIds[index]]});
  assert(Number(order.status) === ORDER_STATUS_FILLED && order.lotsFilled === sellerLots[index], `${roles[index + 1]} order was not fully filled.`);
  const [position, ledger] = await publicClient.readContract({address: addresses.positionManager, abi: positionAbi, functionName: 'getPosition', args: [positionIds[index]]});
  assert(sameAddress(position.buyer, accounts[0].address), `Position ${positionIds[index]} buyer mismatch.`);
  assert(sameAddress(position.seller, accounts[index + 1].address), `Position ${positionIds[index]} seller mismatch.`);
  assert(position.notionalRaw === config.lotNotionalRaw * BigInt(sellerLots[index]), `Position ${positionIds[index]} notional mismatch.`);
  assert(position.strikeRaw === strikeRaw && position.entryRoundId === entry.round.roundId, `Position ${positionIds[index]} entry mismatch.`);
  assert(ledger.active, `Position ${positionIds[index]} vault ledger is not active.`);
}

evidence.trade = {
  entryRoundId: entry.round.roundId.toString(),
  strikeRaw: strikeRaw.toString(),
  buyerOrderId: buyerResult.orderId.toString(),
  sellerOrderIds: sellerOrderIds.map(String),
  positionIds: positionIds.map(String),
  orderTransactions,
  sellerLots,
  totalNotionalRaw: (config.lotNotionalRaw * 10n).toString(),
  verifiedAtBlock: verifiedBlock.toString(),
};
evidence.status = 'traded';
await saveEvidence();
console.log(`Live split fill verified: $${formatUnits(config.lotNotionalRaw * 10n, 6)} across 4 child positions at raw strike ${strikeRaw}.`);

console.log(`Waiting for finalized expiry round ${expiryRoundId}...`);
let finalState = await latestState();
while (finalState.round.roundId < expiryRoundId) {
  if (finalState.block.timestamp > series.oracleFailureDeadline) {
    throw new Error(`Expiry round ${expiryRoundId} missed its immutable oracle failure deadline.`);
  }
  console.log(JSON.stringify({
    phase: 'waiting-for-expiry-round',
    blockTimestamp: finalState.block.timestamp.toString(),
    latestRoundId: finalState.round.roundId.toString(),
    expiryRoundId: expiryRoundId.toString(),
  }));
  await sleep(20_000);
  finalState = await latestState();
}

const settlementTransactions: Hex[] = [];
evidence.status = 'settling';
await saveEvidence();
for (const positionId of positionIds) {
  const hash = await wallets[0].writeContract({
    address: addresses.positionManager,
    abi: positionAbi,
    functionName: 'settleRounds',
    args: [positionId, config.maxSyncBatch],
  });
  await receipt(hash, `Settle position ${positionId}`);
  settlementTransactions.push(hash);
  const [position, ledger] = await publicClient.readContract({address: addresses.positionManager, abi: positionAbi, functionName: 'getPosition', args: [positionId]});
  assert(Number(position.status) === POSITION_STATUS_MATURED, `Position ${positionId} did not mature.`);
  assert(!ledger.active, `Position ${positionId} vault ledger remains active.`);
}

const withdrawalTransactions: Hex[] = [];
let totalClaimsWithdrawn = 0n;
for (let index = 0; index < accounts.length; index += 1) {
  const claim = await publicClient.readContract({address: addresses.vault, abi: vaultAbi, functionName: 'claimable', args: [accounts[index].address]});
  assert(claim > 0n, `${roles[index]} has no settlement claim.`);
  const hash = await wallets[index].writeContract({
    address: addresses.vault,
    abi: vaultAbi,
    functionName: 'withdrawClaimable',
    args: [claim],
  });
  await receipt(hash, `Withdraw ${roles[index]} claim`);
  withdrawalTransactions.push(hash);
  totalClaimsWithdrawn += claim;
  const remaining = await publicClient.readContract({address: addresses.vault, abi: vaultAbi, functionName: 'claimable', args: [accounts[index].address]});
  assert(remaining === 0n, `${roles[index]} claim was not fully withdrawn.`);
}
assert(totalClaimsWithdrawn === config.lotNotionalRaw * 2n, 'Conserved collateral payout does not equal both sides of 10% margin on $500.');

const finalWalletBalancesRaw: Record<string, string> = {};
for (const participant of participants) {
  const balance = await publicClient.readContract({address: addresses.settlementToken, abi: tokenAbi, functionName: 'balanceOf', args: [participant.address]});
  finalWalletBalancesRaw[participant.address] = balance.toString();
}
const finalBlock = await publicClient.getBlockNumber();
evidence.settlement = {
  finalRoundId: finalState.round.roundId.toString(),
  settlementTransactions,
  withdrawalTransactions,
  totalClaimsWithdrawnRaw: totalClaimsWithdrawn.toString(),
  finalWalletBalancesRaw,
  verifiedAtBlock: finalBlock.toString(),
};
evidence.status = 'settled-and-withdrawn';
await saveEvidence();
console.log(JSON.stringify({
  status: evidence.status,
  evidenceFile: evidencePath,
  entryRoundId: evidence.trade.entryRoundId,
  expiryRoundId: expiryRoundId.toString(),
  positions: positionIds.map(String),
  totalClaimsWithdrawn: `${formatUnits(totalClaimsWithdrawn, 6)} mUSDC`,
  verifiedAtBlock: finalBlock.toString(),
}, null, 2));

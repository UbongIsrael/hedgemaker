import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  stringToHex,
  type Hex,
} from 'viem';
import {privateKeyToAccount, type PrivateKeyAccount} from 'viem/accounts';

const CHAIN_ID = 10_143;
const oracleAbi = parseAbi([
  'error InvalidPolicy()',
  'error InvalidSource()',
  'error InvalidTimestamp()',
  'error InvalidRate()',
  'error InvalidQuorum()',
  'error InvalidState()',
  'error InvalidRound()',
  'error InvalidCoverage()',
  'function deploymentId() view returns (bytes32)',
  'function policyHashes(uint64) view returns (bytes32)',
  'function policies(uint64) view returns (address resolver,bytes32 methodologyHash,uint64 sourceSetVersion,uint64 signerSetVersion,uint64 challengePeriod,uint64 maxSubmissionDelay,uint64 maxFailureDelay,uint64 staleAfter,uint64 maxSourceSkew,uint64 maxSampleGap,uint64 maxHold,uint16 circuitBreakerBps,uint16 maxSourceSpreadBps,uint128 minRateRaw,uint128 maxRateRaw,uint128 bootstrapRateRaw)',
  'function latestSampleId(uint64) view returns (uint64)',
  'function sample(uint64,uint64) view returns (((uint64 configVersion,uint64 sampleId,uint64 observedAt,uint64 validUntil,uint128 medianRateRaw,bytes32 observationsHash,bytes32 evidenceRoot) report,bytes32 digest,uint64 challengeEndsAt,uint128 referenceRateRaw,uint8 status) result)',
  'function hashSample((uint64 configVersion,uint64 sampleId,uint64 observedAt,uint64 validUntil,uint128 medianRateRaw,bytes32 observationsHash,bytes32 evidenceRoot)) view returns (bytes32)',
  'function proposeSample((uint64 configVersion,uint64 sampleId,uint64 observedAt,uint64 validUntil,uint128 medianRateRaw,bytes32 observationsHash,bytes32 evidenceRoot),(bytes32 sourceId,uint64 observedAt,uint64 publishedAt,uint64 fetchedAt,uint128 rateRaw,bytes32 payloadHash)[],bytes[])',
  'function finalizeSample(uint64,uint64)',
  'function nextRoundId(uint64) view returns (uint64)',
  'function scheduledRound(uint64,uint64) view returns ((uint64 observationTime,uint64 failureDeadline,bool configured))',
  'function finalizedRound(uint64,uint64) view returns ((uint64 roundId,uint64 observationTime,uint64 finalizedAt,uint128 rateRaw,bytes32 candidateId,bytes32 sourceHash))',
  'function previewTwap(uint64,uint64,uint64,uint64) view returns (uint128,bytes32)',
  'function hashRound((uint64 configVersion,uint64 roundId,bytes32 candidateId,uint64 firstSampleId,uint64 lastSampleId,uint128 rateRaw,bytes32 sampleRoot,uint64 validUntil)) view returns (bytes32)',
  'function proposeRound((uint64 configVersion,uint64 roundId,bytes32 candidateId,uint64 firstSampleId,uint64 lastSampleId,uint128 rateRaw,bytes32 sampleRoot,uint64 validUntil),bytes[])',
  'function activeCandidate(uint64,uint64) view returns (bytes32)',
  'function finalizeRound(bytes32)',
]);
const observationParameters = [{
  type: 'tuple[]',
  components: [
    {name: 'sourceId', type: 'bytes32'},
    {name: 'observedAt', type: 'uint64'},
    {name: 'publishedAt', type: 'uint64'},
    {name: 'fetchedAt', type: 'uint64'},
    {name: 'rateRaw', type: 'uint128'},
    {name: 'payloadHash', type: 'bytes32'},
  ],
}] as const;

interface Deployment {chainId: number; contracts: {rateOracle: string}}
interface Manifest {
  mode: string;
  productionReady: boolean;
  chainId: number;
  configVersion: string;
  economics: Record<string, string | number>;
  oracle: {
    challengePeriod: number;
    maxSubmissionDelay: number;
    signerThreshold: number;
    signerCount: number;
    twapWindowSeconds: number;
    sources: Array<{sourceId: Hex; label: string}>;
    signers: string[];
  };
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
function uint(value: unknown, label: string) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) throw new Error(`${label} must be unsigned.`);
  return BigInt(value);
}
function operatorSigners(expected: string[]): PrivateKeyAccount[] {
  const values = required('HEDGEMAKER_ORACLE_SIGNER_KEYS').split(',').map((key) => key.trim());
  if (values.length !== 5 || values.some((key) => !/^0x[0-9a-fA-F]{64}$/.test(key))) throw new Error('HEDGEMAKER_ORACLE_SIGNER_KEYS must contain five private keys.');
  const accounts = values.map((key) => privateKeyToAccount(key as Hex)).sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
  if (accounts.map((account) => account.address.toLowerCase()).join(',') !== expected.map((value) => getAddress(value).toLowerCase()).join(',')) {
    throw new Error('Oracle signer keys do not match the sorted signer set in the immutable manifest.');
  }
  return accounts;
}

const action = required('HEDGEMAKER_V2_ORACLE_ACTION');
const rpcUrl = required('MONAD_TESTNET_RPC_URL');
const submitterKey = required('MONAD_TESTNET_PRIVATE_KEY');
if (!/^0x[0-9a-fA-F]{64}$/.test(submitterKey)) throw new Error('MONAD_TESTNET_PRIVATE_KEY is invalid.');
const deployment = JSON.parse(await readFile(resolve(required('HEDGEMAKER_DEPLOYMENT_MANIFEST')), 'utf8')) as Deployment;
const manifest = JSON.parse(await readFile(resolve(required('HEDGEMAKER_V2_MANIFEST')), 'utf8')) as Manifest;
if (deployment.chainId !== CHAIN_ID || manifest.chainId !== CHAIN_ID || manifest.productionReady || manifest.mode !== 'SYNTHETIC_TESTNET_REHEARSAL') {
  throw new Error('This operator only accepts the explicit Monad synthetic rehearsal profile.');
}
if (!isAddress(deployment.contracts.rateOracle)) throw new Error('Deployment RateOracle address is invalid.');
const oracleAddress = getAddress(deployment.contracts.rateOracle);
const version = uint(manifest.configVersion, 'configVersion');
const submitter = privateKeyToAccount(submitterKey as Hex);
const signers = operatorSigners(manifest.oracle.signers);
if (manifest.oracle.signerThreshold !== 3 || manifest.oracle.signerCount !== 5 || manifest.oracle.twapWindowSeconds !== 3_600) {
  throw new Error('Manifest quorum/window differs from the immutable 3-of-5, 60-minute V2 contract policy.');
}
const chain = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
  rpcUrls: {default: {http: [rpcUrl]}},
  testnet: true,
});
const publicClient = createPublicClient({chain, transport: http(rpcUrl)});
const walletClient = createWalletClient({account: submitter, chain, transport: http(rpcUrl)});
const oracleCode = await publicClient.getCode({address: oracleAddress});
if (!oracleCode || oracleCode === '0x') throw new Error('V2 oracle has no code.');
const [deploymentId, policyHash] = await Promise.all([
  publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'deploymentId'}),
  publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'policyHashes', args: [version]}),
]);
if (/^0x0{64}$/i.test(policyHash)) throw new Error('V2 oracle policy is not initialized.');

const send = async (functionName: 'proposeSample' | 'finalizeSample' | 'proposeRound' | 'finalizeRound', args: readonly unknown[]) => {
  const simulation = await publicClient.simulateContract({address: oracleAddress, abi: oracleAbi, functionName, args, account: submitter} as never);
  const hash = await walletClient.writeContract(simulation.request as never);
  const receipt = await publicClient.waitForTransactionReceipt({hash, timeout: 120_000});
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted: ${hash}`);
  console.log(`${functionName}: ${hash}`);
};

const sampleSignatures = async (report: {
  configVersion: bigint; sampleId: bigint; observedAt: bigint; validUntil: bigint;
  medianRateRaw: bigint; observationsHash: Hex; evidenceRoot: Hex;
}) => Promise.all(signers.slice(0, manifest.oracle.signerThreshold).map((account) => account.signTypedData({
  domain: {name: 'HedgeMaker Rate Oracle', version: '2', chainId: CHAIN_ID, verifyingContract: oracleAddress},
  types: {Sample: [
    {name: 'deploymentId', type: 'bytes32'}, {name: 'configVersion', type: 'uint64'},
    {name: 'policyHash', type: 'bytes32'}, {name: 'sampleId', type: 'uint64'},
    {name: 'observedAt', type: 'uint64'}, {name: 'validUntil', type: 'uint64'},
    {name: 'medianRateRaw', type: 'uint128'}, {name: 'observationsHash', type: 'bytes32'},
    {name: 'evidenceRoot', type: 'bytes32'},
  ]},
  primaryType: 'Sample',
  message: {deploymentId, policyHash, ...report},
})));

if (action === 'sample:propose') {
  const block = await publicClient.getBlock();
  const observedAt = block.timestamp;
  const center = uint(required('HEDGEMAKER_REHEARSAL_RATE_RAW'), 'HEDGEMAKER_REHEARSAL_RATE_RAW');
  const spread = center / 10_000n;
  const rates = [center - spread, center, center + spread];
  const observations = manifest.oracle.sources.map((source, index) => ({
    sourceId: source.sourceId,
    observedAt,
    publishedAt: observedAt,
    fetchedAt: observedAt,
    rateRaw: rates[index],
    payloadHash: keccak256(stringToHex(`${source.label}:${observedAt}:${rates[index]}`)),
  }));
  const sampleId = await publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'latestSampleId', args: [version]}) + 1n;
  const report = {
    configVersion: version,
    sampleId,
    observedAt,
    validUntil: observedAt + BigInt(manifest.oracle.maxSubmissionDelay),
    medianRateRaw: center,
    observationsHash: keccak256(encodeAbiParameters(observationParameters, [observations])),
    evidenceRoot: keccak256(stringToHex(`SYNTHETIC_TESTNET_REHEARSAL:${version}:${sampleId}:${observedAt}`)),
  };
  await send('proposeSample', [report, observations, await sampleSignatures(report)]);
} else if (action === 'sample:finalize') {
  const sampleId = await publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'latestSampleId', args: [version]});
  if (sampleId === 0n) throw new Error('No sample exists to finalize.');
  await send('finalizeSample', [version, sampleId]);
} else if (action === 'round:propose') {
  const roundId = await publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'nextRoundId', args: [version]});
  const schedule = await publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'scheduledRound', args: [version, roundId]});
  const latestSampleId = await publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'latestSampleId', args: [version]});
  if (!schedule.configured || latestSampleId === 0n || schedule.observationTime > (await publicClient.getBlock()).timestamp) throw new Error('The next round is not ready.');
  const windowStart = schedule.observationTime - BigInt(manifest.oracle.twapWindowSeconds);
  let firstSampleId = 0n;
  let lastSampleId = 0n;
  for (let sampleId = 1n; sampleId <= latestSampleId; sampleId += 1n) {
    const sample = await publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'sample', args: [version, sampleId]}) as {
      report: {observedAt: bigint};
    };
    if (sample.report.observedAt <= windowStart) firstSampleId = sampleId;
    if (sample.report.observedAt <= schedule.observationTime) lastSampleId = sampleId;
  }
  if (firstSampleId === 0n || lastSampleId < firstSampleId) throw new Error('The round does not yet have a canonical 60-minute sample range.');
  const [rateRaw, sampleRoot] = await publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'previewTwap', args: [version, roundId, firstSampleId, lastSampleId]});
  const block = await publicClient.getBlock();
  const requestedValidUntil = block.timestamp + BigInt(manifest.oracle.maxSubmissionDelay);
  const validUntil = requestedValidUntil < schedule.failureDeadline
    ? requestedValidUntil
    : schedule.failureDeadline - 1n;
  const minimumFinalizationHeadroom = BigInt(manifest.oracle.challengePeriod) + 15n;
  if (validUntil <= block.timestamp + minimumFinalizationHeadroom) {
    throw new Error(`Round ${roundId} submission window is irrecoverable before failure deadline ${schedule.failureDeadline}.`);
  }
  const candidateId = keccak256(stringToHex(`HEDGEMAKER_V2_ROUND:${deploymentId}:${version}:${roundId}:${sampleRoot}`));
  const report = {configVersion: version, roundId, candidateId, firstSampleId, lastSampleId, rateRaw, sampleRoot, validUntil};
  const signatures = await Promise.all(signers.slice(0, manifest.oracle.signerThreshold).map((account) => account.signTypedData({
    domain: {name: 'HedgeMaker Rate Oracle', version: '2', chainId: CHAIN_ID, verifyingContract: oracleAddress},
    types: {Round: [
      {name: 'deploymentId', type: 'bytes32'}, {name: 'configVersion', type: 'uint64'},
      {name: 'policyHash', type: 'bytes32'}, {name: 'roundId', type: 'uint64'},
      {name: 'candidateId', type: 'bytes32'}, {name: 'observationTime', type: 'uint64'},
      {name: 'failureDeadline', type: 'uint64'}, {name: 'firstSampleId', type: 'uint64'},
      {name: 'lastSampleId', type: 'uint64'}, {name: 'rateRaw', type: 'uint128'},
      {name: 'sampleRoot', type: 'bytes32'}, {name: 'validUntil', type: 'uint64'},
    ]},
    primaryType: 'Round',
    message: {deploymentId, policyHash, observationTime: schedule.observationTime, failureDeadline: schedule.failureDeadline, ...report},
  })));
  await send('proposeRound', [report, signatures]);
  console.log(`Candidate: ${candidateId}`);
} else if (action === 'round:finalize') {
  const roundId = await publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'nextRoundId', args: [version]});
  const candidateId = await publicClient.readContract({address: oracleAddress, abi: oracleAbi, functionName: 'activeCandidate', args: [version, roundId]});
  if (/^0x0{64}$/i.test(candidateId)) throw new Error('No active candidate exists for the next round.');
  await send('finalizeRound', [candidateId]);
} else {
  throw new Error('HEDGEMAKER_V2_ORACLE_ACTION must be sample:propose, sample:finalize, round:propose, or round:finalize.');
}

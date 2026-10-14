import {spawn} from 'node:child_process';
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
const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as Hex;
const STATUS = {
  none: 0,
  proposed: 1,
  quarantined: 2,
  disputed: 3,
  rejected: 4,
  finalized: 5,
} as const;
const oracleAbi = parseAbi([
  'function latestSampleId(uint64) view returns (uint64)',
  'function sample(uint64,uint64) view returns (((uint64 configVersion,uint64 sampleId,uint64 observedAt,uint64 validUntil,uint128 medianRateRaw,bytes32 observationsHash,bytes32 evidenceRoot) report,bytes32 digest,uint64 challengeEndsAt,uint128 referenceRateRaw,uint8 status) result)',
  'function nextRoundId(uint64) view returns (uint64)',
  'function scheduledRound(uint64,uint64) view returns ((uint64 observationTime,uint64 failureDeadline,bool configured))',
  'function activeCandidate(uint64,uint64) view returns (bytes32)',
  'function candidate(bytes32) view returns (((uint64 configVersion,uint64 roundId,bytes32 candidateId,uint64 firstSampleId,uint64 lastSampleId,uint128 rateRaw,bytes32 sampleRoot,uint64 validUntil) report,bytes32 digest,uint64 challengeEndsAt,uint128 referenceRateRaw,uint8 status) result)',
]);

interface Deployment {
  chainId: number;
  contracts: {rateOracle: string};
}
interface Manifest {
  mode: string;
  productionReady: boolean;
  chainId: number;
  configVersion: string;
  oracle: {
    maxSampleGap: number;
    challengePeriod: number;
  };
  calendar: {
    sampleStart: string;
    sampleCadenceSeconds: number;
    rounds: Array<{roundId: string}>;
  };
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
function uint(value: string | number, label: string) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${label} must be unsigned.`);
  return BigInt(value);
}
const sleep = (milliseconds: number) => new Promise((accept) => setTimeout(accept, milliseconds));

const rpcUrl = required('MONAD_TESTNET_RPC_URL');
const rateRaw = required('HEDGEMAKER_REHEARSAL_RATE_RAW');
if (!/^\d+$/.test(rateRaw)) throw new Error('HEDGEMAKER_REHEARSAL_RATE_RAW must be an unsigned raw 1e6 rate.');
const deployment = JSON.parse(
  await readFile(resolve(required('HEDGEMAKER_DEPLOYMENT_MANIFEST')), 'utf8'),
) as Deployment;
const manifest = JSON.parse(
  await readFile(resolve(required('HEDGEMAKER_V2_MANIFEST')), 'utf8'),
) as Manifest;
if (
  deployment.chainId !== CHAIN_ID
  || manifest.chainId !== CHAIN_ID
  || manifest.productionReady
  || manifest.mode !== 'SYNTHETIC_TESTNET_REHEARSAL'
) {
  throw new Error('The keeper only accepts the explicit Monad synthetic rehearsal profile.');
}
if (!isAddress(deployment.contracts.rateOracle)) throw new Error('Deployment oracle address is invalid.');
const oracleAddress = getAddress(deployment.contracts.rateOracle) as Address;
const version = uint(manifest.configVersion, 'configVersion');
const sampleStart = uint(manifest.calendar.sampleStart, 'calendar.sampleStart');
const sampleCadence = uint(manifest.calendar.sampleCadenceSeconds, 'calendar.sampleCadenceSeconds');
const maxSampleGap = uint(manifest.oracle.maxSampleGap, 'oracle.maxSampleGap');
const finalRoundId = uint(manifest.calendar.rounds.at(-1)?.roundId ?? '0', 'final round ID');
const chain = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18},
  rpcUrls: {default: {http: [rpcUrl]}},
  testnet: true,
});
const client = createPublicClient({chain, transport: http(rpcUrl, {timeout: 15_000})});
const oracleCode = await client.getCode({address: oracleAddress});
if (!oracleCode || oracleCode === '0x') throw new Error('Oracle has no deployed bytecode.');

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

async function action(value: 'sample:propose' | 'sample:finalize' | 'round:propose' | 'round:finalize') {
  await new Promise<void>((accept, reject) => {
    const child = spawn(process.execPath, [
      'node_modules/hardhat/dist/src/cli.js',
      '--build-profile', 'deployment',
      '--network', 'monadTestnet',
      'run', '--no-compile',
      'scripts/operate-oracle-v2.ts',
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HEDGEMAKER_V2_ORACLE_ACTION: value,
        HEDGEMAKER_REHEARSAL_RATE_RAW: rateRaw,
      },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) accept();
      else reject(new Error(`${value} exited with ${code ?? signal ?? 'unknown status'}.`));
    });
  });
}

console.log(`Keeper started for oracle ${oracleAddress}, config ${version}, rate ${rateRaw}.`);
console.log(`Sample calendar starts ${new Date(Number(sampleStart) * 1_000).toISOString()}.`);

while (!stopping) {
  try {
    const block = await client.getBlock();
    const now = block.timestamp;
    const nextRoundId = await client.readContract({
      address: oracleAddress,
      abi: oracleAbi,
      functionName: 'nextRoundId',
      args: [version],
    });
    if (nextRoundId > finalRoundId) {
      console.log(`All ${finalRoundId} scheduled rounds are finalized; keeper complete.`);
      break;
    }

    const activeCandidate = await client.readContract({
      address: oracleAddress,
      abi: oracleAbi,
      functionName: 'activeCandidate',
      args: [version, nextRoundId],
    });
    if (activeCandidate !== ZERO_BYTES32) {
      const round = await client.readContract({
        address: oracleAddress,
        abi: oracleAbi,
        functionName: 'candidate',
        args: [activeCandidate],
      });
      const status = Number(round.status);
      if (status === STATUS.quarantined || status === STATUS.disputed) {
        throw new Error(`Round ${nextRoundId} requires resolver action; status ${status}.`);
      }
      if (status === STATUS.rejected) throw new Error(`Round ${nextRoundId} was rejected; operator review is required.`);
      if (status === STATUS.proposed && now > round.report.validUntil) {
        throw new Error(`Round ${nextRoundId} expired before finalization; rotate to a new configuration calendar.`);
      }
      if (status === STATUS.proposed && now >= round.challengeEndsAt) {
        await action('round:finalize');
        continue;
      }
    }

    const latestSampleId = await client.readContract({
      address: oracleAddress,
      abi: oracleAbi,
      functionName: 'latestSampleId',
      args: [version],
    });
    let latestObservedAt = 0n;
    let latestStatus: number = STATUS.finalized;
    if (latestSampleId > 0n) {
      const latest = await client.readContract({
        address: oracleAddress,
        abi: oracleAbi,
        functionName: 'sample',
        args: [version, latestSampleId],
      });
      latestObservedAt = latest.report.observedAt;
      latestStatus = Number(latest.status);
      if (latestStatus === STATUS.quarantined || latestStatus === STATUS.disputed) {
        throw new Error(`Sample ${latestSampleId} requires resolver action; status ${latestStatus}.`);
      }
      if (latestStatus === STATUS.rejected) throw new Error(`Sample ${latestSampleId} was rejected; the rehearsal calendar is no longer continuous.`);
      if (latestStatus === STATUS.proposed && now > latest.report.validUntil) {
        throw new Error(`Sample ${latestSampleId} expired before finalization; rotate to a new configuration calendar.`);
      }
      if (latestStatus === STATUS.proposed && now >= latest.challengeEndsAt) {
        await action('sample:finalize');
        continue;
      }
    }

    const nextSampleAt = sampleStart + latestSampleId * sampleCadence;
    if (latestStatus === STATUS.finalized && now >= nextSampleAt) {
      if (
        (latestSampleId === 0n && now > sampleStart + maxSampleGap)
        || (latestSampleId > 0n && now > latestObservedAt + maxSampleGap)
      ) {
        throw new Error('The immutable sample calendar has missed its maximum gap; generate a new uninitialized calendar instead of backdating.');
      }
      await action('sample:propose');
      continue;
    }

    const schedule = await client.readContract({
      address: oracleAddress,
      abi: oracleAbi,
      functionName: 'scheduledRound',
      args: [version, nextRoundId],
    });
    if (
      activeCandidate === ZERO_BYTES32
      && schedule.configured
      && now >= schedule.observationTime
      && latestStatus === STATUS.finalized
    ) {
      await action('round:propose');
      continue;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/requires resolver action|missed its maximum gap|was rejected|no longer continuous|expired before finalization|submission window is irrecoverable/.test(message)) throw error;
    console.error(`Keeper retryable error: ${message}`);
  }
  await sleep(5_000);
}

console.log(stopping ? 'Keeper stopped cleanly.' : 'Keeper exited cleanly.');

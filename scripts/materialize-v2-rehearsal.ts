import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getAddress, isAddress, keccak256, stringToHex, type Address, type Hex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';

interface Template {
  schemaVersion: string;
  mode: string;
  productionReady: boolean;
  warning: string;
  chainId: number;
  deploymentManifest: string;
  configVersion: string;
  instrument: Record<string, string | number>;
  economics: Record<string, string | number>;
  oracle: {
    resolver: string;
    signers: string[];
    sources: Array<Record<string, string | number>>;
    [key: string]: unknown;
  };
  calendar: {
    id: string;
    hash: Hex;
    twapWarmupSeconds: number;
    anchorLeadSeconds: number;
    sampleCadenceSeconds: number;
    roundCadenceSeconds: number;
    roundCount: number;
    seriesMaturitiesInRounds: number[];
  };
  secretEnvironment: Record<string, string>;
}

function env(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function signerAddresses(): Address[] {
  const explicit = env('HEDGEMAKER_ORACLE_SIGNER_ADDRESSES')?.split(',').map((value) => value.trim());
  const keys = env('HEDGEMAKER_ORACLE_SIGNER_KEYS')?.split(',').map((value) => value.trim());
  const values = explicit ?? keys?.map((key) => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('Every oracle signer key must be a 32-byte 0x-prefixed private key.');
    return privateKeyToAccount(key as Hex).address;
  });
  if (!values || values.length !== 5 || values.some((value) => !isAddress(value))) {
    throw new Error('Supply exactly five addresses in HEDGEMAKER_ORACLE_SIGNER_ADDRESSES or five keys in HEDGEMAKER_ORACLE_SIGNER_KEYS.');
  }
  // Do not pass getAddress directly to Array.map: map's numeric index would
  // become viem's optional chainId and produce EIP-1191 checksums.
  const sorted = values.map((value) => getAddress(value)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  if (new Set(sorted.map((address) => address.toLowerCase())).size !== 5) throw new Error('Oracle signers must be unique.');
  return sorted;
}

function resolverAddress(): Address {
  const explicit = env('HEDGEMAKER_RESOLVER_ADDRESS');
  if (explicit && isAddress(explicit)) return getAddress(explicit);
  const key = env('HEDGEMAKER_RESOLVER_PRIVATE_KEY');
  if (key && /^0x[0-9a-fA-F]{64}$/.test(key)) return privateKeyToAccount(key as Hex).address;
  throw new Error('Supply HEDGEMAKER_RESOLVER_ADDRESS or HEDGEMAKER_RESOLVER_PRIVATE_KEY.');
}

const templatePath = resolve(env('HEDGEMAKER_V2_TEMPLATE') ?? './config/testnet-rehearsal.v2.example.json');
const outputPath = resolve(env('HEDGEMAKER_V2_MANIFEST') ?? './config/testnet-rehearsal.v2.json');
const template = JSON.parse(await readFile(templatePath, 'utf8')) as Template;
const configVersion = env('HEDGEMAKER_V2_CONFIG_VERSION') ?? template.configVersion;
if (!/^\d+$/.test(configVersion) || BigInt(configVersion) === 0n) {
  throw new Error('HEDGEMAKER_V2_CONFIG_VERSION must be a positive integer.');
}
if (template.productionReady || template.mode !== 'SYNTHETIC_TESTNET_REHEARSAL') {
  throw new Error('This generator only materializes the explicitly synthetic testnet profile.');
}
if (
  template.instrument.rateConvention !== 'NGN_PER_USD'
  || template.instrument.rateDecimals !== 6
  || template.oracle.signerThreshold !== 3
  || template.oracle.signerCount !== 5
  || template.oracle.twapWindowSeconds !== 3_600
) {
  throw new Error('The rehearsal must use NGN_PER_USD at 1e6, 3-of-5 signatures, and a full 60-minute TWAP.');
}
const minimumSourceAge = Number(template.oracle.maxHold) + Number(template.oracle.maxSourceSkew);
if (
  !Number.isSafeInteger(minimumSourceAge)
  || template.oracle.sources.some((source) => Number(source.maxAgeSeconds) < minimumSourceAge)
) {
  throw new Error(`Every source maxAgeSeconds must be at least maxHold + maxSourceSkew (${minimumSourceAge}s).`);
}

const cadence = BigInt(template.calendar.sampleCadenceSeconds);
const now = BigInt(Math.floor(Date.now() / 1_000));
// Freeze a future anchor once. Retrying later must reuse the written manifest,
// never silently recalculate live contract timestamps.
const sampleStart = ((now + 300n + cadence - 1n) / cadence) * cadence;
// Collect at least one finalized sample before the first TWAP window begins.
// This gives the on-chain integrator a canonical left-edge anchor even when
// the public testnet includes a few seconds of transaction latency.
const firstRoundAt = sampleStart
  + BigInt(template.calendar.anchorLeadSeconds)
  + BigInt(template.calendar.twapWarmupSeconds);
const failureDelay = BigInt(Number(template.oracle.maxFailureDelay));
const roundCadence = BigInt(template.calendar.roundCadenceSeconds);
const rounds = Array.from({length: template.calendar.roundCount}, (_, index) => {
  const observationTime = firstRoundAt + BigInt(index) * roundCadence;
  return {
    roundId: String(index + 1),
    observationTime: observationTime.toString(),
    failureDeadline: (observationTime + failureDelay).toString(),
  };
});
const marketId = keccak256(stringToHex(`USD_NGN_SYNTHETIC_TESTNET:${configVersion}:${sampleStart}`));
const series = template.calendar.seriesMaturitiesInRounds.map((roundNumber) => {
  const round = rounds[roundNumber - 1];
  if (!round) throw new Error(`Series round ${roundNumber} is outside the generated calendar.`);
  return {
    seriesId: keccak256(stringToHex(`HEDGEMAKER_SERIES_V2:${configVersion}:${round.observationTime}`)),
    marketId,
    fixingAt: round.observationTime,
    expiryRoundId: round.roundId,
    oracleFailureDeadline: round.failureDeadline,
    strikeBandBps: Number(template.economics.strikeBandBps),
    calendarHash: template.calendar.hash,
  };
});

const materialized = {
  ...template,
  generatedAt: new Date().toISOString(),
  configVersion,
  oracle: {
    ...template.oracle,
    resolver: resolverAddress(),
    signers: signerAddresses(),
  },
  calendar: {
    ...template.calendar,
    sampleStart: sampleStart.toString(),
    firstRoundAt: firstRoundAt.toString(),
    rounds,
    series,
  },
};

await writeFile(outputPath, `${JSON.stringify(materialized, null, 2)}\n`, {flag: 'wx'});
console.log(`Wrote immutable rehearsal manifest: ${outputPath}`);
console.log(`Sample collection starts: ${new Date(Number(sampleStart) * 1_000).toISOString()}`);
console.log(`First 60-minute TWAP round: ${new Date(Number(firstRoundAt) * 1_000).toISOString()}`);

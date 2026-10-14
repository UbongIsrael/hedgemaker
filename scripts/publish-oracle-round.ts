import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  isHex,
  parseAbi,
  type Hex,
} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';

const CHAIN_ID = 10_143;
const ORACLE = getAddress('0x01124Fa39104a6c56550c2328503D5FD51a96c9b');
const oracleAbi = parseAbi([
  'function deploymentId() view returns (bytes32)',
  'function feedPolicies(uint64 version) view returns (address signer,address resolver,bytes32 methodologyHash,uint64 challengePeriod,uint64 maxPublicationDelay,uint64 maxFailureDelay,uint64 staleAfter,uint16 circuitBreakerBps,uint128 minRateRaw,uint128 maxRateRaw,bool configured)',
  'function proposeObservation((uint64 configVersion,uint64 roundId,bytes32 candidateId,uint64 observationTime,uint64 publicationTime,uint64 validUntil,uint64 failureDeadline,uint128 rateRaw,bytes32 sourceHash,bytes32 methodologyHash) observation,bytes signature)',
  'function finalizeObservation(bytes32 candidateId)',
]);

interface ObservationFile {
  configVersion: string;
  roundId: string;
  candidateId: Hex;
  observationTime: string;
  publicationTime: string;
  validUntil: string;
  failureDeadline: string;
  rateRaw: string;
  sourceHash: Hex;
  methodologyHash: Hex;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function uint(value: string, name: string) {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an unsigned integer string.`);
  return BigInt(value);
}

function hash(value: string, name: string): Hex {
  if (!isHex(value) || value.length !== 66 || /^0x0{64}$/i.test(value)) throw new Error(`${name} must be a non-zero bytes32.`);
  return value;
}

async function main() {
  const rpcUrl = required('MONAD_TESTNET_RPC_URL');
  const privateKey = required('HEDGEMAKER_ORACLE_PRIVATE_KEY');
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('HEDGEMAKER_ORACLE_PRIVATE_KEY is invalid.');
  const account = privateKeyToAccount(privateKey as Hex);
  const chain = defineChain({id: CHAIN_ID, name: 'Monad Testnet', nativeCurrency: {name: 'Monad', symbol: 'MON', decimals: 18}, rpcUrls: {default: {http: [rpcUrl]}}, testnet: true});
  const publicClient = createPublicClient({chain, transport: http(rpcUrl)});
  const walletClient = createWalletClient({account, chain, transport: http(rpcUrl)});
  if (await publicClient.getChainId() !== CHAIN_ID) throw new Error('RPC is not Monad Testnet chain 10143.');

  const action = required('HEDGEMAKER_ORACLE_ACTION');
  if (action === 'finalize') {
    const candidateId = hash(required('HEDGEMAKER_ORACLE_CANDIDATE_ID'), 'HEDGEMAKER_ORACLE_CANDIDATE_ID');
    const simulation = await publicClient.simulateContract({address: ORACLE, abi: oracleAbi, functionName: 'finalizeObservation', args: [candidateId], account});
    const txHash = await walletClient.writeContract(simulation.request);
    const receipt = await publicClient.waitForTransactionReceipt({hash: txHash});
    if (receipt.status !== 'success') throw new Error(`Finalization ${txHash} reverted.`);
    console.log(`finalizeObservation: ${txHash}`);
    return;
  }
  if (action !== 'propose') throw new Error('HEDGEMAKER_ORACLE_ACTION must be propose or finalize.');

  const filePath = resolve(required('HEDGEMAKER_ORACLE_OBSERVATION'));
  const input = JSON.parse(await readFile(filePath, 'utf8')) as ObservationFile;
  const observation = {
    configVersion: uint(input.configVersion, 'configVersion'),
    roundId: uint(input.roundId, 'roundId'),
    candidateId: hash(input.candidateId, 'candidateId'),
    observationTime: uint(input.observationTime, 'observationTime'),
    publicationTime: uint(input.publicationTime, 'publicationTime'),
    validUntil: uint(input.validUntil, 'validUntil'),
    failureDeadline: uint(input.failureDeadline, 'failureDeadline'),
    rateRaw: uint(input.rateRaw, 'rateRaw'),
    sourceHash: hash(input.sourceHash, 'sourceHash'),
    methodologyHash: hash(input.methodologyHash, 'methodologyHash'),
  } as const;
  const policy = await publicClient.readContract({address: ORACLE, abi: oracleAbi, functionName: 'feedPolicies', args: [observation.configVersion]});
  if (!policy[10]) throw new Error('Oracle policy is not configured for this version.');
  if (getAddress(policy[0]) !== account.address) throw new Error(`Signer ${account.address} does not match configured signer ${policy[0]}.`);
  if (policy[2] !== observation.methodologyHash) throw new Error('Observation methodology hash does not match the configured policy.');
  const deploymentId = await publicClient.readContract({address: ORACLE, abi: oracleAbi, functionName: 'deploymentId'});
  const signature = await account.signTypedData({
    domain: {name: 'HedgeMaker Rate Oracle', version: '1', chainId: CHAIN_ID, verifyingContract: ORACLE},
    types: {Observation: [
      {name: 'deploymentId', type: 'bytes32'},
      {name: 'configVersion', type: 'uint64'},
      {name: 'roundId', type: 'uint64'},
      {name: 'candidateId', type: 'bytes32'},
      {name: 'observationTime', type: 'uint64'},
      {name: 'publicationTime', type: 'uint64'},
      {name: 'validUntil', type: 'uint64'},
      {name: 'failureDeadline', type: 'uint64'},
      {name: 'rateRaw', type: 'uint128'},
      {name: 'sourceHash', type: 'bytes32'},
      {name: 'methodologyHash', type: 'bytes32'},
    ]},
    primaryType: 'Observation',
    message: {deploymentId, ...observation},
  });
  const simulation = await publicClient.simulateContract({address: ORACLE, abi: oracleAbi, functionName: 'proposeObservation', args: [observation, signature], account});
  const txHash = await walletClient.writeContract(simulation.request);
  const receipt = await publicClient.waitForTransactionReceipt({hash: txHash});
  if (receipt.status !== 'success') throw new Error(`Proposal ${txHash} reverted.`);
  console.log(`proposeObservation: ${txHash}`);
  console.log(`Candidate ${observation.candidateId} must remain undisputed through the configured challenge period before finalization.`);
}

await main();

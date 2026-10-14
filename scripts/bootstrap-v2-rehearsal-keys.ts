import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts';

const outputPath = resolve(process.env.HEDGEMAKER_OPERATOR_ENV_FILE?.trim() || './.env.operator.local');
const deployerKey = generatePrivateKey();
const resolverKey = generatePrivateKey();
const signerKeys = Array.from({length: 5}, () => generatePrivateKey());
const keeperKeys = Array.from({length: 2}, () => generatePrivateKey());
const deployer = privateKeyToAccount(deployerKey);
const resolver = privateKeyToAccount(resolverKey);
const signers = signerKeys
  .map((key) => ({key, address: privateKeyToAccount(key).address}))
  .sort((left, right) => left.address.toLowerCase().localeCompare(right.address.toLowerCase()));
const keepers = keeperKeys.map((key) => ({key, address: privateKeyToAccount(key).address}));

const contents = [
  '# Generated test-only HedgeMaker V2 identities. Never commit or paste this file into chat.',
  '# Load it with: set -a; source .env.operator.local; set +a',
  'MONAD_TESTNET_RPC_URL=',
  `MONAD_TESTNET_PRIVATE_KEY=${deployerKey}`,
  `HEDGEMAKER_ORACLE_SIGNER_KEYS=${signers.map((item) => item.key).join(',')}`,
  `HEDGEMAKER_RESOLVER_PRIVATE_KEY=${resolverKey}`,
  `HEDGEMAKER_KEEPER_PRIVATE_KEYS=${keepers.map((item) => item.key).join(',')}`,
  'HEDGEMAKER_DEPLOYMENT_MANIFEST=./config/deployments/monad-testnet-v2.json',
  'HEDGEMAKER_V2_TEMPLATE=./config/testnet-rehearsal.v2.example.json',
  'HEDGEMAKER_V2_MANIFEST=./config/testnet-rehearsal.v2.json',
  'HEDGEMAKER_IGNITION_DEPLOYMENT_ID=hedgemaker-v2-monad-testnet-final',
  'HEDGEMAKER_IGNITION_MODULE_ID=HedgeMakerV2RecoveryFinal',
  '',
].join('\n');

await writeFile(outputPath, contents, {flag: 'wx', mode: 0o600});
console.log(`Created test-only operator identities at ${outputPath}`);
console.log(`Fund deployer/submitter with test MON: ${deployer.address}`);
console.log(`Fund resolver with test MON: ${resolver.address}`);
console.log(`Offline signer addresses (no gas required): ${signers.map((item) => item.address).join(', ')}`);
console.log(`Optional keeper addresses: ${keepers.map((item) => item.address).join(', ')}`);

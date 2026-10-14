import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const operatorPath = resolve(process.env.HEDGEMAKER_OPERATOR_ENV_FILE?.trim() || './.env.operator.local');
const frontendPath = resolve(process.env.HEDGEMAKER_FRONTEND_ENV_FILE?.trim() || './.env');
const [operatorText, frontendText] = await Promise.all([
  readFile(operatorPath, 'utf8'),
  readFile(frontendPath, 'utf8'),
]);
const rpcMatch = frontendText.match(/^VITE_MONAD_RPC_URL=(.+)$/m);
if (!rpcMatch?.[1]?.trim()) throw new Error(`${frontendPath} has no VITE_MONAD_RPC_URL to reuse.`);
if (!/^MONAD_TESTNET_RPC_URL=$/m.test(operatorText)) {
  throw new Error('Operator RPC is already set or the generated file has an unexpected format. Refusing to overwrite it.');
}
const updated = operatorText.replace(/^MONAD_TESTNET_RPC_URL=$/m, `MONAD_TESTNET_RPC_URL=${rpcMatch[1].trim()}`);
await writeFile(operatorPath, updated, {mode: 0o600});
console.log(`Copied the existing Monad RPC into ${operatorPath} without printing it.`);

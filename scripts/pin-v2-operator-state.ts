import {readFile, rename, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const operatorPath = resolve(process.env.HEDGEMAKER_OPERATOR_ENV_FILE?.trim() || './.env.operator.local');
const values: Record<string, string> = {
  HEDGEMAKER_V2_MANIFEST:
    process.env.HEDGEMAKER_ACTIVE_V2_MANIFEST?.trim()
    || './config/testnet-rehearsal.v2.config-3.json',
  HEDGEMAKER_V2_CONFIG_VERSION:
    process.env.HEDGEMAKER_ACTIVE_V2_CONFIG_VERSION?.trim() || '3',
  HEDGEMAKER_IGNITION_DEPLOYMENT_ID: 'hedgemaker-v2-monad-testnet-final',
  HEDGEMAKER_IGNITION_MODULE_ID: 'HedgeMakerV2RecoveryFinal',
};
let contents = await readFile(operatorPath, 'utf8');
for (const [key, value] of Object.entries(values)) {
  const expression = new RegExp(`^${key}=.*$`, 'm');
  contents = expression.test(contents)
    ? contents.replace(expression, `${key}=${value}`)
    : `${contents.trimEnd()}\n${key}=${value}\n`;
}
const temporaryPath = `${operatorPath}.pin-v2`;
await writeFile(temporaryPath, contents, {mode: 0o600});
await rename(temporaryPath, operatorPath);
console.log(`Pinned the active public V2 manifest/deployment selectors in ${operatorPath}; secrets were preserved and not printed.`);

import {readFile, rename, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const deploymentPath = resolve(
  process.env.HEDGEMAKER_DEPLOYMENT_MANIFEST?.trim()
    || './config/deployments/monad-testnet-v2.json',
);
const frontendPath = resolve(
  process.env.HEDGEMAKER_FRONTEND_ENV_FILE?.trim() || './.env',
);
const deployment = JSON.parse(await readFile(deploymentPath, 'utf8')) as {
  deploymentId: string;
  deploymentBlock: string;
  contracts: Record<string, string>;
};
const c = deployment.contracts;
const replacements: Record<string, string> = {
  VITE_DEPLOYMENT_ID: deployment.deploymentId,
  VITE_DEPLOYMENT_BLOCK: deployment.deploymentBlock,
  VITE_ACCESS_MANAGER_ADDRESS: c.accessManager,
  VITE_SETTLEMENT_TOKEN_ADDRESS: c.settlementToken,
  VITE_VAULT_ADDRESS: c.vault,
  VITE_MARKET_CONFIG_ADDRESS: c.marketConfig,
  VITE_RATE_ORACLE_ADDRESS: c.rateOracle,
  VITE_POSITION_MANAGER_ADDRESS: c.positionManager,
  VITE_ORDER_BOOK_ADDRESS: c.orderBook,
};
for (const [key, value] of Object.entries(replacements)) {
  if (!value) throw new Error(`Deployment manifest is missing ${key}.`);
}

let contents = await readFile(frontendPath, 'utf8');
for (const [key, value] of Object.entries(replacements)) {
  const expression = new RegExp(`^${key}=.*$`, 'm');
  contents = expression.test(contents)
    ? contents.replace(expression, `${key}=${value}`)
    : `${contents.trimEnd()}\n${key}=${value}\n`;
}
const temporaryPath = `${frontendPath}.v2-update`;
await writeFile(temporaryPath, contents, {mode: 0o600});
await rename(temporaryPath, frontendPath);
console.log(`Applied verified public V2 deployment values to ${frontendPath}; private values were preserved and not printed.`);

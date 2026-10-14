import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const path = resolve(process.env.HEDGEMAKER_DEPLOYMENT_MANIFEST?.trim() || './config/deployments/monad-testnet-v2.json');
const deployment = JSON.parse(await readFile(path, 'utf8')) as {
  deploymentId: string;
  deploymentBlock: string;
  contracts: Record<string, string>;
};
const c = deployment.contracts;
console.log([
  `VITE_DEPLOYMENT_ID=${deployment.deploymentId}`,
  `VITE_DEPLOYMENT_BLOCK=${deployment.deploymentBlock}`,
  `VITE_ACCESS_MANAGER_ADDRESS=${c.accessManager}`,
  `VITE_SETTLEMENT_TOKEN_ADDRESS=${c.settlementToken}`,
  `VITE_VAULT_ADDRESS=${c.vault}`,
  `VITE_MARKET_CONFIG_ADDRESS=${c.marketConfig}`,
  `VITE_RATE_ORACLE_ADDRESS=${c.rateOracle}`,
  `VITE_POSITION_MANAGER_ADDRESS=${c.positionManager}`,
  `VITE_ORDER_BOOK_ADDRESS=${c.orderBook}`,
].join('\n'));

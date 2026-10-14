import {buildModule} from '@nomicfoundation/hardhat-ignition/modules';
import {keccak256, stringToHex} from 'viem';

/**
 * Monad-testnet recovery module for the interrupted first V2 deployment.
 *
 * Four constructor transactions were mined before Ignition stopped, but the
 * concurrent CollateralVault receipt was not written to deployed_addresses.
 * Reusing these bytecode-verified contracts avoids spending test MON twice.
 * A clean deployment should continue to use HedgeMakerV2.ts instead.
 */
const HedgeMakerV2RecoveryModule = buildModule('HedgeMakerV2Recovery', (m) => {
  const accessManagerAddress = m.getParameter(
    'accessManager',
    '0x66A8328EEFF320c47053C279cC31fff4d36A3e5a',
  );
  const settlementTokenAddress = m.getParameter(
    'settlementToken',
    '0x6Ad6053bA7bae4f335C140eB05025D6c5B6cBE52',
  );
  const vaultAddress = m.getParameter(
    'vault',
    '0x73fD808E194E49960fdEA1E1c0943394514428A5',
  );
  const marketConfigAddress = m.getParameter(
    'marketConfig',
    '0xafCb8274B0d9D78A2276cb68B78b2375F6111728',
  );
  const deploymentId = m.getParameter(
    'deploymentId',
    keccak256(stringToHex('hedgemaker-monad-testnet-v2')),
  );

  const accessManager = m.contractAt('HedgeMakerAccessManager', accessManagerAddress);
  const mockUsdc = m.contractAt('MockUSDC', settlementTokenAddress);
  const vault = m.contractAt('CollateralVault', vaultAddress);
  const marketConfig = m.contractAt('MarketConfig', marketConfigAddress);
  const rateOracle = m.contract('RateOracleV2', [accessManager, deploymentId]);
  const positionManager = m.contract('PositionManager', [
    accessManager,
    marketConfig,
    rateOracle,
    vault,
  ]);
  const orderBook = m.contract('OrderBook', [
    accessManager,
    marketConfig,
    rateOracle,
    positionManager,
  ]);

  m.call(positionManager, 'bindOrderBook', [orderBook], {id: 'bind_v2_order_book'});
  m.call(vault, 'bindController', [positionManager], {id: 'bind_v2_vault_controller'});

  return {
    accessManager,
    mockUsdc,
    marketConfig,
    rateOracle,
    vault,
    positionManager,
    orderBook,
  };
});

export default HedgeMakerV2RecoveryModule;

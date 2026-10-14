import {buildModule} from '@nomicfoundation/hardhat-ignition/modules';

/**
 * Final continuation of the interrupted Monad V2 deployment.
 * All five referenced contracts have verified bytecode. Only PositionManager
 * and OrderBook are deployed here, followed by their irreversible bindings.
 */
const HedgeMakerV2RecoveryFinalModule = buildModule('HedgeMakerV2RecoveryFinal', (m) => {
  const accessManager = m.contractAt(
    'HedgeMakerAccessManager',
    '0x66A8328EEFF320c47053C279cC31fff4d36A3e5a',
  );
  const mockUsdc = m.contractAt(
    'MockUSDC',
    '0x6Ad6053bA7bae4f335C140eB05025D6c5B6cBE52',
  );
  const vault = m.contractAt(
    'CollateralVault',
    '0x73Fd808E194e49960fDEa1E1c0943394514428A5',
  );
  const marketConfig = m.contractAt(
    'MarketConfig',
    '0xafCb8274B0d9D78A2276cb68B78b2375F6111728',
  );
  const rateOracle = m.contractAt(
    'RateOracleV2',
    '0x2e2e1F5E615c8D5ef3e8F548c9916bD9fa42eb49',
  );
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
    vault,
    marketConfig,
    rateOracle,
    positionManager,
    orderBook,
  };
});

export default HedgeMakerV2RecoveryFinalModule;

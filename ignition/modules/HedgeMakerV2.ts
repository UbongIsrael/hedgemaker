import {buildModule} from '@nomicfoundation/hardhat-ignition/modules';
import {keccak256, stringToHex} from 'viem';

/**
 * Fresh V2 deployment. The V1 PositionManager, OrderBook, and Vault contain
 * immutable/bind-once links, so an oracle upgrade requires a new protocol
 * stack. The old empty deployment remains readable and recoverable.
 */
const HedgeMakerV2Module = buildModule('HedgeMakerV2', (m) => {
  const deployer = m.getAccount(0);
  const deploymentId = m.getParameter(
    'deploymentId',
    keccak256(stringToHex('hedgemaker-monad-testnet-v2')),
  );

  const accessManager = m.contract('HedgeMakerAccessManager', [deployer]);
  const mockUsdc = m.contract('MockUSDC', [deployer]);
  const marketConfig = m.contract('MarketConfig', [accessManager]);
  const rateOracle = m.contract('RateOracleV2', [accessManager, deploymentId]);
  const vault = m.contract('CollateralVault', [accessManager, mockUsdc]);
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

export default HedgeMakerV2Module;

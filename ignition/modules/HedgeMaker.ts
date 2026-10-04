import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { keccak256, stringToHex } from "viem";

const HedgeMakerModule = buildModule("HedgeMaker", (m) => {
  const deployer = m.getAccount(0);
  const deploymentId = m.getParameter(
    "deploymentId",
    keccak256(stringToHex("hedgemaker-monad-testnet-v1")),
  );

  const accessManager = m.contract("HedgeMakerAccessManager", [deployer]);
  const mockUsdc = m.contract("MockUSDC", [deployer]);
  const marketConfig = m.contract("MarketConfig", [accessManager]);
  const rateOracle = m.contract("RateOracle", [accessManager, deploymentId]);
  const vault = m.contract("CollateralVault", [accessManager, mockUsdc]);
  const positionManager = m.contract("PositionManager", [
    accessManager,
    marketConfig,
    rateOracle,
    vault,
  ]);
  const orderBook = m.contract("OrderBook", [
    accessManager,
    marketConfig,
    rateOracle,
    positionManager,
  ]);

  m.call(positionManager, "bindOrderBook", [orderBook], {
    id: "bind_order_book",
  });
  m.call(vault, "bindController", [positionManager], {
    id: "bind_vault_controller",
  });

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

export default HedgeMakerModule;

import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: {
    profiles: {
      default: {
        version: "0.8.30",
        settings: {
          optimizer: { enabled: true, runs: 500 },
          viaIR: true,
          evmVersion: "cancun",
        },
      },
      production: {
        version: "0.8.30",
        settings: {
          optimizer: { enabled: true, runs: 2_000 },
          viaIR: true,
          evmVersion: "cancun",
        },
      },
    },
  },
  verify: {
    blockscout: {
      enabled: false,
    },
    etherscan: {
      enabled: false,
    },
    sourcify: {
      enabled: true,
      apiUrl: "https://sourcify-api-monad.blockvision.org",
    },
  },
  networks: {
    monadTestnet: {
      type: "http",
      chainType: "generic",
      chainId: 10_143,
      url: configVariable("MONAD_TESTNET_RPC_URL"),
      accounts: [configVariable("MONAD_TESTNET_PRIVATE_KEY")],
    },
  },
});

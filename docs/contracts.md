# HedgeMaker contracts

Status: implemented and locally tested; not deployed  
Target: Monad testnet (`10143`)  
Settlement asset: valueless six-decimal `MockUSDC`

## Contract suite

- `HedgeMakerAccessManager` centralizes selector-level roles and delays.
- `MarketConfig` stores append-only versions and listed maturity series.
- `RateOracle` verifies EIP-712 observations against immutable round schedules.
- `CollateralVault` owns token custody and the canonical accounting ledgers.
- `OrderBook` holds fully funded fixed and pegged orders and performs bounded scans.
- `PositionManager` applies entry marks, variation, calls, defaults, liquidations,
  maturity fixings, and oracle-failure closeout.
- `MockUSDC` is a capped, public-faucet test token and has no real-world value.

The contracts are non-upgradeable. Existing positions retain their pinned config,
series, schedule, and oracle rounds after a newer version is activated.

## Local verification

```sh
npm run contracts:compile
npm run contracts:typecheck
npm run contracts:test
```

`npm run check` runs the contract checks together with the specification verifier,
frontend unit tests, lint, and production build.

## Deployment order

The Ignition module at `ignition/modules/HedgeMaker.ts` deploys the authority,
token, config, oracle, vault, position manager, and order book. It then permanently
binds the Vault controller and PositionManager's OrderBook.

Set secrets only in the deployment environment. Never use a Vite-prefixed variable
for a private key and never commit a funded key.

```sh
export MONAD_TESTNET_RPC_URL="https://testnet-rpc.monad.xyz"
export MONAD_TESTNET_PRIVATE_KEY="0x..."
npx hardhat ignition deploy ignition/modules/HedgeMaker.ts --network monadTestnet
```

The module deliberately does not create an economic config or oracle calendar.
Those values require explicit review and should be applied in this order:

1. Call `MarketConfig.createVersion` with the deployed component addresses.
2. Call `RateOracle.configureFeed` for that version.
3. Append every scheduled observation through the intended fixing round with
   `RateOracle.scheduleRound`; these timestamps and failure deadlines cannot change.
4. Call `MarketConfig.activateVersion`. Activation verifies the oracle methodology,
   rate bounds, circuit breaker, settlement token, and Vault token.
5. Call `MarketConfig.addSeries`. Listing verifies that the fixing round's scheduled
   observation and failure deadline exactly match the series.
6. Configure AccessManager selector roles and delays for the config administrator,
   pauser, oracle-policy administrator, and treasury. Use distinct operational
   accounts or a testnet multisig before opening the UI.
7. Verify every source deployment on the selected Monad explorer and publish the
   addresses, chain ID, compiler settings, config digest, and series IDs together.

Do not enable frontend write actions until that manifest is verified.

## Security properties enforced

- Vault assets must cover order collateral, fee escrow, position equity, claims,
  and earned fees after every successful transition.
- Order intent IDs cannot be replayed, and token pulls cannot exceed the user's
  signed maximum.
- Matching scans the complete bounded live series book under one finalized round.
- Fixed reserves ceil the exact rational adverse entry value per lot.
- Oracle candidates cannot change a scheduled observation or failure deadline.
- Public evidence cannot halt the feed; only the configured resolver changes a
  candidate to disputed.
- Settlement processes finalized rounds in sequence, and a caller-selected batch
  size cannot skip earlier work to change a terminal payout.
- Exact collateral exhaustion defaults immediately, including zero-shortfall cases.
- Terminal positions cannot reopen, accept margin, or settle twice.

This is prototype/testnet software, not an audit or authorization for real funds.

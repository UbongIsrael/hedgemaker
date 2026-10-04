# HedgeMaker contracts

Status: deployed to Monad testnet and locally tested
Target: Monad testnet (`10143`)
Settlement asset: valueless six-decimal `MockUSDC`

## Monad testnet deployment

Deployment ID: `monad-testnet-v1`

| Contract | Address |
| --- | --- |
| `HedgeMakerAccessManager` | `0xef88C37b67a2f0F081B5976a3D425ECEa5ff5B0E` |
| `MockUSDC` | `0x1104E65eDDC14Db1661667Ee3C3E9BA8717D6395` |
| `CollateralVault` | `0xC42674265F553889B845641cee0F0E2E65Af5d0b` |
| `MarketConfig` | `0xd272BD0f3F3951B8926ed10a15747837047861ed` |
| `RateOracle` | `0x01124Fa39104a6c56550c2328503D5FD51a96c9b` |
| `PositionManager` | `0x3F8ae4Ec8C1A98b79286065338ABe16D81aB2a1d` |
| `OrderBook` | `0xdAF7ABc4594868676f4106e788BA88074Cb8CA21` |

The frontend environment uses `VITE_SETTLEMENT_TOKEN_ADDRESS` for the deployed
`MockUSDC`, so application code remains independent of the test token's contract
name. Deployment alone does not mean the economic config, oracle calendar, roles,
or listed series have been initialized; complete and verify the steps below before
enabling protocol writes.

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

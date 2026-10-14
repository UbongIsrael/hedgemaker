# HedgeMaker V2 Monad testnet deployment log

Status: **seven-contract deployment complete; configuration 3 active and warming up**
Chain: Monad testnet (`10143`)
Operator: `0xB90dAb356768fA59da074E1AbB5555c0B3F925Bb`

The first production-profile Ignition run mined four constructor transactions
before Monad rejected gas estimation for the larger remaining bytecode. All
four receipts were re-read from the configured RPC and their deployed bytecode
was verified. No market configuration, oracle policy, round, series, order, or
position has been created.

| Contract | Address | Transaction | Status |
| --- | --- | --- | --- |
| HedgeMakerAccessManager | `0x66A8328EEFF320c47053C279cC31fff4d36A3e5a` | `0x6f990fb8948b7d4545eb2807eeb6540b594054ade4cdf0ba59409c2f91807800` | mined |
| MockUSDC | `0x6Ad6053bA7bae4f335C140eB05025D6c5B6cBE52` | `0x4ce51e926053545dee13a4ae968f294b4c4df60e249a12c61700880d36803d7f` | mined |
| CollateralVault | `0x73Fd808E194e49960fDEa1E1c0943394514428A5` | `0x09eca50ff16e40691536084fd10f9dfcb569d7120d01b867df419d14e4b070d5` | mined, receipt recovered |
| MarketConfig | `0xafCb8274B0d9D78A2276cb68B78b2375F6111728` | `0x79af94afebd4319a48fd4cedd08806cb3bd401dc911c046ce1aee7c88b6c5820` | mined |

`ignition/modules/HedgeMakerV2Recovery.ts` deployed RateOracleV2 at
`0x2e2e1F5E615c8D5ef3e8F548c9916bD9fa42eb49`. Its next constructor was not
broadcast because a historical mixed-case Vault address in that Ignition
journal was not a valid EIP-55 checksum. The journal is preserved unchanged.

`ignition/modules/HedgeMakerV2RecoveryFinal.ts` references those five verified
contracts and deploys only PositionManager and OrderBook before performing the
two one-time bindings. It uses the gas-minimized `deployment` compiler profile.
These recovery modules are specific to this interrupted testnet deployment;
clean deployments use `HedgeMakerV2.ts`.

The final deployment manifest was written only after the recovery run completed
and every one of the seven addresses had verified bytecode. The frontend was
then switched only after roles, the immutable V2 manifest, scheduled rounds,
market configuration, and listed series were initialized.

## Completed V2 stack

| Contract | Address |
| --- | --- |
| HedgeMakerAccessManager | `0x66A8328EEFF320c47053C279cC31fff4d36A3e5a` |
| MockUSDC | `0x6Ad6053bA7bae4f335C140eB05025D6c5B6cBE52` |
| CollateralVault | `0x73Fd808E194e49960fDEa1E1c0943394514428A5` |
| MarketConfig | `0xafCb8274B0d9D78A2276cb68B78b2375F6111728` |
| RateOracleV2 | `0x2e2e1F5E615c8D5ef3e8F548c9916bD9fa42eb49` |
| PositionManager | `0x80499A64114E50FB2CAa1a3AC55FDbaF10f60227` |
| OrderBook | `0x06384b809dF8EF50b0D657a5525B5B0139dfA886` |

The deployment manifest was bytecode-verified before initialization. The
Vault controller and PositionManager OrderBook links are bound. Configuration
roles were assigned through AccessManager. Oracle/economic configuration 1 was
activated after its sample calendar had elapsed and is intentionally retained
as an abandoned audit record with no listed series.

Configuration 2 is also retained as an abandoned audit record. Its keeper
finalized samples 1–17, but an RPC receipt timeout delayed sample 18 past its
immutable validity window. No config-2 order was placed and no collateral was
pulled; its evidence record is `config/monad-testnet-v2-live-e2e.json`.

Configuration 3 uses `config/testnet-rehearsal.v2.config-3.json`, is active,
has ten scheduled rounds and three listed series, and begins its sample warm-up
at `2026-10-14T05:36:00Z`. Its source age is 360 seconds, sample cadence is
three minutes, and both `maxSampleGap` and `maxHold` are 240 seconds. The first
60-minute TWAP round is scheduled for `2026-10-14T06:40:00Z`; the automated
live E2E runner targets round 2 at `2026-10-14T06:55:00Z`.

# Market-maker integration pack

Status: implemented for the current Monad testnet deployment; unsigned and read-only by design.

This document turns the reasonable near-term recommendations in §4 of
[`market-maker-onboarding-copy.md`](./market-maker-onboarding-copy.md) into a
concrete release boundary. It does not change the contracts or introduce a
custodial service.

## What is necessary now

The current deployment can support quoting only after its economic configuration,
oracle schedules, and maturity series are initialized. The integration work that
is useful before and after that activation is:

1. Canonical market snapshots pinned to one block: active configuration, listed
   maturities, finalized oracle round, trading/matching state, and executable depth.
2. Exact unsigned transaction builders scoped to the trusted deployment. The
   `placeOrder` builder reproduces the contract reserve and fee calculations and
   returns decoded terms with calldata. Lifecycle builders cover token approval,
   cancellation, expiration, invalidation, matching, position synchronization,
   settlement, margin addition, liquidation, and claim withdrawal.
3. Address-scoped inventory reconciliation: wallet balance, vault allowance,
   claimable balance, order reserves, partial fills, isolated child-position
   equity, maintenance/initial thresholds, call cure amount, deadline, and rounds
   waiting to settle.
4. Explicit operator boundaries: polling and canonical reads remain authoritative;
   transactions are not treated as final from a hash alone; bounded maintenance
   calls must refresh state between attempts.

These surfaces are available at `/market-makers/integration` and in
`src/integrations/contracts/`. The frontend does not sign or submit the returned
transactions.

## What is deliberately not built

- Full-leg transfer requests, RFQs, auctions, or takeover acceptance. The current
  non-upgradeable contracts have no transfer ABI or ownership-lineage rules.
- Default replacement or backstop capacity. No separately funded reserve,
  activation ledger, compensation policy, or exhaustion behavior exists.
- Hosted REST/WebSocket APIs, signed webhooks, sponsorship, or an availability
  SLA. Those require independent authentication, reorg, retry, and operational
  controls.
- Post-only orders, batch placement, reuse of claimable funds, cross-margin, or
  external hedge adapters. Each changes current contract semantics or risk.

Nothing in this release should be described as guaranteed liquidity, rescue, a
transfer, funded coverage, or automatic execution.

## Trusted deployment scope

Builders take targets only from the versioned public environment configuration.
They do not accept arbitrary target contracts or RPC URLs. Settlement-token
approval targets `CollateralVault`, because the vault performs the token pull;
approval must not target `OrderBook`.

Every prepared order includes:

- deployment and chain identity;
- snapshot block, configuration version, and oracle round;
- unique intent ID and selected series;
- side, fixed/pegged price semantics, and REST/IOC behavior;
- lots, immediate-fill minimum, submission deadline, and expiry;
- protective limit, round binding or peg lifetime, and offset;
- exact collateral reserve, separate maximum fee escrow, and maximum token pull.

The payload must be rebuilt after its deadline or after any relevant round,
configuration, availability, or ownership change. A wallet or policy engine must
review and simulate it before signature.

## Inventory interpretation

Orders and positions are reconciled from deployment events and canonical reads at
the displayed block. Order reserves and fee escrow remain separate. Every fill can
create a child position with independent equity and deadlines; portfolio totals do
not net or pool those obligations.

`retainedGainRaw` means equity above the initial-margin threshold inside that
position. It remains locked until terminal closure. `cureAmountRaw` is the amount
needed to restore initial margin for an active call, not merely the maintenance
shortfall. `unsettledRounds` is informational until bounded settlement succeeds.

Public address lookup reveals only public chain state. It does not query or expose
Privy identity.

## Reproducible testnet scenario

The deployed contracts currently report `MarketConfig.activeVersion() == 0`, so a
live quoting scenario cannot honestly be completed until initialization. The
contract integration suite remains the reproducible lifecycle fixture:

```bash
npm run contracts:test
```

After a configuration and series are activated on Monad testnet:

1. Open `/market-makers/integration` and verify the deployment, block, active
   version, maturity, oracle round, and availability state.
2. Prepare a fixed REST order. Verify reserve, fee escrow, maximum pull, target,
   chain, and decoded terms against the displayed snapshot.
3. Approve the exact settlement-token amount to `CollateralVault`, then submit the
   separately reviewed `placeOrder` payload from the owner wallet.
4. Place a compatible opposite order from a second test wallet and run bounded
   matching if necessary. Confirm partial fills and child positions independently.
5. Load both wallets in the inventory monitor. Reconcile order reserves, locked
   position equity, round cursor, and any margin-call deadline.
6. Finalize/supply the configured test oracle observations, run bounded settlement,
   add margin where owner-eligible, and exercise a terminal path.
7. Verify closure credits claimable USDC, then prepare and submit a separate claim
   withdrawal. Reconcile the wallet receipt and vault claim at a new canonical
   block.

Record transaction hashes, block hashes, configuration version, oracle rounds,
gas used for maximum configured scans/fills/sync, and any RPC or reorg recovery.
Do not convert test outcomes into production capacity or profitability claims.

## Verification

The builder unit tests cover exact fixed and pegged previews, paused-market gating,
calldata decoding, and the vault approval target. The existing order-book tests
cover multi-order aggregation and cumulative depth. Run the complete repository
check before publishing:

```bash
npm run check
```

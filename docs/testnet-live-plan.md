# HedgeMaker live-testnet plan

> V2 implementation and execution commands now live in
> [the V2 end-to-end rehearsal runbook](./testnet-v2-runbook.md). The V1
> deployment below remains historical evidence and must not be initialized as
> the active quorum oracle stack.

Status date: 14 October 2026

## Goal

After Privy authentication, every wallet balance, allowance, order, position,
claim, rate, maturity, and transaction status must come from Monad testnet. A
missing value is displayed as loading, zero, empty, unavailable, or not
configured. Authenticated routes must never substitute fixture data.

## Verified deployment state

The seven V2 contracts are deployed, bytecode-verified, and correctly bound.
Economic/oracle configuration 3 is active with a 3-of-5 signer policy, three
independent synthetic rehearsal sources, ten immutable rounds, and three listed
series. The dedicated keeper and full lifecycle runner use the public testnet
and write transaction evidence to
`config/monad-testnet-v2-config-3-live-e2e.json`.

The synthetic sources prove protocol wiring and lifecycle behavior only. They
are explicitly not production USD/NGN price evidence. The production-source
registrations and independent signer/resolver handoff described below remain a
separate launch gate.

## Delivery plan

### 1. Enforce a real authentication boundary

- Privy is enabled by app ID, Monad RPC URL, and chain ID.
- Missing Privy configuration no longer creates a fake wallet or permits access
  to authenticated routes.
- The connected Privy wallet is the only owner used for account reads and
  writes.

### 2. Replace authenticated fixtures with canonical reads

- Read native MON, Mock USDC, Vault allowance, claimable funds, order reserves,
  fee escrow, and isolated position equity at one block.
- Discover wallet orders and positions from deployment-scoped events, then
  reconcile each entity with pinned contract reads.
- Display genuine zero and empty states.
- Refresh automatically and after confirmed transactions.

### 3. Enable wallet-authorized testnet actions

- Claim valueless Mock USDC from the public faucet.
- Approve the Vault for the exact order or margin amount.
- Place orders built from the active version, selected listed series, finalized
  oracle round, configured lot/tick/bands, and current block timestamp.
- Cancel remaining active order quantity.
- Add required margin, sync/settle positions, and withdraw claimable funds.
- Wait for a successful receipt before updating the UI; a transaction hash alone
  is not treated as confirmation.

There is no general protocol deposit balance. Order placement and margin top-up
pull approved tokens from the wallet. Cancellation and closure credit the
Vault's `claimable` balance, which is withdrawn separately.

### 4. Initialize the deployed market

Run the initializer only after approving and recording a real manifest:

1. Create immutable economic configuration version 1.
2. Configure the matching oracle policy.
3. Schedule sequential rounds through each planned fixing, plus a successor.
4. Activate version 1.
5. Add shared future maturity series whose fixing time and failure deadline
   exactly match scheduled oracle rounds.
6. Sign and propose the first authentic USD/NGN observation.
7. Wait through the configured challenge period and finalize it.
8. Verify `RateOracle.isTradingOpen(1) == true`.

The initializer deliberately has no economic, calendar, operator, or rate
defaults. It reads an explicit manifest and refuses inconsistent existing state.
The oracle publisher signs an explicit evidence-backed observation file. Neither
tool fabricates a seed rate.

### 5. Operate the oracle and keepers

- Publish and finalize every sequential round before its immutable failure
  deadline.
- Keep a successor round scheduled or trading closes.
- Match resting orders, sync active positions, settle maturities, and process
  eligible liquidations with receipt and reorg monitoring.
- If a round failure deadline is missed, do not attempt to rewrite it. Create a
  new config/feed version for new exposure and allow pinned old positions to use
  their oracle-failure closeout path.

## Decisions required before production activation

The source, quorum, aggregation, and migration recommendation is specified in
[Oracle V2: source, quorum, and settlement design](./oracle-v2-source-and-quorum-design.md).
The active testnet rehearsal must not be represented as a production oracle
before that V2 decision is approved.

The following cannot be guessed safely:

- canonical USD/NGN source, exact field semantics, evidence retention, calendar,
  and licensing;
- oracle signer and independent dispute resolver addresses;
- challenge, publication, failure, and staleness periods;
- rate and strike bounds, circuit breaker, margins, fees, caps, and grace period;
- exact future fixing timestamps and calendar hash.

The existing research proposes a 50 USD lot and a 5 NGN tick, but margins and
oracle policy still require explicit approval. Position takeover/replacement is
not part of the deployed ABI and cannot be enabled through configuration.

## Test sequence after activation

1. Sign in with two independent Privy wallets and verify zero balances.
2. Claim Mock USDC with both wallets and verify receipt, token balance, and
   remaining lifetime faucet capacity.
3. Place a 500 USD order from wallet A.
4. Place opposite orders of 200, 100, 50, and 150 USD from wallet B or multiple
   wallets at the same configured rate.
5. Verify four fills, no unfilled lots, isolated child positions, exact reserves,
   and aggregated public depth.
6. Repeat across different preset ticks and verify non-crossing orders remain
   open.
7. Partially fill then cancel an order; verify only the remainder becomes
   claimable and withdrawal restores the wallet balance.
8. Finalize later authentic oracle rounds; sync positions and verify equity,
   maintenance calls, top-ups, and deadlines.
9. Finalize the fixing, settle positions, and verify bilateral payouts and Vault
   solvency.
10. Exercise rejected signatures, stale rounds, paused new risk, expired orders,
    insufficient allowance/balance, margin default, liquidation, and oracle
    failure closeout.

## Operator commands

```sh
npm run testnet:initialize
npm run testnet:oracle:propose
npm run testnet:oracle:finalize
```

These commands require non-`VITE_` environment variables. Private keys must
never be stored in frontend environment files or committed to the repository.

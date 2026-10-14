# HedgeMaker V2 end-to-end rehearsal runbook

Status: deployed and operating on Monad testnet with a synthetic rehearsal feed.

The current interrupted deployment and its bytecode-verified recovery path are
recorded in [the V2 deployment log](./testnet-v2-deployment-log.md).

This runbook activates a **synthetic, valueless testnet rehearsal**. It proves
the source-validation, median, quorum, TWAP, matching, margin, settlement, and
withdrawal mechanics. It does not claim that the three synthetic inputs are
independent market-data vendors or that the resulting rate is an official CBN
NFEM fixing.

## What is automated

- a fresh, fully linked V2 protocol deployment;
- a versioned economic/oracle/calendar manifest;
- five sorted oracle signer identities with a 3-of-5 threshold;
- three distinct source and independence-group identifiers;
- timestamp, source spread, median, 60-minute TWAP, deviation, and staleness
  enforcement;
- market configuration, scheduled rounds, and two listed maturities;
- sample and round proposal/finalization transactions;
- a frontend environment block generated from verified deployed bytecode.

The full local test suite proves a $500 order filled by $200, $100, $50, and
$150 counterpart orders, partial cancellation, non-crossing preset ticks,
child-position collateral, bilateral settlement/withdrawal, and a margin-call
top-up.

The live testnet equivalent is one persistent command:

```sh
npm run testnet:v2:e2e-live
```

It waits for a healthy 60-minute oracle window, executes the split fill using
five isolated test wallets, waits for the listed expiry round, settles all four
child positions, withdraws every claim, and writes public transaction evidence
to a configuration-specific file under `config/`.

## Required operator inputs

Keep every private key outside `VITE_*` files and Git.

For a mechanics-only rehearsal, generate an ignored `0600` operator file:

```sh
npm run testnet:v2:bootstrap-keys
npm run testnet:v2:sync-rpc
set -a; source .env.operator.local; set +a
npm run testnet:v2:readiness
```

After deployment, prepare five isolated test-only trading wallets and optionally
fund the connected Privy wallet:

```sh
HEDGEMAKER_PRIVY_TEST_WALLET=0xYourPrivyWallet npm run testnet:v2:prepare-wallets
```

The command stores generated trader keys only in the ignored mode-`0600`
operator file, funds each wallet with test MON, and claims valueless mUSDC. It
never reuses oracle signer identities as traders.

The command prints only public funding addresses. It never prints the generated
private keys. The sync command copies the already configured frontend RPC
without printing it. Then fund the deployer and resolver addresses with test
MON. Skip this generator when using an existing controlled key setup.

```sh
export MONAD_TESTNET_RPC_URL='...'
export MONAD_TESTNET_PRIVATE_KEY='0x...'
export HEDGEMAKER_ORACLE_SIGNER_KEYS='0x...,0x...,0x...,0x...,0x...'
export HEDGEMAKER_RESOLVER_PRIVATE_KEY='0x...'
export HEDGEMAKER_DEPLOYMENT_MANIFEST='./config/deployments/monad-testnet-v2.json'
export HEDGEMAKER_V2_MANIFEST='./config/testnet-rehearsal.v2.json'
```

For mechanics-only rehearsal, the five signers may be test-only keys held by
one operator, but that is not operational independence. An authentic pilot
requires separately controlled signers and a separate resolver multisig.

All transaction-sending accounts and both browser test wallets need testnet
MON. The mUSDC faucet cannot pay gas for its own claim transaction.

## Deploy and initialize

Run these in order. The record and manifest commands use exclusive file
creation so they cannot silently replace a prior immutable deployment or
calendar.

```sh
npm run testnet:v2:deploy
npm run testnet:v2:record-deployment
npm run testnet:v2:roles
npm run testnet:v2:manifest
npm run testnet:v2:initialize
npm run testnet:v2:frontend-env
npm run testnet:v2:apply-frontend-env
npm run testnet:v2:pin-operator
```

The print command provides a reviewable public handoff. The apply command then
updates only those public `VITE_*` address/block keys in the untracked frontend
`.env`, preserving the existing Privy and Monad RPC values without printing
them. Restart the dev server after changing Vite environment variables.

The materialized calendar freezes a sample start, ten 15-minute oracle rounds,
and synthetic 15-minute, one-hour, and two-hour rehearsal maturities. Do not
regenerate it on retry. If its first
sample time was missed, create a deliberately new deployment/config calendar
instead of pretending the old timestamps were observed.

## Warm up and operate the oracle

The first round needs a real 60-minute onchain history. The frozen calendar
includes a four-minute anchor lead before the 60-minute window. Start the
operator at `sampleStart`; the feed permits up to a three-minute sample/hold
gap so normal public-testnet inclusion jitter does not invalidate the TWAP.
Every three minutes:

```sh
export HEDGEMAKER_REHEARSAL_RATE_RAW='1500000000' # ₦1,500.000000/USD
export HEDGEMAKER_V2_ORACLE_ACTION='sample:propose'
npm run testnet:v2:oracle
```

For the continuous rehearsal, prefer the state-aware keeper. It starts at the
immutable `sampleStart`, proposes and finalizes samples through their challenge
periods, proposes/finalizes due rounds, retries transient RPC failures, and
stops rather than backdating after a missed maximum gap or resolver incident:

```sh
export HEDGEMAKER_REHEARSAL_RATE_RAW='1500000000'
npm run testnet:v2:keeper
```

Monitor the submitter's test MON. In this single-operator synthetic rehearsal
only, `npm run testnet:v2:rebalance-gas` may move surplus resolver test MON to
the submitter while preserving the configured resolver reserve. Do not use this
co-located-key convenience as a production operating model.

After the 60-second challenge period, finalize that sample before proposing the
next one:

```sh
export HEDGEMAKER_V2_ORACLE_ACTION='sample:finalize'
npm run testnet:v2:oracle
```

At a scheduled round time, after the endpoint sample is finalized:

```sh
export HEDGEMAKER_V2_ORACLE_ACTION='round:propose'
npm run testnet:v2:oracle
# wait through the challenge period
export HEDGEMAKER_V2_ORACLE_ACTION='round:finalize'
npm run testnet:v2:oracle
```

If a sample or round exceeds the 5% breaker or is disputed, the independent
resolver must record an explicit decision and rationale before it can proceed:

```sh
export HEDGEMAKER_V2_RESOLUTION_ACTION='sample' # or round
export HEDGEMAKER_V2_RESOLUTION_ACCEPT='true'   # false rejects it
export HEDGEMAKER_V2_RESOLUTION_RATIONALE='ticket/incident reference and reason'
npm run testnet:v2:resolve
```

The rate value above has no silent default. The operator must explicitly set it
for each rehearsal sample. `1500000000` means ₦1,500 because rates use six
decimals; the old `1500000` fixture meant ₦1.50 and is not used here.

## Browser end-to-end checklist

1. Sign into Privy as wallet A and confirm its actual MON and mUSDC balances.
2. Fund wallet A with test MON, claim mUSDC, and verify the transaction receipt
   and new token balance.
3. Repeat with wallets B–E or use fewer independent wallets for the four
   counterpart orders.
4. Wallet A places a $500 fixed order at a listed ₦5 tick.
5. Counterpart wallets place $200, $100, $50, and $150 opposite orders at the
   same tick. Confirm four child positions and an empty remainder.
6. Place orders one tick apart and confirm both remain visible and unfilled.
7. Partially fill another order, cancel it, withdraw only its unfilled claim,
   and confirm exact wallet/vault conservation.
8. Publish a later round, sync a position, exercise a margin call and top-up.
9. Publish/finalize the maturity round, settle every child position, and have
   both sides withdraw their exact claimable balances.
10. Confirm stale/quarantined feeds block new orders while cancellation,
    top-up, withdrawal, and already-finalized historical settlement remain
    available.

## Registration and external dependencies

- **Privy:** an app with the local/shared origin, selected login methods, and
  embedded wallets enabled. The current local sign-in already works; only add a
  production origin when one exists.
- **Monad:** no application registration is inherently required, but deployer,
  submitter, and browser wallets need test MON and a working RPC endpoint.
- **Oracle rehearsal:** no vendor account is required because it is explicitly
  synthetic.
- **Authentic pilot:** provider access and legal permission are still required
  for the selected Bloomberg/LSEG/CBN/Chainlink data products. Source field,
  economic timestamp, cadence, outage behavior, independence, and onchain
  redistribution/derived-value rights must be qualified before changing the
  manifest to `productionReady`.
- **Operational independence:** provision five independently controlled signer
  wallets and a separate resolver multisig. Five keys on one machine prove only
  contract quorum mechanics.

## Safety boundary

V2 intentionally keeps cancellation, margin deposits, withdrawals, and
settlement against already finalized immutable rounds available during a live
feed outage. A stale, disputed, quarantined, or history-incomplete feed cannot
open new risk or finalize the affected round. This avoids turning an oracle
incident into a custody freeze.

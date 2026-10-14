# HedgeMaker Oracle V2: source, quorum, and settlement design

Status: research-qualified design, not approved for activation
Date: 13 October 2026

## Decision

HedgeMaker should not initialize the currently deployed single-signer oracle as
the production design. The deployment is still empty, so the safer path is to
build and deploy Oracle V2 before any positions exist.

The product must distinguish two economically different rates:

1. **Final settlement fixing:** the official **CBN NFEM daily VWAP**, expressed
   as NGN per USD. Independent operators attest the same published benchmark;
   different benchmark definitions are not medianed together.
2. **Intraday risk mark:** a separately licensed and qualified USD/NGN spot
   source set. Eligible observations are normalized, freshness-checked, grouped
   by independent upstream, medianed, and accumulated into a trailing 60-minute
   TWAP. This mark can drive order gating and variation margin, but it must not
   silently replace the contractual NFEM maturity fixing.

A 30-minute window may be tested, but the manifest must choose one immutable
window per configuration. The recommended starting policy is 60 minutes.

## Why three public APIs are not enough

An API is a delivery channel, not necessarily an independent price origin.
Several vendors may redistribute the same benchmark or use overlapping bank
contributors. Conversely, CBN NFEM, FMDQ NAFEX, WMR, and BFIX do not necessarily
represent the same observation window or market segment. Taking their median
would create an undocumented synthetic benchmark.

Source independence therefore means a distinct `independenceGroupId`, supported
by documented upstream provenance. The onchain contract can enforce distinct
group identifiers, but legal and operational due diligence must establish that
the identifiers are truthful.

## Source selection

### Contractual settlement source

**Selected: CBN NFEM daily VWAP.**

CBN describes NFEM as the official daily rate and publishes it separately from
the closing, high, low, and simple-average fields. The settlement methodology
must use the NFEM VWAP field only. The fixing calendar must align maturities to
an expected NFEM business-day publication.

The public table exposes a fixing date but does not establish a machine API,
precise publication timestamp, SLA, or commercial/onchain redistribution right.
Those items remain procurement blockers. Page retrieval time must never be used
as the economic observation time.

Primary sources:

- [CBN NFEM exchange-rate table](https://www.cbn.gov.ng/rates/ExchRateByCurrency.html)
- [CBN revised NFEM guidelines](https://www.cbn.gov.ng/Out/2024/FMD/REVISED%20GUIDELINES%20FOR%20THE%20%28NFEM%29.pdf)

### Intraday candidate set

The following are the preferred qualification candidates, not yet an approved
production quorum:

1. **Bloomberg BFIX USD/NGN.** BFIX is administered as a regulated benchmark,
   calculated every 30 minutes, and uses a TWAP of Bloomberg Generic prices.
   For non-G10 currencies, the published methodology uses a 15-minute window.
   Confirm USD/NGN product identifiers, timestamps, commercial settlement use,
   and public-chain redistribution rights through Bloomberg Enterprise Data.
2. **LSEG WMR USD/NGN intraday spot.** WMR has broad hourly intraday coverage
   and documented governance. NGN is not one of its transaction-based “Trade
   Currencies”; its value may use indicative multi-contributor quotes, official
   benchmarks, or expert judgement. The exact NGN lineage and fallback flags
   must be retained. The inspected 30-minute configuration does not include NGN.
3. **Chainlink NGN/USD on Celo, inverted deterministically.** Chainlink lists a
   medium-market-risk NGN/USD reference feed on Celo. It offers onchain round and
   update timestamps and a decentralized oracle network, but is not native to
   Monad. A HedgeMaker observer would have to validate Celo finality, feed
   identity, `updatedAt`, decimals, positivity, heartbeat/deviation behavior,
   and inverse rounding. The source must be suspended automatically if its
   observed cadence fails the configured maximum age.

Primary sources:

- [Bloomberg BFIX overview](https://professional.content.cirrus.bloomberg.com/professional2023/products/indices/fx-fixings-reference-rates/)
- [Bloomberg BFIX methodology notice](https://company.content.cirrus.bloomberg.com/notices/currency-data/)
- [LSEG WMR benchmark overview and access](https://www.lseg.com/en/ftse-russell/benchmarks/wmr-fx-benchmarks)
- [LSEG WMR methodology](https://www.lseg.com/content/dam/ftse-russell/en_us/documents/ground-rules/wmr-fx-methodology.pdf)
- [Chainlink NGN/USD feed](https://data.chain.link/feeds/celo/mainnet/ngn-usd-fx)

### Monitors and fallbacks

- **FMDQ NAFEX** is valuable as an independently administered discrepancy
  monitor, but it is a daily benchmark using a prior-noon/current-noon VWAP and
  an explicit waterfall that can carry the previous day forward. It must not be
  treated as another observation of CBN NFEM or a fresh intraday quote.
- **OANDA** is a useful vendor-evaluation candidate with broad aggregation and
  TWAP products, but NGN-specific cadence and timestamp semantics require a
  feed trial. Its January 2025 agreement requires written permission before
  making rates or derived values available to third parties.
- **Xe** may update the API frequently while using the latest available quote
  for irregularly traded currencies. Delivery timestamp is therefore
  insufficient proof of NGN quote freshness.
- Generic free conversion APIs are excluded from settlement.

Primary sources:

- [FMDQ NAFEX January 2024 methodology](https://fmdqgroup.com/exchange/wp-content/uploads/2024/01/FMDQ-Exchange-NAFEX-Methodology-January-2024.pdf)
- [FMDQ benchmark catalogue](https://fmdqgroup.com/exchange/market-data/benchmarks/)
- [FMDQ data and redistribution fees](https://fmdqgroup.com/exchange/wp-content/uploads/2024/10/FMDQ-Exchange-2024-Fees-and-Dues-Framework.pdf)
- [OANDA rate methodology](https://www.oanda.com/foreign-exchange-data-services/en/exchange-rates-api/api-accuracy/)
- [OANDA rate subscription agreement](https://docs.oanda.com/4d06dd1b-0950-4ad1-a895-737d5fa52950/OANDA_RATE_SUBSCRIPTION_AGREEMENT_1.pdf)

## Source observation rules

Each submitted source sample must include:

```solidity
struct SourceObservation {
    bytes32 sourceId;
    uint64 observedAt;       // source's economic quote or fixing time
    uint64 publishedAt;      // source publication time, when defined
    uint64 fetchedAt;        // operational telemetry; never a freshness substitute
    uint128 rateRaw;         // normalized NGN per USD at 1e6
    bytes32 payloadHash;     // commitment to retained raw evidence
}
```

The contract rejects:

- unknown, disabled, or duplicate source IDs;
- duplicate independence groups;
- zero, negative, future, or configured-bound-violating rates;
- observations older than that source's `maxAgeSeconds`;
- source timestamps whose spread exceeds `maxSourceSkewSeconds`;
- fewer than three eligible independence groups after validation;
- a cross-source spread above `maxSourceSpreadBps`;
- an offchain-submitted median that differs from the onchain result.

All configured eligible responses must be committed in the evidence root. A
publisher may exclude a source only using a deterministic rejection rule and
must include the rejected payload and reason in the retained evidence bundle.

## Median and TWAP

For three to five bounded samples, compute the median onchain. If an even number
is permitted, use the floor of the mean of the middle pair. The source-set
manifest must choose the rule; it cannot be selected by a reporter.

Intraday medians feed a separate sample stream. They must not become thousands
of PositionManager settlement rounds. The settlement/risk round consumes a
trailing TWAP from the accepted sample stream:

```text
TWAP = floor(sum(rateRaw[i] * coveredSeconds[i]) / windowSeconds)
```

Recommended policy:

- trailing window: 3,600 seconds, ending exactly at the scheduled round time;
- sample cadence: established only after feed trials;
- full-window coverage required;
- an anchor sample at or before the window start required;
- no interval may exceed `maxHoldSeconds` or `maxSampleGapSeconds`;
- disputed/quarantined samples contribute zero seconds and cause insufficient
  coverage rather than silently shrinking the denominator;
- report window start/end, coverage seconds, first/last sample IDs, sample root,
  median, and TWAP onchain.

Repeatedly fetching a daily benchmark does not create a 60-minute TWAP.

## Signer and governance policy

Use **3-of-5 signers**. Each signer must independently fetch, validate, normalize,
and recompute the identical payload. Signers must run under separate operator
identities and failure domains. Two-of-three is acceptable only for a temporary
testnet rehearsal, not the intended production policy.

The EIP-712 digest must bind:

- chain ID, verifying contract, and deployment ID;
- config, source-set, signer-set, and methodology versions/hashes;
- sample or settlement round ID and candidate ID;
- every normalized source observation and evidence root;
- median/TWAP window and resulting rate;
- valid-until and failure deadline.

Signatures are sorted by signer address and must be unique. Private keys and
vendor credentials never appear in the repository or any `VITE_` variable. The
public manifest contains only signer addresses and secret environment-variable
names.

Use a separate governance/resolver multisig. A deviation greater than the
configured circuit-breaker threshold becomes `Quarantined`, records the full
candidate, pauses new exposure, and cannot enter the TWAP. Confirmation must be
an explicit transaction binding the candidate digest, old/new rates, deviation,
reason hash, and expiry. Governance confirmation must not bypass source count,
freshness, bounds, or TWAP coverage.

## Liveness and pause semantics

Expose distinct predicates:

- `canOpen(configVersion)`
- `canSettle(configVersion, roundId)`
- `feedStatus(configVersion)`

Stale, disputed, or insufficient-source data blocks new orders and matching.
An unresolved candidate cannot settle a price-dependent round. Cancellation,
claim withdrawal, and margin deposits remain available.

Do **not** make every settlement call revert merely because the newest live feed
is stale. Previously finalized, undisputed historical rounds remain usable. A
valid maturity fixing accepted while healthy remains a contractual obligation
even after the feed later retires. An unresolved fixing follows its immutable
failure deadline and deterministic oracle-failure closeout path.

This is safer than a blanket settlement pause, which could trap collateral and
disable top-ups during an outage.

## Current deployment gap and migration

The current RateOracle validates one signer, one opaque `sourceHash`, publisher-
asserted timestamps, and a previous-rate circuit breaker. Its signer may be an
ERC-1271 multisig, but the contract does not verify source count, source
timestamps, independence groups, median, or TWAP. Position settlement also has
no per-round `canSettle` predicate.

The complete policy therefore requires new RateOracle V2, PositionManager V2,
OrderBook V2, and Vault deployment. A MarketConfig V2 is preferable so source,
signer, TWAP, and liveness policy hashes are validated explicitly. Because no
positions or orders exist in the current deployment, migration should happen
before activation. Existing addresses must not be silently repointed.

## Approval gates

Oracle activation remains blocked until all of these are true:

- the contractual settlement benchmark and quote convention are approved;
- CBN machine-access, timestamp, SLA, and onchain-use rights are confirmed;
- three intraday independence groups pass a recorded feed trial;
- vendor public-chain settlement and redistribution rights are signed;
- source and signer set manifests have canonical hashes;
- five signer addresses and separate resolver governance are provisioned;
- TWAP cadence/gap limits are derived from observed source behavior;
- circuit-breaker and bootstrap reference policies are approved;
- V2 contracts and outage/rounding/boundary tests pass independent review.

Until then, the manifest must remain `productionReady: false`.

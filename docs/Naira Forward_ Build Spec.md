# Naira Forward: Build Spec (Monad Metropolis)

Working name. Draft v3, addendum audited 2026-10-03. Testnet specification, not implemented code.
See [frontend flows and schemas](./frontend-flow-and-schemas.md) and the
[audit findings and decisions](./spec-audit.md). This document governs financial
semantics; the frontend document governs their presentation. Resolve conflicts
before implementation. Numbers marked *placeholder* require calibration. The
[reviewed addendum](./spec-addendum.md) defines pegged orders, fees, source policy,
integration surfaces, and additional verification requirements; it is part of this
specification. Its [audit](./addendum-audit.md) records changes to the supplied draft.

## 1. Product and scope

A collateral-limited, cash-settled USD/NGN forward on Monad testnet, paid in test
USDC. Two opposite orders create an isolated bilateral position. Finalized oracle
updates transfer variation margin between its two locked collateral balances.
Keepers submit transactions; neither settlement nor liquidation happens merely
because time passes. Users authorize every top-up; there is no automatic debit.

First users to validate in interviews:

- Importer: wants protection against a higher NGN price of USD.
- Dollar earner: wants protection against a lower NGN price of USD.

Describe this as partial protection tied to an official reference rate. It does
not deliver dollars, guarantee a conversion price, or cover P2P/parallel-market
rates. Early liquidation and collateral shortfalls can end protection before
maturity. Ask users what currency amount and conversion rate they actually need.
Founder research reports practical bank/FMDQ access barriers for small users;
the [evidence register](./evidence/market-access.md) records the claim and missing
supporting material. Do not generalize this to every small user or provider.

Launch participants are hedgers matching directly; no dedicated market maker is
required by the protocol. Compatible demand is not guaranteed: unmatched orders
rest and show “no counterparty yet.” Builder integrations are in V1 scope; market
maker tooling, Ghana deployment, cross-margin, delegated placement, and a gap-risk
reserve are later work. Track positioning: Metropolis Markets. Fast execution
helps the margin loop, but end-to-end protection also depends on oracle and keeper
latency; no fixed one-second guarantee is made.

V1 has one testnet market, isolated margin, no leverage borrowing, no withdrawal
of live margin or profits, fixed and reference-pegged orders, a separate notional
fee ledger (effective fees zero on testnet), no position transfer, and no early netting.
An opposite trade opens another independently margined position; it is not an
exit. The guided V1 flow therefore offers no early-close action.

## 2. Contracts, authority, and custody

| Component | Responsibility |
| --- | --- |
| `MarketConfig` | Immutable versioned economic terms, token, rate scale, oracle schedule, limits, and shared maturity series. Existing orders/positions retain their version. |
| `OrderBook` | Escrow-backed limits, deterministic price-time priority, bounded matching, cancellation, and expiration. |
| `PositionManager` | Sole controller of Vault accounting; authenticates OrderBook requests and user/keeper actions; creates positions and applies each round once. |
| `Vault` | Pulls approved test USDC; tracks collateral reserves, separate fee escrow, position collateral, claims, and earned treasury fees; transfers claims only to their owner. |
| `RateOracle` | Validates signed, ordered rounds and their publication schedule; separates proposed, disputed, rejected, and finalized rates. |
| Keeper | Permissionlessly submits bounded settlement, expiration, and liquidation transactions; monitored service with manual recovery. |

`placeOrder` calls OrderBook, which requests a reserve through PositionManager;
Vault is the ERC-20 spender. Deposits/top-ups verify the received token amount.
Support only the configured standard, non-rebasing, non-fee-on-transfer token.
Use checked arithmetic, safe transfers, reentrancy protection, and atomic ledger
updates. Never let a caller supply an unchecked payer, recipient, or spend amount.

Cancellation and terminal position closure credit **claimable USDC**. A separate
`withdrawClaimable(amount)` action sends it to the owner wallet. A failed token
transfer leaves that claim intact and does not block other users' settlement.
No prefunding/reuse of claims for orders in V1: withdraw before funding a new order.

For each token, at every successful state transition:

`vault assets >= order collateral reserves + unearned fee escrow + position collateral + user claimable balances + earned treasury fees`

Transfers conserve accounted assets; unsolicited tokens create no user claim.
No position may consume another position's collateral or create a negative balance.
Testnet keeper rewards are zero; fund keeper gas separately. A future reward design
must define a funded budget and cannot silently deduct from customer claims.
At match, transfer only earned fees from separately consented fee escrow to the
treasury ledger. Never fund fees from collateral or an existing claim. Cancellation
returns unused fee escrow along with unused collateral reserve. See addendum §A4.
Contract-wallet owners have the same rights as EOAs; never use `tx.origin` or EOA
checks. There is no delegated `placeOrderFor` in V1.

Admin may pause new orders/matches and manage future config versions; it cannot
rewrite live strikes, margin rules, schedules, or withdraw user collateral. V1
deployments are non-upgradeable. Oracle signer and dispute resolver are explicitly
trusted testnet roles with separate keys and logged actions. Real-value deployment
needs separate governance, economic, contract-security, and legal review.

## 3. Payoff, units, and collateral

### 3.1 Contractual value

Let `N` be reference USD notional, `K` the strike in NGN/USD, and `R > 0` the
finalized reference rate. Dollar-buyer value in USDC is:

`V(R) = N * (R - K) / R`

Dollar-seller value is `-V(R)`. This preserves the original inverse payoff:
it corresponds to exchanging `N USD` against `N*K NGN`, valuing the difference
in USD at `R`, with the explicit assumption `1 USDC = 1 USD`. In the ideal fully
settled, fee-free case, N USD income plus seller PnL converts to exactly N*K NGN
at that same R: `N*R + (-V(R))*R = N*K`. The analogous importer cost is N*K.
This identity is conditional on full payment, holding to maturity, and conversion
at that reference; actual fees, rounding, funding costs, liquidation and basis risk
break a guaranteed outcome. The ticket must show those assumptions and both scenarios.

For `N = 1,000`, `K = 1,650`, `R = 1,700`, buyer value is approximately
`29.411764 USDC`; at `R = 1,600`, it is `-31.25 USDC`. Seller values are opposite.
Buyer theoretical losses grow without bound as `R` approaches zero, but V1 is
non-recourse: users can lose committed initial collateral, top-ups, and retained
gains, not unrelated wallet funds. Counterparties may receive less than the
formula promises. USDC depeg/freeze risk remains outside this hedge.

### 3.2 Exact arithmetic

- Test USDC and notional use six decimal places (`1 USD = 1_000_000` units).
- Rates and strikes use six decimal places (`1 NGN/USD = 1_000_000` rate units).
- Compute signed `Vraw = truncTowardZero(Nraw * (Rraw - Kraw) / Rraw)` with
  overflow-safe multiply/divide. Derive seller value by negating that result.
- Store the last contractual value. Delta is `Vraw(next) - Vraw(previous)`, not
  a separately rounded interval formula. Rounding then telescopes exactly.
- Each fill creates one position; rounding is per position. No later split/merge.
- Initial and maintenance margin are ceiling-rounded per configured lot, then
  multiplied by whole lot count. Use the same rule in reserve, fill, and UI code.
- Enforce configured positive rate/strike ranges, lot size, tick size, maximum
  notional, orders, batch size, and safe arithmetic bounds in contracts.

### 3.3 Entry and variation

Initial margin is 5% of N and maintenance is 2.5% (*demo placeholders*). Initial
must exceed positive maintenance. All earned variation remains locked until close.
Both sides continue bearing risk; a displayed gain is not withdrawable cash.

Fixed orders bind to a single finalized oracle round and active config version. For
side sign `s = +1` buyer, `-1` seller, reserve per lot is:

`initialMarginPerLot + ceil(max(0, -s * exactEntryValuePerLotAtLimit))`

Multiply by order lot count. The adverse entry-value reserve uses the limit strike
and the bound round, so any permitted price improvement requires no more reserve.
At match, compute `V0` at the execution strike and bound round; allocate each side
`initialMargin + max(0, -s*V0)`, credit surplus reserves to its claimable balance,
and transfer `V0` immediately and atomically. Both resulting balances must be at
least initial margin. Store `lastValue = V0`; never charge it again on the next
round. Never admit an already under-margined position by postponing its first mark.

Pegged orders instead use the round-independent adverse-offset reserve and
owner-protective tick rounding in addendum §A3. At each fill they use the current
finalized round to compute the actual entry mark and thereafter the position's
strike is fixed. A position never continues to reprice with its parent pegged order.
Fee escrow is additional to the collateral reserve for both order types.

For later rounds, transfer `abs(delta)` from losing locked collateral to winning
locked collateral. If a nonzero delta equals or exceeds the loser's balance,
transfer only that balance,
record contractual delta, actual paid delta, and unpaid shortfall separately,
and immediately close as `defaulted`. There is no debt collection, recovery claim,
insurance promise, or socialized loss in V1. Release each side's remaining balance
to its own claimable account. Exact exhaustion has zero shortfall but still closes;
otherwise a zero-equity side would retain a free option on future rate recovery.
Do not continue marking a defaulted position.

### 3.4 Margin calls and liquidation

A finalized settlement below maintenance opens a side-specific call. Its deadline
is round `finalizedAt + gracePeriodSeconds`, not keeper execution time. Warn when
keeper delay consumes the response window. Further losses do not extend a call.
The call clears only after a finalized settlement or authorized top-up restores
initial margin. Merely regaining maintenance is insufficient. Deadline equality
is eligible for liquidation; a late top-up cannot revive the position.

Before a top-up, process due rounds and due terminal events. If this closes the
position, reject the top-up atomically. Top-ups take effect at transaction time;
they cannot retroactively rescue a missed deadline. Both sides may have a call
after a reversal; track deadlines independently and use the earliest due deadline.

Liquidation settles all eligible finalized rounds preceding the deadline, then
closes at that last valid mark. It returns **each owner's own remaining equity**
as claimable USDC; it does not confiscate the losing side's remaining balance.
No extra liquidation fee in V1. Example: from 50 USDC each, a 40 USDC loss leaves
10 and 90; liquidation releases 10 and 90, not 0 and 100.

### 3.5 Deterministic event order and liveness

Process finalized rounds in sequence exactly once. Between rounds evaluate the
earliest outstanding margin deadline, maturity, or oracle-failure deadline. Before
applying a round finalized at/after a call deadline, execute that liquidation first;
a later rate reversal cannot cure a deadline that already elapsed. At ties use
oracle-failure closeout, then maturity, then margin liquidation, then regular round.
Final fixing is handled specially by the maturity procedure below. Once maturity
is reached, ordinary calls/liquidations give way to final fixing or oracle failure.

Use bounded batches and persistent cursors, without skipping intermediate rounds.
`syncPosition` can commit catch-up separately; a user action requiring more work
reverts with `SYNC_REQUIRED`. New actions require the cursor to be current.
No global iteration over all positions or user-dependent unbounded matching.
Keeper outages must be visible; provide permissionless/manual catch-up and alerts.
Grace windows must exceed the intended oracle/keeper latency, not just demo speed.

## 4. Orders and maturity series

A series binds market ID, config version, settlement token, exact UTC fixing time,
oracle calendar, and expiry round identity. Tenor labels (e.g. 7/14/30 days) are
display helpers for shared listed series; do not calculate separate maturities
from each wallet's order timestamp. Match only within the identical series.

- Buyer limit is the **maximum** acceptable strike; seller limit is the **minimum**.
- Cross when buyer limit >= seller limit. Execute at resting maker's strike.
- Best price first, then onchain sequence priority at that price; self-match by
  the same address is rejected. This cannot establish distinct human identity.
- Every fill is whole lots and creates a separate position linking both order IDs.
- Fixed orders must bind the current finalized round. Pegged orders derive their
  effective limit from that round under addendum §A3. A proposed/disputed/stale
  feed suspends all matching. New finalized rounds invalidate residual fixed orders;
  eligible pegged orders persist. Never fill using a cached old effective strike.
- Each order has a separate `validUntil < series.fixingAt` and bounded submission
  deadline. `REST` keeps eligible unmatched lots; `IOC` cancels the remainder.
  Caller specifies minimum immediate fill (zero allowed); enforce it atomically.
- Cancel/expire only unfilled reserves; fills already onchain remain live. Replacing
  an order is cancel-confirm-refresh-create with new price-time priority.
- A wallet cannot withdraw reserved collateral through a second outstanding order.
  Allocate consumed reserves once and credit only verified surplus.
- The series pins a relative strike band in BPS as well as absolute limits. Reject
  fixed limits outside it at placement. Pegged offsets must fit the band; a rounded
  effective limit outside any bound is temporarily inactive, never clamped.

At a matching batch limit, cancel/refund the incoming unprocessed remainder even
for `REST` rather than insert a still-crossing order. Emit `match_limit_reached` as
the cancellation reason and enforce minimum immediate fill across the whole call.
`REST` only queues a remainder once no eligible crossing order exists. Count scanned
invalid/self orders toward a separate bounded work limit; never skip an eligible
better-priced maker to reach a worse one. For a selected same-owner pair cancel
the newer order's remainder with `self_trade_prevented`, subject to the placement's
atomic minimum-fill constraint. No self fill is created. Permissionless
matching of repriced resting orders has separate deterministic progress rules,
global capacity limits, and no blanket refund on batch exhaustion; see addendum §A3.

Activating a new config version permanently invalidates unfilled old-version orders,
including pegged ones; release escrow permissionlessly. Existing positions keep
their original terms and continue receiving their pinned version's oracle service.
Admin cannot use order retirement to abandon a live position's required feed.

Time-limited, round-bound orders reduce stale-price execution but cannot eliminate
information asymmetry, transaction ordering, or MEV. Explain this in advanced copy.

## 5. Oracle, fixing, and failure

Selected real-rate reference: **CBN NFEM volume-weighted rate**, not closing rate,
simple mean, or a reseller's quote. This is the addendum's proposed source selection;
exact primary publication, endpoint, field semantics, calendar, and licensing still
require verification. Demo settlement uses explicitly simulated rounds. See addendum
§A5 for provenance, shadow-feed isolation, and source-risk responses.

Each version pins source methodology, timezone/publication calendar, scheduled
observation IDs, allowed delay, challenge duration, resolution timeout, rate bounds,
and circuit-breaker policy. This is a required deployment artifact, not an API URL
chosen dynamically by the frontend. Extreme moves require review, not clamping to
an invented price. A single signer is a disclosed trust dependency.

Signed payloads bind chain ID, oracle address, market/version, sequential round ID,
observation time, validity deadline, positive scaled rate, and source content hash.
Validate authorized signer, replay protection, timestamp bounds, and sequence.
Demo rounds use distinct deployment/config and signatures. Public clients must
never hold signer keys. Finalized rounds are immutable; corrections are new rounds.

`proposed -> finalized` only after the challenge window; an authorized testnet
resolver can adjudicate a flagged/disputed observation before a bounded timeout.
Disputed/rejected rates never settle. A rejected candidate needs a valid replacement
for that scheduled observation; do not skip it or accept later rounds out of order.
Each replacement has a distinct signed candidate ID and a fresh full challenge
window without extending the observation's fixed failure deadline. A resolver may
accept/reject only before that deadline and cannot backdate finalization. Allow
permissionless evidence submission with bounded payloads/rate limits; resolver
adjudication is the trusted decision that changes the onchain disputed state.
The resolver's power, rationale, and evidence are public. This is not a trustless
dispute system; malicious signer/resolver collusion remains possible in the demo.

During pending/disputed/stale conditions, block new exposure, not cancellation,
claim withdrawals, or otherwise eligible defensive top-ups. Ordinary liquidation
at its last eligible finalized mark remains possible under section 3.5. Do not use
the disputed candidate price. A configured future-round halt does not retroactively
change finalized payouts or extend existing deadlines.

For known non-publication days, the pinned calendar identifies the prior official
observation and maximum carry-forward interval. An unexpected missing observation
is stale. Do not permit unlimited reuse of yesterday's rate.

At the series fixing time, stop new exposure and ordinary liquidation. Await the
preselected fixing observation, including its challenge window. Apply that finalized
fixing once even if it finalizes after the fixing timestamp, then release each side's
equity. No later observation can replace it. Shortfall at final fixing closes as
`defaulted` with the fixing outcome recorded.

Earlier scheduled observations finalized after maturity must still be processed in
order before the fixing, but cannot open new margin calls or revive pre-maturity
deadlines. Default still closes immediately. A pre-maturity deadline already due
before the fixing time is processed before entering this waiting state. No top-ups
are accepted in `awaiting_final_fixing`; payouts use already committed collateral.

If the required observation does not finalize before its predetermined failure
deadline, close as `oracle_closed` at the last valid settled value after processing
all earlier eligible rounds. A candidate finalized at/after failure deadline is too
late. Return current equity, not original deposits; previous transfers are not
reversed. Unfilled reserves are refunded separately. Record fallback round and
reason in receipts. This fallback limits duration but creates basis/manipulation
risk; disclose that a failed feed ends protection at an earlier mark.

## 6. User flow and disclosures

1. Explore direction, listed maturity, example outcomes, and indicative liquidity
   before login or funding. Show the public demo/testnet label.
2. Authenticate and select wallet when the user decides to trade. Preserve draft.
3. Review strike, exact fixing, order deadline, entry adjustment, total reserve,
   fee escrow/actual fee, sponsorship status, maintenance, locked-profit rule, and
   collateral-limited protection. Pegged tickets review signed offset and persistence.
4. Resolve USDC/gas shortfall; approve Vault; refresh preview; submit with enforced
   limit, round/version, submission deadline, and minimum-fill constraints.
5. Show all fills and residual order, including multiple resulting positions.
6. Monitor both margin balances, contractual versus paid PnL, pending oracle state,
   keeper delay, margin calls, and final-fixing wait. No automatic top-up promise.
7. At closure/cancellation show claimable balance and explicit withdrawal action.
   Receipt distinguishes released collateral from wallet funds received.

## 7. Three-minute demo

1. Ada and Bayo choose the same listed demo maturity and opposite sides; sign in,
   fund with test USDC/MON, and match at the current reference strike.
2. A simulated proposed rate finalizes; keeper settles and margin bars move.
3. Margin call opens; Ada explicitly approves/top-ups before the onchain deadline.
4. A second finalized move breaches maintenance; keeper liquidates after grace.
5. Receipt shows actual settlement, each remaining balance, zero reward, and a
   withdrawal to wallet. A separate scenario demonstrates a collateral shortfall.
6. Persistent label: simulated rates and test tokens; no real conversion guaranteed.

## 8. Required implementation checks and unresolved inputs

Before contracts/UI integration, implement the acceptance cases in
[the audit](./spec-audit.md). Pin test token, addresses/chain, Privy SDK/client,
source calendar, keeper monitoring, confirmation policy, bounded matching limits,
and demo timings. Calibrate margins and stress test gaps/reversals independently
of UI examples using exact inverse-value deltas and chronological oracle/keeper
events, not just percentage spot moves. Sponsorship is the intended default but
requires a verified route and bounded budget; explicitly offer self-funded gas
when unavailable, never silently charge it. Addendum §A4–A6 define these gates.

Before any real-value launch, validate demand and hedge sizing with users, verify
the reference source's availability/licensing, assess USDC and liquidation economics,
and obtain jurisdiction-specific legal review. The previous categorical claim about
Nigeria's 2025 law was not sourced here and must not be presented as verified advice.
Adding another currency requires new economic/calendar validation as well as config.

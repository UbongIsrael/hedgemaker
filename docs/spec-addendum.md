# Naira Forward — Reviewed addendum A

Revision A3, 2026-10-03. Integrates the supplied `naira-forward-spec-addendum-v2.md`
after design audit. This document and the updated [build spec](./Naira%20Forward_%20Build%20Spec.md)
are normative design requirements; the uploaded draft is input material, not
evidence of implemented or independently verified behavior. See
[addendum findings](./addendum-audit.md) for accepted changes and corrections.

## A1. Positioning and evidence

Metropolis Markets: direct hedger-to-hedger matching, with earners and importers as
the initial participant groups. Market makers are optional future participants;
absence of a requirement for them does not prove enough matching demand exists.
Show unmatched size, maturity, deadline, and “no counterparty yet.” Never synthesize
fills. Pegged orders preserve intent, not guaranteed liquidity.

Builder integrations are in scope as versioned read/preview/unsigned-transaction
surfaces. Payroll, remittance, importer-payment and wallet examples are use cases,
not partnerships or guaranteed conversion products. A daily forward does not
require subsecond blocks; lower transaction latency helps the margin loop after
oracle finalization. Report chain, oracle, keeper, wallet, and indexer timing separately.

The founder reports practical barriers to bank/FMDQ products. The
[market-access register](./evidence/market-access.md) attributes that statement and
lists missing date/sample/provider evidence. No interviews, screenshots, or source
links were included in the uploaded addendum. Do not fabricate the requested note
or call this audit independent verification of the research.

## A2. V1 scope

Adopt fixed and reference-pegged orders for all users; isolated positions; margin
calls, top-ups, liquidation/default/maturity/oracle closeout; fee accounting with
testnet waiver; intended gas sponsorship; exact health views; relative strike band;
oracle provenance and read-only real-rate shadow mode; SDK/read API/MCP design;
operator controls for the simulated deployment; verification plan.

Deferred: market-maker accounts/rebates/batch quote tools, cross-margin, delegated
placement, intraday reference, deployed gap-risk reserve, real-value launch, and
Ghana deployment. The reserve is P1, not an optional V1 promise. Ghana can illustrate
parameterization, but requires source/calendar/economic/legal validation and possibly
adapter work. Do not claim every new currency requires no code.

## A3. Reference-pegged orders

### Intent and rounding

Common fields: owner, series/version, side, whole lots, onchain sequence, validUntil,
time-in-force, and immutable fee terms. Fixed orders store limit strike and bound
round. Pegged orders store signed integer `offsetBps` and optional inclusive
`lastExecutableRoundId`. A timestamp deadline is always required and strictly before
fixing. A user-selected round count converts once at placement to this absolute
round ID; it never resets after a fill or inactive round. Cap both lifetimes.

For finalized rate R and offset b, unrounded limit is `R*(10000+b)/10000`.
Require `10000+b > 0`. On tick size q (all rates in integer raw units):

- Buyer maximum limit: `floor(Rraw*(10000+b)/(10000*q))*q`.
- Seller minimum limit: `ceil(Rraw*(10000+b)/(10000*q))*q`.

This deliberately corrects the supplied against-owner rounding. The rounded limit
must never exceed a buyer's signed maximum or fall below a seller's signed minimum.
Round the rational expression directly to the tick, avoiding double rounding.
Prices execute at a maker's effective limit and only when compatible with both limits.

Validate `abs(b) <= series.strikeBandBps`, absolute strike bounds, and the effective
relative band with exact integer cross-products:
`abs(Kraw-Rraw)*10000 <= Rraw*strikeBandBps`. If rounding breaches a bound, including
at band edges or K=0, the order is inactive this round. Do not clamp its price.
It can become active next round without losing sequence. Fills fix each position's
strike permanently; only unfilled lots continue pegging.

### Reserve proof and fee escrow

Let L be notional raw units per lot, s=+1 buyer/-1 seller. Reserve per lot is:

`initialMarginPerLot + ceil(max(0, s*L*b)/10000)`

Multiply by whole remaining lots; fee escrow is separate (A4). Rounding allowance
is **zero under the owner-protective rounding above**, because the price adjustment
can only improve that owner's payoff. Before price rounding, `V0 = -N*b/10000`;
after rounding it need not be exactly equal. Use actual execution K and finalized R
for settlement, never the approximate offset expression.

For a buyer, compatible execution K is no greater than its floored limit, so its
adverse entry mark is bounded by `N*b/10000`. For a seller, K is no less than its
ceiled limit, so its adverse mark is bounded by `-N*b/10000`. Ceiling per lot covers
any partition into whole-lot fills. The proof covers fixed/pegged combinations and
maker/taker roles. If rounding policy changes, this proof no longer applies.

At each fill allocate initial margin plus actual adverse V0, apply V0 once, return
only allocation surplus to claimable, and retain reserve/fee escrow for remaining
lots. No fresh wallet debit or allowance is needed at future matches.

### Repricing, ordering, and bounded work

Derive each effective price from the same current finalized round at read/match
time. Oracle finalization only changes the round pointer; it does not iterate over
orders. Cached frontend quotes carry their round and are never authoritative.
No trading during a newer proposal/dispute/stale feed. This makes repricing atomic
in meaning without an unbounded storage rewrite at every round.

V1 uses a hard global order capacity **per series**, plus wallet/market capacity
and per-order notional bounds. Retain inactive pegged orders in capacity counts.
Permit bounded cleanup of expired/invalidated slots; reject new placement when full.
Do not rely on per-wallet limits to stop Sybil growth.

For a bounded V1 book, scan all live slots of that series under one round, compute
prices, and select best eligible bid and ask; ties on either side use lowest sequence.
Scan cap must cover the entire global series capacity, and worst-case work across
the match-batch cap must fit a measured transaction gas budget. Never trade against
a partial scan that might miss a better-priced order. These caps are deployment
inputs; test them adversarially before allowing the book size to grow.

When best bid >= best ask, lower-sequence order is maker, higher-sequence order is
taker, and execution uses maker price. Fees follow this role even when both orders
were previously resting or a third party calls the matcher. Tick-induced ties use
sequence, not raw offset priority. A selected same-owner pair cancels the newer
order's remainder, credits its escrow, emits `self_trade_prevented`, and continues
within work limits; it cannot permanently block the book. Both intents consent to
this policy at placement.

`matchOrders(seriesId)` is permissionless and processes a bounded number of pairs.
If work is exhausted, remaining resting orders stay funded and queued; signal
`matching_pending` and permit another batch. Do not skip a pending best pair to
match an incoming order. New placement returns `MATCH_REQUIRED` until previously
crossing eligible resting pairs have been processed. Within a new placement, the
existing incoming-remainder cancellation rule at work limit still applies.

Fixed orders invalidate on a new finalized round; pegged orders do not. Both
invalidate when their version is retired; pinned position terms/oracle service
continue. Expiry/invalidation makes them non-executable immediately, but an explicit
release operation credits the remaining collateral and unearned fee escrow exactly
once. Inactive pegged orders remain cancellable and display their reason.

## A4. Protocol fees and gas sponsorship

### Fee terms and conservation

Reference price: taker **5 BPS of filled notional**, maker 0; both are placeholders.
Effective testnet fees are **0**. Show “waived on testnet,” with any reference fee
clearly separated from the actual approved pull. Never reserve a waived fee.
Fee terms are immutable per config version; no retroactive increases on resting orders.
Maker rebates/negative fees are not supported in V1.

At order placement, reserve the maximum possible taker fee for all lots, including
REST pegged orders that may be the newer side of a future resting cross. No later
unreviewed pull is allowed. Use cumulative per-order taker notional T and effective
rate f: `F(T)=ceil(T*f/10000)` in USDC raw units, with `F(0)=0`.
For a taker fill of d notional, charge `F(T+d)-F(T)` from fee escrow. This makes
splitting the same order's taker fills fee-neutral. Maker fills charge zero.
Separate orders may differ by rounding dust; disclose raw-unit rounding.

After each fill retain only `F(T+remainingNotional)-F(T)` in fee escrow; credit
surplus to the owner's claim. Cancellation/expiration/invalidation refunds all
remaining fee escrow; earned fees on already executed fills are not refunded.
Top-ups, withdrawals, sync, and liquidation do not incur protocol fees in V1.

Vault assets cover order collateral reserves, unearned fee escrow, position
collateral, user claims, and earned treasury fees **without double counting**.
Earning a fee moves value between ledgers, not out of collateral. Treasury withdrawal
requires treasury authority and is capped to the earned ledger. No claim includes
a speculative future fee or an unfunded keeper reward. Reorg rollback includes fees.

At 5 BPS, $1,000 filled notional costs $0.50 and $1M earns $500, counting each matched
notional once rather than both sides. $2,000 monthly costs requires $4M matched volume
before variable costs: this is illustrative, not demonstrated break-even. With
variable cost v per notional unit and fixed cost C, break-even is `C/(f/10000-v)`
only if the denominator is positive; include failed/unfilled sponsored operations.

Do not fund revenue by taking an undefined share of liquidation equity. Any future
liquidation reward must have a separate explicitly funded and reviewed policy.

### Entry mark is not a second fee

Display signed “Entry mark / forward-point transfer” separately from protocol fee
and refundable collateral. A positive offset generally debits the buyer and credits
the seller's locked collateral; it is not a universal fee paid by both users and
not treasury revenue. Actual amount uses tick-rounded execution, not simply N*b.

The cumulative pre-fee payoff is `V0 + sum(later deltas) = V(final)`. Never subtract
V0 again from final PnL. Forward points affect strike, entry funding and final value;
they are not an additional charge on top of that same final payoff. The spot-based
daily mark in this product is not the conventional discounted mark-to-market of a
fair forward; label the pricing guide accordingly and assess funding costs.

### Sponsorship policy

Platform-sponsored gas is the intended default, conditional on verified Privy/paymaster
support for the chosen wallet, chain and functions. Pin deployment, targets, selectors,
argument/amount/gas bounds, per-account rolling budgets, global daily budget, and
emergency breaker. A selector allowlist alone cannot constrain arbitrary multicalls.
Include exact Vault approvals, order/cancel, top-up and withdrawal paths where supported.
Validate decoded arguments, owner, spender and deployment; never sponsor arbitrary targets.

Reserve budget for protective operations such as top-ups/cancel/withdrawal, with
minimum size applying to new orders only. Apply abuse controls beyond wallet addresses,
but keep permissionless self-funded protocol access. Log sponsored failures and
per-lifecycle spend, including unmatched/cancelled orders; no-fill spam earns no fees.
Two independent keeper runners require distinct keys/RPC paths, monitoring and
idempotency, not just copies of a script. Keeper gas is platform-funded on testnet.

If sponsorship fails or a cap is reached, clearly offer retry or **explicitly
accepted** self-funded MON gas. Never silently switch payment mode. Sponsorship is
not a protocol fee, cannot guarantee indefinite free service, and cannot change
contract eligibility or deadlines. Record actual provider settings after verification.

## A5. Source, pricing, health, and verification

### Reference and provenance

Choose CBN NFEM volume-weighted daily USD/NGN as intended real-rate reference, not
closing rate, simple mean, or reseller quote. Primary verification is still required:
official table/field definition, stable HTTPS fetch endpoint, publication time and
calendar, revision handling, historical coverage, and redistribution terms. No date-
specific sample or bank-page comparison in the supplied addendum is treated as
verified here. Third-party wrappers are optional cross-checks, never settlement authority.

Observation metadata: publisher and canonical URL, observation date/time, retrieval
time, raw bytes/hash, parser version, parsed rate/units, validation outcome/reason,
and source methodology version. Archive raw bytes offchain before proposing and
bind their hash onchain. Hashing proves consistency with archived bytes, not source
authenticity; authenticated HTTPS fetch and reproducible parsing remain necessary.
Demo and read-only real shadow feeds have distinct feed IDs/domains; no shadow
round is signable into a settlement feed or used as a fallback rate.

| Risk | Detection and response | User-visible effect |
| --- | --- | --- |
| Publisher outage/late data | Calendar deadline monitor; no fabricated observation | Stale feed; matching suspended; configured fallback clock |
| Revision/format change | Schema/date/hash checks, archived revisions; quarantine and human review | Pending/unavailable data; no silent overwrite of final rounds |
| Bad parse/extreme move | Exact-unit validation, bounds and discrepancy/circuit checks | Challenge/review, not clamped synthetic price |
| Signer compromise | Key-monitor alerts, pause new exposure/proposals and rotate future authorization under documented governance | Incident status; immutable prior finalizations remain |
| Resolver collusion | Public evidence/decision log and timeout monitoring | Disclosed trust failure; finalized losses cannot be promised reversed |

### Indicative forward guide

Optional `F = S*(1+rNGN*t)/(1+rUSD*t)` is a labelled simple-rate covered-interest-
parity estimate, not executable liquidity or a guaranteed arbitrage price. Pin named
rate series, tenor matching, compounding/day-count convention, as-of dates, and
freshness thresholds. MPR, monthly indicators and overnight SOFR are not automatically
tenor-matched investable funding rates; missing suitable inputs hides the guide.
Funding access, capital controls, basis and transaction costs can invalidate the model.

Guide-derived offsets remain an editable suggestion requiring explicit user consent.
The signed BPS offset stays constant until cancel/repost even as time to maturity
shortens or guide inputs change. Never silently decay/recalculate an existing order's
offset; that would change the authorized intent. Recompute the guide only for new review.

### Margin calibration

Archive exact source/methodology, data coverage/gaps and dataset hash. Do not splice
2023 reform-era observations into a later NFEM methodology without an explicit
regime mapping; use incompatible periods as separately labelled stress scenarios.
Replay exact rounded inverse-payoff deltas, entry marks, pinned series, fees, oracle
finalization/challenge delays, deadline ordering, keeper outages and several top-up
policies, including no top-ups. Daily publication is not daily finalization by assumption.

Report calls, liquidations, exact-exhaustion defaults, shortfall distribution, failure
frequency, time locked, call-to-close latency, and out-of-sample stress results.
Calibrate to adverse equity changes during the exposure/grace window and tail gaps;
a quantile of percentage spot moves alone is insufficient for `N*(1-K/R)`.
State quantile, safety factor, assumptions and limitations. Publish reproducible
script/data manifest/results during implementation, not invented results now.

### Exact health and trigger views

With current side equity E, maintenance M and last buyer value Vl, the continuous
equality candidates supplied in the addendum are algebraically correct:

- Buyer: `c=M-E+Vl`, `R*=N*K/(N-c)`; breach is toward lower R.
- Seller: `c=E-M+Vl`, `R*=N*K/(N-c)`; breach is toward higher R.

But “no finite trigger” is ambiguous. If the buyer denominator is nonpositive,
every positive finite R breaches in the continuous model; if the seller denominator
is nonpositive, none do. A zero denominator must never become a divide-by-zero or
a reassuring dash. Valid configured domains may exclude an otherwise finite root.

Canonical view evaluates integer hypothetical equity
`E+s*(Vraw(R)-Vl)` over the allowed positive oracle raw-rate grid (one raw unit;
order tick size is unrelated). Bounded binary search of this monotonic function
finds the strict `equity < maintenance` boundary. Return `all_safe`, `all_breached`,
or adjacent `lastSafeRateRaw`/`firstBreachRateRaw` and direction; also return current
breach and exact-exhaustion/default indicators. Compute signed distance from the
snapshot reference with a documented display rounding mode. Algebra is explanatory,
not the executable boundary calculation. For active calls show initial-margin cure
amount/deadline instead; terminal, unsynced and maturity-wait states are unavailable.

A call trigger is not a liquidation price. Liquidation is deadline-driven and may
happen at the last eligible mark; a slider cannot infer it from one endpoint rate.

### Verification, roles, and finality

Contract invariants include all earlier acceptance cases plus separate fee conservation,
reserve sufficiency for every fixed/pegged maker/taker path, no double entry mark,
constant per-order cumulative fee under fill partitioning, and bounded global scans.
`sum(post-entry contractual deltas)=lastValue-V0` for solvent paths;
`entry+later paid deltas=lastValue` only before a capped default. Do not confuse them.
Fuzz discontinuities, tick/band boundaries, reactivation, expiry, partial fills,
source failures and random paths; test standard-token failures and contract-wallet owners.

| Function group | Authority and restrictions |
| --- | --- |
| Place/cancel/top-up/claim withdrawal | Owner, including contract wallets; cancel only own order; top-up own live side |
| Match/sync/settle/liquidate/expire/invalidate | Any caller; eligibility, bounded work and output recipients enforced by contracts |
| Propose rate | Authorized feed/version signer; replay/domain checks |
| Finalize | Permissionless after full challenge and any required resolver decision, before failure deadline |
| Resolve dispute | Designated resolver; evidence, timeout and immutable finalized data |
| Pause/new config/future signer policy | Explicit admin role; cannot rewrite live economics or seize claims |
| Withdraw earned fee | Treasury role; earned ledger cap only |

Require static analysis, all specified scenario tests, branch/line coverage reporting,
and no uncovered money-moving/access-control branches without documented review.
Coverage percentage alone is not evidence of correctness. Publish gas measurements
for maximum book scan, fills, sync and closure before pinning capacity. Exercise
keeper outages, censorship, collusion, ordering/MEV, freeze/blacklist and Sybil sponsor abuse.

Use a verified Monad finality signal exposed by the chosen RPC, keyed to canonical
block hash, for `confirmed`. An 800ms claim or fixed block count is not a measurement
of this integration. If the signal is absent, stall at included/unknown; do not
silently declare success. Show observed submission-to-finality separately from
oracle challenge and indexing times; retain reorg handling for abnormal cases.

## A6. Integration surfaces and roadmap

Version `IHedgeMarket` previews/actions/events and the deployment registry. Public
preview shares the exact contract math and returns scoped snapshot, reserve, fee
escrow/actual fill fees, entry mark, expiry and health; it is a view, not a fill promise.
Expose `placeOrder`, `matchOrders`, `cancelOrder`, `expireOrder`, `invalidateOrder`,
`addMargin`, `withdrawClaimable`, `syncPosition`, `settleRounds` and `liquidate` with
the roles above. No unchecked payer/recipient; no EOA-only assumptions. Keep
`placeOrderFor`, EIP-712 delegation and user-key handling outside V1.

Thin TypeScript SDK: quote, preview, buildPlaceOrder, watchPosition, getHealth. It
returns unsigned transactions and decoded intent; exact integer strings cross APIs.
REST/WebSocket expose public onchain rates, indicative guide, book and health with
pagination/cursors, rate limits, round/block/version scope, and reorg corrections.
Private identity remains behind authorization, not part of a public address query.
Opt-in margin webhooks require authenticated enrollment, destination ownership
checks, SSRF defenses, signed events, idempotency keys, bounded retry and unsubscribe;
delivery is best-effort and cannot replace onchain deadlines or in-app warnings.

MCP tools: get_reference_rate, get_indicative_forward, preview_hedge,
get_position_health; build_place_order and build_add_margin return unsigned calldata
only. A caller address is a simulation input, not authority to sign. No tool submits,
holds keys, or invokes a sponsor. Return decoded terms, target/chain, bounds and
expiration for human/policy approval; source text is untrusted. Enforce address/URL
and input bounds, trusted deployment registry, and no arbitrary RPC endpoints.
Publish semantic versions, event changes and a deprecation policy before consumers
depend on them; existing immutable deployments remain identifiable.

P1 gap reserve needs a separate reviewed allocation policy, incident definition,
aggregate exposure/budget cap, claims ordering or pro-rata fairness, replay defenses,
and accounting `assets >= allocated outstanding claims`. Per-event limits alone
cannot prevent Sybil positions draining it. Show unavailable coverage in V1; do not
publish a fictitious coverage ratio. Fee-funded future keeper rewards/rebates must
share an explicitly solvent budget. Any ratio needs a defined denominator and snapshot.

Later MM tools, cross-margin, residual-exposure management and intraday multi-source
rates need independent risk review. No public partner claims without evidence.
Real-value legal/rate licensing work remains a gate before accepting real funds.

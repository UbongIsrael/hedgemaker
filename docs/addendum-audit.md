# Addendum audit — decisions and corrections

Reviewed 2026-10-03: uploaded `naira-forward-spec-addendum-v2.md` (25,374 bytes),
against the preceding audited build and frontend specifications. “Final for merge”
in the attachment was treated as the author's draft status, not proof of correctness
or an instruction to merge/publish code. This is a design audit, not a deployed audit.

The [reviewed addendum](./spec-addendum.md), updated [build spec](./Naira%20Forward_%20Build%20Spec.md)
and [frontend specification](./frontend-flow-and-schemas.md) are the resulting design.
The original upload is preserved in the task attachment; the repo contains the
reviewed version to avoid two competing active specifications.

## Decisions accepted

Direct hedger-to-hedger launch; market makers deferred; pegged orders for all users;
separate notional-based fee ledger (5 BPS reference, effective testnet fee zero);
platform sponsorship as the intended UX; CBN NFEM as selected real-rate reference;
provenance and shadow mode; indicative pricing subject to data suitability; health
views and verification plan; unsigned SDK/API/MCP integration; contract wallets;
`matured` position outcome; operator console and four wireframes. Reserve contract,
delegated placement, intraday reference and Ghana deployment remain post-V1.

## Findings and chosen solutions

Severity reflects consequences if implemented literally, not an observed exploit.

| ID | Severity | Finding in supplied proposal / earlier spec | Chosen correction |
| --- | --- | --- | --- |
| D01 | High | Buyer rounding up and seller rounding down can breach their maximum/minimum limit; unspecified allowance leaves reserve proof incomplete. | Round buyer limit down and seller limit up directly to the tick. Inactivate if rounded price violates bounds. Adverse-offset reserve is then sufficient with zero extra rounding allowance. |
| D02 | High | “Update every order atomically” implies unbounded oracle-time work; per-account caps do not stop Sybil growth. | Derive price lazily under a single finalized round, hard-cap global series/market capacity, and measure full-scan × match-limit gas. No partial-scan best-price claims. |
| D03 | High | Two resting orders may cross after reactivation/repricing, but trigger, maker/taker identity, fees and progress are unspecified. | Permissionless bounded matcher; best bid/ask then sequence; older order maker; newer taker. Existing backlog blocks new placement bypass; resting batch exhaustion retains funded remainder. |
| D04 | High | Same-owner best pair can indefinitely block a permissionless matcher; offset ordering alone mishandles equal tick prices. | Cancel newer selected same-owner remainder under signed policy; continue bounded work. Effective-price ties use sequence, never raw offset. |
| D05 | High | Resting pegged orders can later owe a taker fee with no live wallet funds/approval. Per-fill fee ceilings can tax partitioned fills repeatedly. | Separate maximum taker fee escrow at placement; charge incremental cumulative per-order taker fee; refund only unused escrow. Waived testnet fee reserves zero. |
| D06 | High | “Fees never reduce claims” lacks complete escrow/earned-ledger accounting; suggested liquidation-proceeds revenue contradicts owner-equity release. | Count unearned/earned fees separately without double counting; treasury withdrawal capped to earned fees; no claim/collateral deductions and no liquidation-equity revenue. |
| D07 | Medium | Timestamp OR round expiry can outlive fixing or reset ambiguous round counting; new config handling is discretionary. | Mandatory bounded timestamp before fixing, optional inclusive last executable round fixed at placement; version retirement invalidates both order types while servicing old positions. |
| D08 | High | Trigger algebra omits strict inequality, integer rounding, valid domain and direction. Buyer nonpositive denominator means all breached, not safe/no trigger. | Retain algebra as explanation; exact monotonic integer search returns all-safe/all-breached/adjacent safe/breach rates. Active calls show cure-to-initial; liquidation remains deadline-based. |
| D09 | Medium | Forward points described as a fee every user pays may be subtracted again from final V; N×offset is inexact after tick rounding. | Signed entry transfer calculated from actual fill; distinguish payer and locked recipient. Entry plus later deltas already equals final value, before fees/default. |
| D10 | High | “Lock my naira value” overpromises realized payout; earlier audit also overstated a limitation of the formula itself. | Explicit ideal identity N*R−V(R)*R=N*K for USD earner, conditional on full settlement/conversion at reference. Explain fees, funding, rounding, liquidation, gap and basis risks separately. |
| D11 | Medium | Interest-parity inputs may use policy/overnight rates without tenor/convention/freshness; a constant offset might silently be recomputed as tenor shrinks. | Label optional estimate, pin suitable sources/day count/compounding/tenor, hide unsuitable inputs; suggest offset only for explicit new review, never mutate live intent. |
| D12 | High | Margin quantile rule treats spot returns like inverse-payoff collateral losses and ignores calendar/challenge/keeper paths; 2023 history may mix regimes. | Replay exact rounded deltas, deadline ordering, delayed finalization/keeper and top-up policies; separate incompatible historical methodologies and stress scenarios. No invented backtest. |
| D13 | High | Sponsored gas can fail at urgent moments; wallet caps/selector allowlists allow Sybil/argument abuse and no-fill cost drain. | Global and account budgets, bounded decoded calls, protective budget, minimum-size rules only for new orders, measured failed/unfilled costs, explicit self-pay fallback. |
| D14 | Medium | About-one-second margin loop/800ms finality stated without RPC verification; challenge/keeper latency dominates economic settlement. | Confirm only by verified canonical finality signal; unavailable signal remains pending. Measure transaction, oracle, keeper and indexing timing separately. |
| D15 | Medium | “Founder verified,” NFEM data examples, historical availability and bank-source claims lack attached primary records. | Attribute research; create evidence register with missing fields. Adopt NFEM selection but retain endpoint/calendar/methodology/licensing verification gates; no unsupported factual certification. |
| D16 | High | Raw payload hash and shadow mode alone do not establish authentic source or domain separation. | Authenticated fetch, reproducible parser metadata, quarantine/revision policy, separate feed IDs/purpose and signing domain; no shadow settlement fallback. |
| D17 | Medium | Read-only public API with webhooks/build tools lacks authorization, delivery and input boundaries; contract-wallet ownership was implicit. | Unsigned builders never submit or sponsor; scoped deployment registry, input bounds; authenticated opt-in signed webhook delivery with SSRF controls; explicit contract-wallet tests. |
| D18 | Medium | P1 per-event reserve cap alone can be drained by many positions; A8 implies reserve might be V1. | Explicitly post-V1; separate incident/aggregate budget/allocation policy before coverage promises; V1 schema reports unavailable. |
| D19 | Medium | A rate slider cannot predict path-dependent liquidation; single preview trigger cannot represent multiple fill strikes. | Separate single-next-round and path scenarios; mark call boundaries vs deadlines; return fill-specific health plus labelled hypothetical own-limit scenario. |
| D20 | Low | `expired` position outcome conflicts with order expiry; requested link repair was already resolved. | Rename positions/events to `matured`/`position_matured`; keep order `expired`; validate existing local link rather than changing the correct target. |
| D21 | Medium | Absence of a market-maker requirement is confused with assured liquidity; Ghana “config only” overstates reuse; break-even ignores variable costs. | Preserve launch model with thin-book state; parameterization is an illustration subject to adapter/risk review; count matched notional once and use net contribution margin for break-even. |

## Acceptance cases

These extend A01–A28 in the original audit. Reference calculations can run now;
contract, integration and backtest scenarios remain implementation requirements.

| ID | Case | Required result |
| --- | --- | --- |
| B01 | Offsets of both signs, non-divisible ticks, boundary rates, every maker/taker pairing | Buyer/seller limits protect signed intent; actual adverse entry mark never exceeds rounded per-lot reserve; no post-placement wallet debit. |
| B02 | Rounded peg crosses relative/absolute band; later returns inside | Inactive then active with same sequence; no clamping, exposure or fee while inactive. |
| B03 | New round with many live fixed/pegged orders | Oracle update is constant work; fixed remainder invalidates; pegs derive new prices consistently; filled position strikes do not change. |
| B04 | Repriced resting cross, equal ticks, self pair and keeper restart | Deterministic price/sequence/role; newer self order cancelled; backlog progresses without caller picking a favorable pair or bypassing priority. |
| B05 | Sybil wallets fill series/market capacity; invalid slots remain | Admission bounded globally, cleanup permissionless; full scans never exceed pinned gas capacity; no skipped better price. |
| B06 | Pegged expiry timestamp/round boundary, partial fill, version retirement | Lifetime never resets; earlier bound wins; both types permanently invalidated on retirement; existing positions continue oracle service. |
| B07 | One order taker-filled in fragments and mixed maker/taker roles | Aggregate charged fee equals cumulative formula; maximum escrow sufficient, unused part refunded, no collateral deduction. Separate-order dust may differ. |
| B08 | Testnet waiver, fee cap exceeded, cancel race, reorg, treasury reentry | Waiver pulls/reserves zero fee; cap atomic; earned fee only on canonical fills; claim/fee accounting conserved and role-limited. |
| B09 | Trigger exactly at maintenance, adjacent raw rates, roots outside domain, nonpositive denominators | Strict integer breach semantics; buyer down/seller up; all-safe vs all-breached correct; no division by zero. |
| B10 | Active call, unsynced position, maturity wait, several fills | Cure amount/deadline or unavailable state; fill-specific triggers; no invented single liquidation price. |
| B11 | Entry mark then unchanged rate then maturity; slider and fee display | V0 charged once, cumulative PnL not double-debited; identify whose entry transfer is paid/received; waived fee not subtracted. |
| B12 | Stale/mismatched interest inputs; remaining tenor changes | Guide hidden if unsuitable; existing offset unchanged; any new suggestion requires explicit consent. |
| B13 | Sponsor budget exhaustion, abuse, unsupported wallet, protective operation | No silent MON debit; retry/explicit self-pay; sponsor policy cannot seize funds or block direct contract access. |
| B14 | RPC lacks finality signal, orphaned receipt, keeper/indexer lag | Included stays distinct from confirmed; canonical reconciliation; separate timings, no fixed 800ms success assumption. |
| B15 | Malformed/revised NFEM payload or shadow-feed injection | Quarantine/replay checks; provenance retained; no shadow signature/round can settle; no invented stale rate. |
| B16 | 2023/modern methodology mix, jump/reversal, delayed oracle, no top-ups | Backtest reports coverage and regime differences; exact contract event ordering and inverse-value losses; no spot-quantile proxy alone. |
| B17 | Contract-wallet owner, MCP arbitrary target, private DID query, webhook private IP | Contract ownership supported; no unchecked payer/recipient; unsigned tools cannot submit; auth/input/SSRF controls hold. |
| B18 | Gap-reserve read on V1; multiple theoretical incident claims | V1 says unavailable, not zero-guaranteed coverage; P1 deployment blocked until aggregate allocation and solvency policy is defined. |

## Validation and outstanding evidence

The mathematical reference checker lives at `scripts/verify-spec-math.mjs` and runs
with `node scripts/verify-spec-math.mjs`. It covers rounding/reserve sufficiency,
fee partitions, integer trigger boundaries and ideal payoff identity. It is not a
contract test suite, an economic calibration, or a historical NFEM backtest.

Validation passed for all six Markdown documents (only MD013 line-length disabled),
21 local links/anchors and eight closed fences. Both schema blocks combined pass
TypeScript 5.9.3 strict checking with no emit; this does not verify SDK/ABI compatibility.
Reference checks passed: 3,714 pegged-reserve cases, 2,168 mixed match cases,
512 fee paths and 648 integer trigger cases, plus payoff/hedge identities and
counterexamples for the supplied rounding and no-finite-trigger rules.
`git diff --check` passes.

No current external CBN endpoint, Monad RPC signal, Privy sponsorship configuration,
historical dataset, interview record or production fee sustainability was verified
by this docs-only audit. Those gates stay explicit in the reviewed addendum. Nothing
was deployed, merged or published as part of this review.

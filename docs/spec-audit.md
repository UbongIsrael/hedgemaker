# Specification audit — findings, decisions, and acceptance cases

Date: 2026-10-03. Reviewed the original build spec and frontend flow/schema draft
at repository commit `cbc7f3932959f87d0f63e4222e359b5ca48acb9a`.

Scope: design correctness, financial accounting, contract/frontend boundaries,
flow completeness, and failure recovery. This is a specification audit; there is
no implementation, deployed-contract audit, economic backtest, or verified SDK
integration in this repository. Severity describes the potential consequence if
the original behavior were implemented literally, not a demonstrated live exploit.

The revised [build spec](./Naira%20Forward_%20Build%20Spec.md) and
[frontend specification](./frontend-flow-and-schemas.md) contain the chosen V1
solutions. “Resolved in spec” does not mean tested in a contract. The acceptance
matrix below must become implementation tests before release.

Revision note: the later [addendum audit](./addendum-audit.md) extends this report.
Fixed-order round invalidation remains; pegged orders now persist under the reviewed
addendum's reserve rules. V1 includes fee accounting with an effective testnet waiver.
Position maturity is named `matured`; order expiration remains `expired`. The original
validation results below describe the preceding revision, not the later feature set.

## Findings and chosen solutions

| ID | Severity | Original gap / concrete failure | Chosen solution in revised specification |
| --- | --- | --- | --- |
| F01 | Critical | Liquidation pays all remaining margin to the counterparty, exceeding contractual loss. A 40 loss on 50/50 deposits becomes a 50 loss. | Settle eligible deltas, then release each owner's own equity: 10/90. Zero liquidation reward/fee in V1. Build §3.4. |
| F02 | Critical | Insufficient collateral is disclosed but no executable close/accounting rule exists; an implementation could mint claims, go negative, or drain pooled funds. | Cap actual transfer to losing collateral; record shortfall; terminal `defaulted` even at exact exhaustion; no debt/socialization; isolate every position. Build §2–3. |
| F03 | High | Gains go to a vaguely spendable balance. Winners could withdraw collateral needed after a rate reversal. | All variation remains locked inside the position until closure. Distinguish wallet, reserved, locked, and claimable balances. Build §3.3; Frontend §2. |
| F04 | High | First mark can settle an arbitrarily large entry gap after matching with only 5% collateral. | Bind order to a round; reserve adverse entry mark in addition to initial margin; apply entry mark atomically and require both sides at initial margin afterward. Build §3.3. |
| F05 | High | Offset trade is advertised as early close; separately matched positions may have different strikes/counterparties and keep both margins/liquidation risks live. | Remove early-close action/status from V1. Opposite orders remain independent. True netting/transfer is deferred. Build §1; Frontend §5.7. |
| F06 | High | Oracle failure “returns margins” without explaining previously paid variation, enabling inconsistent refund promises. | Deterministic `oracle_closed` at last eligible settled mark; preserve past transfers; release current equity, not original deposits. Build §5. |
| F07 | High | No distinction between proposed and finalized rates; disputed data might settle irreversibly. Signatures lack domain/replay requirements. | Challenge before settlement, immutable finalized rounds, chain/contract/version-bound signatures, sequence/timestamp checks, trusted resolver and fixed timeout. Build §5. |
| F08 | High | Non-publication carry-forward and fixing date are underspecified; a stale observation or convenient later rate could determine expiry. | Pin calendar, source methodology, observation identity, carry-forward bound, exact fixing time, and failure deadline per series. Build §4–5. |
| F09 | High | Grace period lacks clock/refresh/cure rules; keepers can delay calls or extend deadlines, and a late top-up can race liquidation. | Per-side deadlines anchored to round finalization; no reset on worsening; restore initial margin to cure; deterministic historical event order and terminal checks before top-up. Build §3.4–3.5. |
| F10 | High | “Automatic” settlement lacks a liveness mechanism, bounded work, or missed-round handling. Skipping a breach round could incorrectly rescue a position. | Monitored permissionless keeper, persistent cursors, bounded sync, no skipped rounds, manual catch-up and lag warning. Matching work-limit remainder is cancelled, never left crossing. Build §3.5–4. |
| F11 | High | Matching does not define price direction, maker price, maturity compatibility, or queue rules. Tenor from local order time can produce incompatible expiries. | Buyer max/seller min limit; crossing at maker price; shared immutable maturity series; whole-lot fills and onchain price-time sequence. Build §4. |
| F12 | High | Resting order survives oracle updates without a reserve refresh; informed traders can match stale terms or consume insufficient entry reserve. | Fixed-order round-bound reserves; pending/stale/disputed feed blocks matching; new round invalidates fixed remainder. Pegged orders persist with the later addendum's proven offset reserve. Residual MEV/information risk remains. |
| F13 | High | `quoteBlockNumber` and estimated fill do not constrain execution; delayed transactions may execute an unreviewed trade. | Enforced limit, series/version/round, submit deadline, order deadline, max token pull, minimum immediate fill and REST/IOC semantics. Frontend §5.4/8. |
| F14 | High | No ownership/custody path between OrderBook, Vault, and PositionManager; optional available balance has no withdrawal design. | PositionManager alone controls accounting; Vault is spender; authenticated reserve/top-up path; claims and owner withdrawals; failed withdrawals preserve claims. Build §2. |
| F15 | High | String schemas omit units, sign rules, precision and arithmetic bounds; native MON incorrectly requires an ERC-20 address. | Six-decimal rates/notional/USDC, signed/unsigned strings with runtime bounds, signed truncation and telescoping deltas; native/ERC-20 asset union. Build §3.2; Frontend §7. |
| F16 | High | Mutable configuration can alter live risk; broad pause can prevent users defending or retrieving funds. | Versioned pinned terms; no V1 upgrades; limited admin powers; action-specific gating preserves eligible top-ups/cancellation/withdrawal. Build §2/5; Frontend §6.2. |
| F17 | High | Confirmation, indexing and canonicality are conflated. Retried unknown transactions can duplicate orders; dedup alone cannot recover reorgs. | Separate inclusion/confirmation/indexing; intent-ID uniqueness onchain; monitor replacement/SDK operation ID; rollback/replay orphaned events using block hashes. Frontend §5.4/6/9. |
| F18 | High | Wallet/chain change can use stale quote/allowance or credit the wrong account's UI; client wallet strings can expose private data. | Scope caches and async responses by deployment/chain/wallet; freeze signer context; verify DID-linked ownership and resource access server-side. Frontend §5.1/10. |
| F19 | Medium | Fully filled order routes to one position although matching can create many. Cancel race can report previously filled reserve as returned. | All-fill execution summary; two order IDs per fill; separate lot counters; pending cancellation is UI state; cancel only canonical residual lots. Frontend §5.4–5.5/7. |
| F20 | Medium | Funding precedes trade discovery; margin percent hides entry reserve; no clear route from released margin to spendable wallet cash. | Public preview before login/funding; total reserve and gas review; explicit claim and withdrawal flow. Frontend §3–5. |
| F21 | Medium | “Lock protection” / maximum-loss copy overstates an inverse, collateral-limited payoff, particularly for fixed USD income and USDC parity. | Preserve formula but define the N USD versus N*K NGN legs; show both outcomes, non-recourse loss exposure, shortfall, depeg and premature termination. Build §1/3.1. |
| F22 | Medium | Margin state cannot distinguish buyer/seller calls after reversal; PnL has no contractual/paid/shortfall distinction. | Independent call records and equity per side; canonical buyer-signed values; separate actual settlement and unpaid shortfall. Frontend §7. |
| F23 | Medium | Privy snippets are conceptual but look executable; sponsorship, funding, and provider return types are not validated. | Replace apparent implementation with explicit SDK-version integration requirements, gas fallback, and operation-ID tracking. Frontend §5.2/10. |
| F24 | Medium | Generalized auth/pause guards can trap users after terms updates; unsafe return URLs/source links and public receipt sharing are unspecified. | Gate only new exposure on terms; same-origin route allowlist; safe external links, CSRF/resource checks, explicit redacted sharing. Frontend §3/5.1/10. |
| F25 | Medium | Contract/token/admin assumptions and keeper reward source are undefined, enabling arbitrary spend, reentrancy or deductions from claims. | Standard allowlisted token, received-amount checks, bounded safe arithmetic, atomic/reentrancy-safe ledger, owner withdrawals, separately funded keeper gas. Build §2. |
| F26 | Low | Missing positions-list route, incomplete funding/withdrawal recovery, and countdown/accessibility behavior. | Add positions route, detailed recovery states, numerical margin labels, keyboard/focus and screen-reader guidance. Frontend §3/11. |
| F27 | Medium | Categorical Nigerian legal claim and “config only” expansion imply conclusions not evidenced in repo. | Mark real-value legal review and per-market economic/source/calendar validation as unresolved; remove unsupported categorical claim. Build §8. |

## Important design tradeoffs

- **No early exit:** reduces V1 scope and avoids false safety promises, but users
  must accept funds being locked until a supported terminal outcome. A future
  transfer/netting design requires separate consent, accounting and risk review.
- **Locked gains:** supports reversal settlement but reduces capital flexibility.
- **Adverse-entry reserve:** keeps an off-market strike from creating an underfunded
  position at entry, but total deposit can exceed the headline margin percentage.
- **Round-bound fixed orders:** require reposting around updates. The later addendum
  adds persistent pegged orders; neither eliminates public-mempool ordering advantages.
- **Original inverse payoff retained:** avoids silently changing the instrument;
  user interviews must validate sizing and whether this is the exposure users want.
- **Single signer + trusted dispute resolver:** acceptable as an explicit testnet
  assumption, not a claim of decentralized oracle security. A resolver can censor
  or collude; fallback cannot undo already finalized malicious prices.
- **Fixed clock deadlines:** keep historical processing deterministic; outages can
  consume a user's response window. Monitor and calibrate this before real use.
- **Claim then withdraw:** isolates payout-transfer failures from settlement, but
  adds a transaction and gas requirement. The UI must explain both steps.

## Acceptance matrix

These are required future contract/integration tests, not tests executed against
an application during this audit. Numerical reference calculations are independently
checked during documentation validation.

| ID | Scenario | Required result |
| --- | --- | --- |
| A01 | N=1,000, K=1,650; R=1,700 then 1,600 | Buyer values 29.411764 and -31.250000 USDC; second delta -60.661764; paid deltas telescope if solvent. |
| A02 | Arbitrary positive bounded rates and strikes; repeated rounds | Buyer/seller transfers cancel exactly; duplicate processing has no effect; ledger conservation holds and balances never go negative. |
| A03 | 50/50 collateral; buyer gains 40; seller call expires | Release 90 to buyer and 10 to seller; reward zero. |
| A04 | 50/50 collateral; buyer entitled to +80 or exactly +50 | +80 pays 50 with shortfall 30; +50 exhausts exactly with shortfall zero. Both close as default and release 100/0; no other funds touched. |
| A05 | Buyer first gains 40 then loses 60, before call deadline | From 90/10 to 30/70 while funds remain locked; no winner-profit withdrawal in between. |
| A06 | N=1,000, K=1,700, entry R=1,600, 5% initial | V0=-62.5; buyer contributes 112.5, seller 50; after entry balances 50/112.5; next unchanged rate transfers zero. |
| A07 | Better execution price and multiple whole-lot fills | Total required allocation never exceeds rounded reserve; only unused surplus is claimable; every fill creates its own position. |
| A08 | Zero/negative/out-of-range rate; extreme amounts; token with transfer fee | Reject safely without division by zero, overflow, missing collateral, or partial ledger mutation. |
| A09 | Round is pending, disputed, replayed, on another chain/version, or out of order | No settlement/match using candidate; signature/sequence failures reject; valid defensive actions remain possible. |
| A10 | Oracle missing after a paid +40 mark on 50/50 collateral | Close at fallback 90/10, not original 50/50; rejected candidate never influences release. |
| A11 | Scheduled holiday vs unexpected missing rate | Only pinned calendar carry-forward allowed; unexpected delay reaches stale/failure policy. |
| A12 | Fixing arrives after maturity but before failure deadline | Settle designated observation once; no later observation substituted; no ordinary post-maturity margin liquidation. |
| A13 | Recovery round finalizes exactly at an existing call deadline | Deadline wins; later recovery cannot revive the position; top-up pulls no tokens. |
| A14 | Restore maintenance but not initial; partial top-ups; both sides called | Existing call persists until initial reached; deadline never extends; earliest outstanding deadline governs. |
| A15 | Keeper skips several rounds including breach then rebound | Bounded chronological catch-up applies breach/deadline ordering; final result independent of batch size. |
| A16 | Buyer limit below seller; different series/version/token; same wallet | No incompatible/self match. Compatible cross uses maker price and deterministic priority. |
| A17 | New round invalidates a partially filled fixed order | Existing positions live; only residual reserve becomes releasable; reserve claim credited once by explicit operation. Persistent pegged orders use B03 in the addendum audit. |
| A18 | IOC no fill/partial fill; minimum fill exceeds actual; max pull exceeded; matching work limit reached | IOC/work-limit releases remainder, including REST at work limit; failed atomic constraints revert placement/transfers; no unexpected resting or crossed order. |
| A19 | Cancel races fill; cancel/repost followed by delayed old transaction | Reconcile actual remaining lots; filled positions survive; client intent uniqueness prevents duplicate placement. |
| A20 | Timeout, replaced transaction, SDK operation handle, indexer delay | Preserve unknown state and original intent; track canonical result; never automatically duplicate trade. |
| A21 | Wallet/chain switch during approval or quote fetch | Stale response ignored; new account needs a new review; old broadcast transaction remains tied to old account. |
| A22 | Reorg removes fill, settlement, or withdrawal | Roll back dependent records/claims/receipt; re-read canonical chain and reconcile; no double credit. |
| A23 | Paused trading or new disclosure version | Block new exposure; allow authorized cancellation, eligible top-up, claim withdrawal and reads. |
| A24 | Withdrawal transfer fails / reenters / repeats | Atomic failure preserves claim; reentrancy/double-withdrawal rejected; other users remain serviceable. |
| A25 | Native asset, signed PnL, huge integer, malformed address, wrong scale | Schema/runtime validation rejects invalid inputs; no floating-point money math or fake MON token address. |
| A26 | Multi-position fill and partial cancellation on mobile/screen reader | All resulting positions and residual reserve visible; urgent calls accessible; release distinct from withdrawal. |
| A27 | API user requests another DID's private data or malicious return/source URL | Authorization/link validation fails; public onchain data still not described as private. |
| A28 | Admin changes config or attempts collateral movement | Existing versioned terms unaffected; unauthorized withdrawals/retroactive economic changes fail. |

## Remaining gates

The documents now choose V1 behavior where the originals were ambiguous. Still
unresolved: margin/limit calibration, source methodology and licensing, actual
publication/dispute/failure timings, deployed addresses and standard token checks,
keeper availability, chain finality policy, Privy/funding/sponsorship compatibility,
and real-user hedge sizing. These require evidence beyond a docs-only repository.
No claim of production readiness, regulatory compliance, or implemented security
follows from this revision.

## Validation performed for this revision

- Markdownlint CLI2 0.18.1: all three documents pass with only line-length rule
  MD013 disabled to accommodate tables. No other lint rule was disabled.
- All eight local links resolve, including the acceptance-matrix anchor; all four
  fenced blocks close correctly. External reference URLs were not reverified.
- Both TypeScript schema blocks pass Node's TypeScript syntax stripping. This is
  a syntax check, not a type check against an application or SDK.
- Independent integer-arithmetic checks confirm the two payoff examples, entry
  adjustment, zero repeat mark, telescoping deltas, and 40/50/80 loss examples.
- 2,380 deterministic cases across both sides, varied rates/limits, and one to
  seven lots confirm the adverse-entry per-lot reserve covers improved execution.
  These checks validate the formulas, not an implementation or market calibration.
- `git diff --check` passes. No application/contract tests could run because this
  repository contains specifications only. A01–A28 remain implementation requirements.

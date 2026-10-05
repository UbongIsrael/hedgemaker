# HedgeMaker market-maker onboarding: opportunity, copy, and documentation

Status: **Draft for copy approval. Frontend implementation has not started.**

Branch: `copy/market-maker-onboarding`

Reviewed base: `cbea861` (`docs: approve liquidity and continuity proposal`)

Prepared: 2026-10-05

This document contains the market-maker business case, public marketing copy, proposed frontend placements, and draft Mintlify content. Sections 1–4 and 8 are internal strategy and implementation notes. Sections 5–7 contain copy for approval and later publication.

The [liquidity, continuity, and exits proposal](./liquidity-continuity-and-exits-proposal.md) is the source for the direction currently being built. Its approval commit establishes product direction; the file still identifies itself as a design proposal outside the normative build specification. Transfer and continuity capabilities below are therefore described as planned. This document proposes commercial terms for discussion; it does not establish a rebate, fee schedule, backstop commitment, or launch date.

## 1. Can market makers benefit or make money?

**Yes, the planned system offers a plausible market-making business. Today’s testnet does not offer real-money earnings.** The opportunity is to price and carry USD/NGN forward exposure, then add paid inventory-takeover and continuity services as those capabilities ship. It is not a passive deposit-and-earn product.

Three roles should anchor recruitment:

1. **Quote new hedges.** Post funded buyer and seller orders at rates that compensate for inventory risk, capital use, and operating costs. Earn trading P&L when fills and subsequent settlement produce a positive result.
2. **Take over existing exposure.** Under the planned voluntary-transfer flow, price an exiting participant’s remaining leg. Earn through the agreed takeover consideration and subsequent risk management. This is the most direct answer to “can market makers absorb positions?”
3. **Supply replacement capacity.** Under the planned default-continuity flow, accept replacement exposure or commit interim backstop capacity. Compensation would need a funded commercial agreement; the proposal does not yet specify one.

Existing contract primitives support the first role on testnet. The second and third require new contracts and defined economics. Recruiting now makes sense as a design-partner and testnet integration effort, with prospective commercial participation after the relevant capabilities and terms are available.

### What makes the offer attractive

- A focused USD/NGN instrument for users planning future dollar purchases or sales. Market makers can serve mismatched timing, size, and direction rather than wait for two hedgers to arrive together.
- Control over quoted rates, size, maturity selection, order lifetime, and fixed versus reference-pegged pricing, within protocol bounds.
- Funded orders and an auditable bilateral settlement history. Each fill has its own collateral and outcomes; a displayed aggregate need not hide a troubled leg.
- A proposed rate ladder and smaller lots that could concentrate fragmented demand and make partial fills easier to serve. The proposed $50 lot and ₦5 tick still require configuration and scenario testing.
- Planned full-leg transfers that could turn exit requests into priceable inventory opportunities.
- A planned continuity role for participants able to commit capital when ordinary matching is insufficient.
- The chance to influence integration requirements before tooling and commercial arrangements are finalized.

These are product advantages and hypotheses, not evidence of volume, profitability, or demand. There is no verified customer-flow dataset, market-maker commitment, or reserve capitalization in the reviewed material.

### Who should be approached first

Prioritize FX/OTC desks, specialist proprietary traders, and remittance or payment businesses with USD/NGN exposure, suitable funding access, and the ability to monitor collateral. Firms already managing related inventory may find the instrument more useful than a general crypto liquidity provider starting from zero.

P2P stablecoin desks may be prospects, but their exposure often follows a different exchange rate. An official-reference hedge does not eliminate parallel-market or stablecoin basis. Validate that mismatch before presenting them as a natural fit.

Firms requiring pooled liquidity, freely withdrawable gains, immediate position resale, cross-margin, high-frequency oracle marks, or guaranteed rebates will not find those features in the current deployment. The proposed transfer path may improve their fit, but should be demonstrated before capital commitments are requested.

## 2. Capability and commercial truth table

| Offering | Current evidence | Direction being built | Copy treatment |
| --- | --- | --- | --- |
| Funded two-sided quoting | `OrderBook` supports buyer/seller, fixed/pegged, resting/IOC orders and partial fills. Current UI disables writes. | Live book, rate ladder, grouped hedge summaries. | Explain the mechanism; invite integration interest, not real-money deposits. |
| Maker economics | Older selected order is maker; execution uses its effective limit; maker protocol fee is zero. Testnet taker fees are also zero. | No agreed MM reward schedule. | Trading P&L opportunity; no guaranteed spread, rebate, or yield. |
| Multi-counterparty liquidity | Each match creates a separate bilateral position. | Parent hedge view with every child’s health and outcome. | Say “serve part or all of an order,” without promising complete execution. |
| Visible depth | Static frontend demo; contract read methods exist. | Canonical live snapshots and a reorg-aware indexer. | Do not portray demo depth as available capital or customer flow. |
| Full-leg voluntary takeover | No transfer or early netting in current contracts. | Transfer requests and atomic novation preserving original terms and settled state. | Clearly labelled “planned”; application can express interest in this role. |
| Mutual close | Not implemented. | Both sides consent after settlement through a common round. | Planned; not an MM’s unilateral exit right. |
| Default replacement | Current default closes the child and records shortfall. | Replacement process, separately funded reserve, and interim risk bearer. | Planned and conditional; never promise automatic protection or funded coverage today. |
| Backstop compensation | No standby payment, takeover reward, or reserve-return distribution exists. | Commercial design needed in addition to protocol implementation. | Discuss proposed terms privately; publish only agreed and funded terms. |
| Maker SDK/API/console | Interface designs exist; no delivered MM service established by this review. | Read/preview/unsigned builders plus proposed MM tools. | Invite requirements; do not advertise an available trading API or endpoint. |
| Settlement asset | Documented Monad testnet deployment uses valueless `MockUSDC`. | Real-value asset and deployment require a separate verified release. | Keep testnet status visible beside application and integration copy. |

Sources: [contracts and deployment](./contracts.md), [reviewed addendum](./spec-addendum.md), [frontend schemas](./frontend-flow-and-schemas.md), [OrderBook](../contracts/OrderBook.sol), [PositionManager](../contracts/PositionManager.sol), and the [new proposal](./liquidity-continuity-and-exits-proposal.md).

The existing specs defer MM-specific tooling. The user’s current objective and newer proposal expand recruitment and product direction; they do not make those deferred services operational. Preserve that distinction in every public placement.

## 3. How the economics work

### 3.1 Quote-driven P&L

The buyer’s contractual value in USDC is:

```text
V(R) = N × (1 − K/R)
seller value = −V(R)
```

`N` is USD reference notional, `K` is the agreed NGN/USD strike, and `R` is the finalized reference rate. The product assumes 1 USDC = 1 USD for this calculation. Contracts use six-decimal integer amounts with rounding toward zero.

An MM buying at a lower strike and selling at a higher strike can have positive combined contractual value if both positions remain solvent and settle through the same maturity and reference. For equal notionals:

```text
MM buyer at Kb + MM seller at Ks
= N × (Ks − Kb) / R
```

This is an ideal combined payoff, not a fixed cash spread collected at execution. It varies with the final reference rate, and the two positions remain separately funded and separately exposed to defaults and margin calls. One side can fill without the other.

**Illustrative example, not a forecast:** an MM fills a $1,000 buyer leg at ₦1,645/USD against one participant and a $1,000 seller leg at ₦1,655/USD against another. Both have the same maturity. The entry reference is ₦1,650. These strikes align with the proposed ₦5 tick; $1,000 is 20 proposed $50 lots. Compatibility, bounds, counterparty funding, and actual fills remain required.

| Reference rate | MM buyer value | MM seller value | Combined pre-cost value |
| --- | ---: | ---: | ---: |
| Entry: ₦1,650 | +3.030303 | +3.030303 | +6.060606 USDC |
| Final: ₦1,600 | −28.125000 | +34.375000 | +6.250000 USDC |
| Final: ₦1,700 | +32.352941 | −26.470588 | +5.882353 USDC |

The entry gains are retained in position collateral. They are already included in final contractual value; do not add them again as extra revenue. Under the illustrative 5% initial-margin placeholder, these favorable-entry MM orders require 50 USDC collateral each before other applicable costs. Both sides still need working capital for future top-ups. The other participants fund adverse entry marks separately from their initial margin.

Even this paired illustration is not a risk-free arbitrage: margin paths differ, counterparties can fail, capital cannot move between the legs, and gains cannot be withdrawn while a position is live. For example, a sufficiently large rise can exhaust the seller leg despite gains on the buyer leg. An external hedge also carries funding, execution, and reference-basis costs.

### 3.2 Pricing takeovers under the planned transfer flow

The MM should price the remaining leg using its original notional, strike, maturity, current equity, side, oracle/config terms, settled value, and transfer round. It should quote an explicit transfer consideration, rather than silently replacing the strike with today’s reference.

If `s` is +1 for the buyer leg and −1 for the seller leg, the future contractual variation after a synchronized transfer round is:

```text
s × [V(Rfinal) − V(Rtransfer)]
```

Past settled variation is not charged again. Existing collateral is an asset backing obligations, not automatically MM revenue. The transfer design must specify which equity is acquired, which is returned to the exiting owner, and who pays each agreed amount.

An MM can be paid to accept unattractive inventory, pay to acquire attractive inventory, or combine a transfer payment with an external hedge. The economic test is:

```text
Expected net takeover result
= net transfer consideration received
  + expected remaining paid variation
  − protocol/transfer fees
  − external hedge and funding costs
  − operating costs
  − expected shortfall/basis losses
```

Use a consistent cash-flow model that includes acquired/released collateral and avoids counting collateral principal as profit. Transfer fees, consideration settlement, auction format, and equity allocation are not yet defined. The public copy should explain a priceable opportunity without implying a fixed payment.

Start with the proposal’s **full-leg transfers**. One child leg is distinct from a whole multi-fill hedge group. Partial takeovers should follow a reviewed split, rounding, and lineage design.

### 3.3 Default replacement and committed backstop capacity

There are two different capital needs:

- **Shortfall cover:** money to pay an eligible amount already unpaid under a published reserve policy.
- **Replacement capacity:** collateral and risk-bearing capital for future exposure on the preserved leg.

A market maker accepting future exposure does not automatically cover the prior shortfall. A reserve paying a shortfall does not automatically create a willing replacement. Keep both budgets, limits, and accounting separate.

Recommended commercial structure for discussion:

| Role | Possible compensation | Who must fund it | What must be agreed |
| --- | --- | --- | --- |
| Voluntary takeover bidder | Explicit transfer consideration and subsequent trading P&L | Exiting participant or another explicitly consenting payer | Quote sign, maximum cost, required collateral, settlement round, expiry, fees and equity allocation. |
| Default replacement bidder | Agreed activation/takeover consideration and subsequent trading P&L | Designated program budget or another disclosed source | Eligible exposure, selection rules, price bounds, available budget and no unpaid obligations assumed by surprise. |
| Committed interim backstop | Standby capacity payment plus defined activation terms | Separately funded program treasury/budget | Capacity, term, collateral commitment, service obligations, release delay, penalties if any, and exhaustion treatment. |
| Reserve contributor, if introduced | A separately designed return allocation | Identified funded premiums/contributions or another explicit source | Loss waterfall, withdrawal restrictions, caps and return distribution; none are specified today. |

These are recommendations, not existing entitlements. Fund MM compensation from its explicitly agreed source; do not use unrelated positions or silently reduce the healthy participant’s preserved equity. Maker status alone gives no share of treasury fees. Calling settlement or liquidation functions currently earns no protocol reward. Do not advertise a liquidation discount, bounty, or reserve APY.

### 3.4 What determines whether participation is worthwhile

```text
Net MM result
= paid trading P&L
  + agreed takeover/capacity compensation
  + external hedge P&L
  − all protocol and transaction costs
  − funding and capital costs
  − operations and integration costs
```

When modelling expected results, explicitly include capped counterparty payments, unmatched inventory, hedge slippage, basis, adverse selection, lock duration, and outages. Avoid subtracting the same realized loss again as a separate risk allowance.

The 5 BPS reference taker fee is a placeholder. Current testnet effective taker fees are zero; maker fees are zero. An MM’s order can be taker on a fill when it is the newer selected order, including a crossing between resting orders. There is no post-only order type, negative fee, or maker rebate in the current ABI.

**Commercial verdict:** quoting is plausible for a desk that can price this inverse payoff, fund isolated inventory, and manage reference basis. Voluntary takeovers give a clearer paid service for absorbing inventory. Committed default capacity needs explicit compensation and a separately funded program. Without adequate demand, hedging access, or terms that cover capital and loss risk, there is no reason to expect profitable participation simply because the protocol needs liquidity.

## 4. Integrations that would make the opportunity usable

### 4.1 First priority: a quote-and-risk integration pack

Deliver this alongside Phase A of the proposal:

1. **Canonical market data.** Publish verified deployment/config/series identifiers; executable depth by maturity and current effective strike; oracle and matching state; snapshot block and round. Supply contract reads first and reconcile any later API/indexer against them.
2. **Unsigned transaction builders and exact previews.** Return order parameters, collateral reserve, separate fee escrow, maximum approved token pull, and decoded intent. Support fixed/pegged and REST/IOC semantics without inventing new privileges.
3. **Order lifecycle support.** Track partial fills, remaining reserves, invalidation, cancellation, claim withdrawal, and requoting. Fixed orders invalidate on a new finalized round. Cancelling refunds to claimable; current claims must be withdrawn before reuse for a new order.
4. **Inventory and margin monitoring.** Show each leg’s equity, unsettled rounds, call deadline, cure amount, retained gains, and status. Aggregate by maturity and exposure, while preserving each child’s risk. Signed notifications should be best-effort additions to polling, not a guarantee of rescue.
5. **Operator reliability.** Document finality, reorg recovery, RPC/indexer outages, nonce handling, protective operations, and matching/sync bounds. Measure full-book gas before promising larger capacity.
6. **Testnet integration support.** Provide a reproducible quoting/fill/settlement/withdrawal scenario using test tokens. Sponsorship should be offered only where verified; self-funded gas remains an explicit choice.

This pack reduces integration and capital-management costs. It does not itself create profitable flow. A later MM console can make the same data usable without a bespoke bot.

### 4.2 Second priority: a voluntary inventory marketplace

Build the proposal’s Phase B with full-leg requests and acceptance first. Expose original economics, current settlement state, required funding, quoted consideration, expiry, maximum transfer cost, and ownership lineage in one reviewable payload. Decide whether requests are public auctions, targeted RFQs, or both before specifying API routes.

Acceptance must synchronize eligible rounds and atomically preserve the healthy counterparty’s economics. Recheck stale quotes and owner consent; old approvals cannot authorize changed terms. The exiting participant remains responsible until acceptance. A new opposite trade cannot be labelled a transfer or early close.

**How it can make MMs money:** provides a distinct service to price, lets firms select inventory suited to their book, and can pay them for taking a leg that another user needs to exit. Payment and profitability depend on an accepted quote and subsequent risk.

### 4.3 Third priority: a funded replacement program

Build Phase C only with separately defined reserve and backstop terms. A program needs committed interim exposure capacity during the replacement process, rather than an assumption that a willing bidder will always appear.

Publish eligibility, capacity, compensation source, activation rules, uncovered losses, exhaustion closeout, and capital-release restrictions. Budget standby/activation payments separately from customer collateral and shortfall cover. An external commercial agreement alone must not be presented as an enforced onchain guarantee.

**How it can make MMs money:** paid availability and explicitly priced activation can compensate committed capital. Price must cover correlated defaults and long-lived exposure; never frame the obligation as free inventory or assured profit.

### 4.4 Useful later improvements

| Improvement | Economic benefit | Scope boundary |
| --- | --- | --- |
| Bot templates and SDK examples | Lower onboarding and operating cost. | Planned tooling; review deployed ABI and exact arithmetic before release. |
| Explicit post-only or protected quote replacement | Better fee-role and inventory control. | New reviewed semantics; current placement can take liquidity and cancel/repost loses time priority. |
| Scoped batch quote operations | Reduce gas and management overhead. | No current native batch-placement promise; custody, ownership and atomicity need review. |
| Reuse of claimable funds after closure/cancel | Faster capital recycling. | Current implementation requires withdrawal first; ledger/custody change needs review. |
| External hedge adapters and exposure export | Reduce manual inventory reconciliation. | Hedge venue, funding access and basis must be validated; no partner or arbitrage guarantee. |
| Funded maker incentive program | May offset early integration/capital costs. | Set source, budget, qualification, caps and anti-wash-trading rules first. No rebate promise today. |

Do not make cross-margin or pooled insurance a prerequisite for initial quoting. They change risk allocation and should be assessed separately from the approved full-leg transfer direction. The current contracts are non-upgradeable: Phases B and C require a new deployment and an explicit existing-position policy.

## 5. Main marketing document — copy for approval

The following is the proposed public narrative for recruitment now. Planned features remain labelled throughout. It can become the core of `/market-makers`, a downloadable overview, or a partner discussion document after copy approval.

### Make a market for the next dollar–naira hedge.

**Bring your pricing expertise to HedgeMaker. Help users find the other side of their USD/NGN exposure, and help shape the market’s next stage.**

HedgeMaker is building a collateral-backed USD/NGN forward market on Monad. It is designed for people and businesses planning future dollar purchases or sales. Market makers can help bridge differences in when those users arrive, how much they need, and which side they take.

We’re inviting market makers, FX desks, and specialist liquidity providers to discuss integration and testnet participation. Today’s environment uses test tokens. Real-money trading is not available in the current frontend.

**Primary CTA:** Apply to be a market maker

**Secondary CTA:** Explore the market-maker guide

### Quote the exposure you want to carry.

Choose your side, size, maturity, and rate within the market’s limits. The order model supports fixed limits and reference-pegged quotes, with funded orders and partial fills. Each fill creates a separate bilateral position with its own collateral and settlement history.

An incoming order can match against several participants. You can supply part of that liquidity or take the other side of an eligible order in full, depending on your size and available funding.

Your earning opportunity comes from how you price and manage the exposure. A favorable quoted rate can contribute to trading profit, but fills, costs, funding, and collateral outcomes determine the result. Maker protocol fees are zero in the current model; there is no guaranteed rebate or yield.

### Help build a market for position takeovers.

**Planned capability**

HedgeMaker’s transfer proposal would let a participant request an exit and a willing replacement price the remaining leg. For market makers, that creates another opportunity: quote the terms on which you would absorb existing exposure.

A takeover would preserve the original notional, agreed rate, maturity, and settled history. It would carry the remaining obligations forward while keeping the other participant’s economics intact. Compensation would depend on the accepted transfer terms and the risk you take on.

We’re looking for desks that want to help shape this flow, including the information they need to price a leg, the collateral they require, and the integration tools they would use.

### Discuss committed replacement capacity.

**Planned capability, subject to funding and agreed limits**

Counterparty default can leave both unpaid amounts and future exposure to address. HedgeMaker’s continuity proposal separates those needs: a reserve for eligible shortfalls, and funded replacement or backstop capacity for the remaining leg.

Firms able to commit capacity can discuss a future role in that program. Standby obligations, activation pricing, compensation, and coverage limits would need to be agreed before participation. A funded commitment is required to support continuity; ordinary matching alone cannot guarantee it.

### Know the market you are entering.

HedgeMaker settles gains and losses in the configured settlement token against a reference exchange rate. It does not deliver dollars or naira. The instrument’s reference may differ from the rate at which you convert or hedge elsewhere.

Positions require ongoing collateral monitoring. Gains remain locked until closure. Different legs have independent margin requirements, and an opposite position does not release the first leg’s collateral. Counterparty shortfalls, oracle delays, token issues, and chain outages can affect outcomes.

The current deployment is on Monad testnet using tokens with no real-world value. Transfers, replacement auctions, and funded backstop services are planned features. Participation today is about evaluating the instrument and helping build the integration, not earning real-money returns.

### Build the integration with us.

Tell us which maturities and sizes you could support, how you would price USD/NGN exposure, and whether you are interested in quoting, voluntary takeovers, or committed replacement capacity.

We want to understand your market-data, order-management, collateral, and reporting requirements. Those discussions will help shape the integration tooling and commercial terms as the planned capabilities are developed.

**CTA:** Apply to be a market maker

**Supporting line:** Register interest in testnet integration and future participation. Applications do not commit capital or guarantee program access.

### Short outreach version

**Subject:** Help build USD/NGN liquidity on HedgeMaker

HedgeMaker is building a collateral-backed USD/NGN forward market on Monad for users planning future dollar purchases or sales. We’re looking for market makers and FX desks interested in quoting the other side of that exposure.

The model supports funded fixed and reference-pegged orders with partial fills. The next phases are planned to add voluntary full-leg takeovers and funded default-replacement capacity, creating further roles for firms able to price and carry inventory.

We’d like to understand which sizes and maturities fit your book, what you need to integrate, and what terms would make participation worthwhile. The current environment is testnet with valueless tokens; this is an invitation to evaluate the instrument and discuss future participation.

If this fits your desk, let’s arrange an integration discussion.

Editorial note: use only after a real sender/contact destination exists. No outreach is sent as part of this task.

## 6. Frontend proposal and exact placement copy

Recommend **a dedicated `/market-makers` page plus a compact home section**, with contextual links in the market, education, and footer. The dedicated page gives professional participants the economics and integration context they need without enlarging the consumer ticket.

All placements below are proposed. This branch changes documentation only.

### 6.1 Home section

Location: `src/pages/LandingPage.tsx`, after “How it works” and before the final testnet callout. Preserve the existing consumer hero.

| ID | Element | Copy |
| --- | --- | --- |
| MM-H01 | Eyebrow | For market makers |
| MM-H02 | Heading | Are you a market maker? Help shape USD/NGN liquidity. |
| MM-H03 | Body | Quote the other side of future dollar purchases and sales. We’re inviting market makers and FX desks to explore testnet integration and help shape planned position takeovers and replacement capacity. |
| MM-H04 | Primary button | Explore market making |
| MM-H05 | Supporting line | Testnet today. Takeovers and replacement services are planned. |

Button destination: `/market-makers`. Use “market maker” in public discovery; the abbreviated “MM” is suitable inside professional documentation after definition.

### 6.2 Dedicated page

Use the narrative in Section 5 with these page elements:

| ID | Element | Copy / behavior |
| --- | --- | --- |
| MM-P01 | Page title | Market makers — HedgeMaker |
| MM-P02 | Hero eyebrow | For market makers and FX desks |
| MM-P03 | H1 | Make a market for the next dollar–naira hedge. |
| MM-P04 | Hero lead | Bring your pricing expertise to HedgeMaker. Help users find the other side of their USD/NGN exposure, and help shape the market’s next stage. |
| MM-P05 | Primary CTA | Apply to be a market maker |
| MM-P06 | Secondary CTA | Explore the market-maker guide |
| MM-P07 | Visible status | Now inviting integration interest. Current environment: testnet with valueless tokens. |
| MM-P08 | Quote card heading | Quote new hedges |
| MM-P09 | Quote card body | Set funded buyer or seller quotes for the sizes and maturities that fit your book. Trading results depend on your pricing, costs, and collateral outcomes. |
| MM-P10 | Transfer card heading | Price position takeovers |
| MM-P11 | Transfer card body | Planned: quote the terms on which you would take over a participant’s remaining leg while preserving the original hedge terms. |
| MM-P12 | Capacity card heading | Discuss replacement capacity |
| MM-P13 | Capacity card body | Planned: help carry remaining exposure after default under a separately funded program with agreed compensation and limits. |
| MM-P14 | Economics heading | How participation can earn |
| MM-P15 | Economics body | Quoted rates can contribute to trading P&L. Planned takeovers and committed capacity could add separately agreed compensation. No profit, rebate, or yield is guaranteed. |
| MM-P16 | Integration heading | Tell us what your desk needs |
| MM-P17 | Integration body | Share your quoting scope, inventory limits, collateral requirements, and preferred integration workflow. Help us shape the market data and tools you would need to participate. |
| MM-P18 | Form heading | Apply to be a market maker |
| MM-P19 | Form introduction | Tell us about your desk and the role you want to explore. This application registers interest; it does not open a trading account or commit capital. |
| MM-P20 | Form submit button | Submit market-maker interest |
| MM-P21 | Successful receipt | Your interest has been received. We’ll contact you using the details you provided. |
| MM-P22 | Submission error | We couldn’t submit your interest. Your details are still here. Please try again. |
| MM-P23 | Risk-link label | Read market-maker risks |
| MM-P24 | Search description | Explore market-making opportunities in HedgeMaker’s USD/NGN forward market, including quoting, planned position takeovers, and future replacement capacity. Testnet today. |

Below the opportunity cards, show the “Know the market you are entering” text from Section 5 and link to the earnings/risk documentation. Repeat the planned labels beside transfer and capacity descriptions; a notice only at the top is insufficient.

### 6.3 Application fields and destination

Proposed form fields:

- Name, organization/desk, role, and work email.
- Country or operating regions.
- Roles of interest: quote new hedges; planned voluntary takeovers; planned replacement/backstop capacity.
- USD/NGN experience and relevant hedge/funding access, in free text.
- Indicative sizes, maturities, and capacity range; optional and explicitly nonbinding.
- Preferred integration: direct contracts; future SDK/API; future console; discussion needed.
- Optional requirements or questions.

Required consent wording: **“You may contact me about this application and market-maker participation.”** Link an approved privacy notice. Any broader marketing subscription needs a separate optional choice. Do not collect private keys, seed phrases, or funded-wallet credentials.

The primary CTA should scroll to `/market-makers#apply`. Build a real submission destination before enabling the form. Submission success must follow confirmed receipt, not a local animation. The secondary docs link should point to a published market-maker guide when it exists; before that, provide the guide on the page or as a repository document link with clear labelling. Do not create a dead Mintlify URL or invent a contact email.

If the receiving service/contact route is not ready when the approved page is built, publish the informational page with a verified contact alternative. Do not ship an enabled form that discards applications. Normal Privy sign-in is not a market-maker application or grant of trading permissions.

### 6.4 Other placements

| ID | Surface and implementation location | Proposed copy | Destination / condition |
| --- | --- | --- | --- |
| MM-N01 | Public desktop/mobile navigation, `src/app/AppShell.tsx` | For market makers | `/market-makers` |
| MM-F01 | Shared footer, `src/app/AppShell.tsx` | Market makers | `/market-makers` |
| MM-M01 | Small secondary panel below market depth, `src/pages/MarketPage.tsx` | Provide USD/NGN liquidity. Explore market making and the planned position-takeover flow. | Link label “For market makers”; `/market-makers`. Keep it outside trade approval controls. |
| MM-M02 | Future genuine no-counterparty state | Interested in supplying liquidity? Explore market making. | `/market-makers`; do not imply applying fills the pending order. |
| MM-L01 | End of “How it works,” `src/pages/LearnPage.tsx` | Market makers can help bridge differences in timing, size, and direction. Explore quoting and the planned takeover model. | Link label “Explore market making”; `/market-makers`. |
| MM-R01 | Risks page, `src/pages/TermsPage.tsx` | Planning to quote or take over exposure? Review market-maker capital, basis, and settlement risks. | Approved MM risk guide or `/market-makers#risks`; planned takeover qualification remains visible. |
| MM-D01 | Future Mintlify overview | Market makers: understand quoting, inventory risk, planned takeovers, and future replacement capacity. | Documentation group described below. |

No promotional modal is needed during top-up, liquidation, or withdrawal flows. Add takeover or replacement prompts inside position screens only when those functions are actually supported for that deployment. A mock “absorb position” button would create the wrong expectation.

## 7. Proposed Mintlify market-maker documentation

This is content and information architecture for approval, not a Mintlify setup in this branch. Extend the ten-topic documentation plan in the liquidity proposal with a **Market makers** group and cross-links to orders, collateral, exits, default coverage, oracle methodology, verified deployments, and developer schemas.

Suggested repository pages after approval:

```text
market-makers/overview.mdx
market-makers/earnings-and-pricing.mdx
market-makers/testnet-quickstart.mdx
market-makers/quoting.mdx
market-makers/inventory-and-margin.mdx
market-makers/position-takeovers.mdx
market-makers/replacement-and-backstop.mdx
market-makers/integration.mdx
market-makers/risks-and-faq.mdx
```

These are proposed documentation slugs. Do not advertise them as published endpoints. Keep repository Markdown as the reviewed source; when Mintlify is created, derive page content from approved text and pin it to the release/deployment it describes.

### 7.1 Overview — draft page text

**Title: Market making on HedgeMaker**

HedgeMaker is building a collateral-backed USD/NGN forward market. A market maker (MM) supplies funded quotes and takes the other side of eligible orders. Each fill creates a bilateral position with its own collateral and settlement history.

The current deployment is on Monad testnet using valueless test tokens. The frontend is a demo and does not enable protocol trading. Direct contract integration requires verified configuration, listed series, oracle schedules, permissions, and deployment information.

There are three participation roles: quoting new hedges; planned voluntary full-leg takeovers; and planned funded replacement/backstop capacity. Only the first role has current trading-contract primitives. The others require new contracts and published participation terms.

Start with earnings and pricing, then review quoting, inventory and margin, and the testnet integration steps. Express interest through the market-maker application when available.

**Release metadata:** show chain, deployment ID, protocol/config version, last review date, and availability labels. A newer frontend release must not imply that an older deployed contract supports transfers.

### 7.2 Earnings and pricing — draft page text

**Title: How market makers can earn**

Market makers seek trading profit by quoting rates that compensate for exposure, funding, and operating costs. HedgeMaker does not pay a passive liquidity yield. Maker protocol fees are zero in the current model, with no negative fees or rebate program. Effective testnet taker fees are also zero; real-value economics must be read from the applicable configuration.

The buyer payoff is `N × (1 − K/R)`; the seller payoff is its negative. A positive entry mark is retained in collateral. Entry mark plus later contractual variation equals final contractual value on a fully paid path. Do not add the entry mark a second time when calculating profit.

Two opposite positions may reduce some economic exposure, but they remain independently margined. Profitable fills cannot guarantee funding for a losing leg, and collateral is not automatically netted. Compare strategy results after protocol fees, gas, hedging, funding, basis, and capped counterparty payments.

Planned takeovers would add an explicitly priced transfer consideration. A future backstop program could compensate committed capacity under separately agreed terms. Neither payment exists in the current deployment.

Include the worked example in Section 3.1, its assumptions, and the takeover cash-flow explanation in Section 3.2. Explain that the indicative covered-interest-parity guide in the addendum is not the instrument’s contractual mark or guaranteed investable arbitrage.

### 7.3 Testnet quickstart — draft page text

**Title: Evaluate quoting on testnet**

Use this sequence for direct contract evaluation once the selected deployment is initialized. Test tokens have no real-world value. The current consumer frontend cannot place these orders.

1. Read the verified deployment manifest and ABIs. Confirm chain ID, token address/decimals, OrderBook, Vault, PositionManager, MarketConfig, and RateOracle. The documented testnet target is Monad `10143`; recheck the current manifest before use.
2. Read the active configuration and selected series. Confirm lot/tick sizes, strike bounds, capacities, fees, margin requirements, fixing round/time, and oracle failure deadline. Proposed $50/₦5 settings are not a substitute for these reads.
3. Confirm trading is open and read the latest finalized round. A stale, proposed/disputed, paused, or unavailable feed may block matching. Wait for eligible canonical state rather than inserting a fallback rate.
4. Obtain the configured test token through its supported faucet flow and check gas availability. Do not send real USDC to a test-token address. Sponsorship is not assumed.
5. Compute the order reserve and separate fee escrow with exact integer arithmetic. Review total maximum pull and approve the **CollateralVault**, which is the ERC-20 spender.
6. Submit `OrderBook.placeOrder` from the owning wallet with a unique nonzero intent ID, reviewed deadlines, size, bounds, and time-in-force. A direct contract call is a transaction, not an unsigned API preview.
7. Reconcile the receipt and canonical order/position reads. No fill means no position. Partial fills may create several independent positions; track each one.
8. Monitor settlement and margin. Exercise top-up and bounded synchronization before testing maturity/terminal closure and `withdrawClaimable`.
9. Test cancellation and invalidation. Confirm remaining collateral is credited to claimable and withdrawn separately before reuse.

Before publication, add a runnable example using the verified exported ABI and initialized series IDs. Do not invent a funded wallet, use fixture IDs as real series, or claim these steps were executed against a live network during this copy task.

### 7.4 Quoting — draft page text

**Title: Quote mechanics and controls**

Buyer limits are maximum strikes; seller limits are minimum strikes. Compatible prices cross when the best eligible buyer limit is at least the best eligible seller limit. The selected older order is maker, and execution uses that maker’s effective price. Price ties use onchain sequence.

Fixed orders bind to one finalized round. A later finalized round invalidates their unfilled remainder. Pegged orders store a signed BPS offset and follow the reference for unfilled lots, subject to expiry, round lifetime, absolute bounds, and strike bands. Every filled position keeps its execution strike.

Tick rounding protects the owner: buyer effective limits round down, seller effective limits round up. With the proposed ₦5 tick and a ₦1,572 reference, zero-offset buyer and seller orders become ₦1,570 and ₦1,575 respectively; they do not cross. Persistent pegging does not manufacture liquidity.

REST permits an eligible remainder to rest; IOC cancels the remainder. A minimum immediate fill can cause the entire placement transaction to revert if unmet. Placement can take liquidity; there is no current post-only flag. A selected same-owner crossing cancels the newer remainder under self-trade prevention.

Matching is bounded. An already-crossed book may require `matchOrders` before another placement; an incoming remainder can be cancelled when the matching limit is reached. Quoting software must handle pending matching, partial fills, capacity limits, and stale-round failures explicitly.

Include an order-field table sourced from `OrderBook.PlaceOrderParams`, especially `intentId`, `seriesId`, `lots`, `minimumImmediateFillLots`, `validUntil`, `submitBy`, `boundRoundId`, `lastExecutableRoundId`, `limitStrikeRaw`, `offsetBps`, and `maxTokenPullRaw`. Explain mode-specific fields from the ABI instead of presenting an invented REST API.

### 7.5 Inventory and margin — draft page text

**Title: Manage inventory and working capital**

Every filled child position has separate collateral. Grouped hedge views help summarize fills, but they must still show each leg’s equity, reference round, unpaid shortfall, margin call, and outcome.

Variation follows finalized rounds in order and requires submitted transactions. Gains stay locked until closure. Calls are deadline-based and top-ups require owner authorization. Restore the applicable cure amount before the deadline; a price estimate is not a promise of available time.

Keep separate balances for wallet funds, order reserves, locked position collateral, and claimable funds. Current claims cannot directly fund new orders: withdraw them first. An opposite position opens another obligation; it does not close or net an existing one.

Test inventory under one-sided fills, large reference gaps, no-top-up paths, external-hedge basis changes, oracle outages, and delayed keepers. The 5%/2.5% demo margin values are placeholders, not a real-value calibration or universal working-capital requirement.

### 7.6 Position takeovers — draft page text

**Title: Planned full-leg position takeovers**

Availability: planned; unsupported by the current deployment.

The proposed transfer flow lets an exiting participant request a replacement for an entire remaining leg. Until a replacement accepts, the original owner continues to carry its margin duties.

A market maker would review original notional, strike, maturity, side, config/oracle terms, current equity, settled round/value, required collateral, transfer consideration, fees, expiry, and lineage. Acceptance would synchronize eligible rounds and replace ownership atomically while preserving the other participant’s equity and original economics.

The transfer reference helps synchronize and price the transaction. It does not reset the strike, erase old losses, or charge settled intervals again. Opening an opposite trade is not a takeover. Partial-leg transfers are outside the recommended first version.

Transfer pricing, equity allocation, acceptance API, quote signing, and consideration settlement remain design work. Publish a worked before/after ledger and verified acceptance ABI before enabling integrations. Do not document a fictional `acceptTransfer` function as if it exists.

### 7.7 Replacement and backstop — draft page text

**Title: Planned replacement capacity and coverage limits**

Availability: planned; no funded program is established by the current documentation.

Default continuity requires shortfall cover and someone funded to carry future exposure. The proposal separates a reserve for eligible unpaid losses from a replacement/backstop capacity ledger.

A future program must state who can participate, how collateral is committed, what exposure can be activated, how participants are selected and compensated, how long capital stays committed, and what happens when capacity is exhausted. A bidder must explicitly accept the preserved leg and any agreed payment; participation cannot impose undisclosed past shortfalls.

During a replacement process, a precommitted interim risk bearer is necessary for any continuity claim. If funded capacity is unavailable or exhausted, the disclosed capped closeout applies. Reserve coverage remains limited by its actual funded policy and available resources.

Publish separate balances and utilization for shortfall cover and exposure capacity, with timestamps and enforceable limits. Ordinary maker orders, an intention to fund later, or an application form are not evidence of a funded guarantee.

### 7.8 Integration — draft page text and reference table

**Title: Integrate with verified contracts**

Use deployed contracts and their versioned configuration as the authority for eligibility, settlement, and custody. A future SDK, read API, indexer, or console should expose the same canonical state and exact arithmetic. An unsigned builder prepares a reviewed intent; it does not obtain ownership rights or submit a transaction on the user’s behalf.

| Current surface | Purpose | Integration note |
| --- | --- | --- |
| `MarketConfig.activeVersion`, `getConfig`, `getSeries`, `isVersionActive` | Discover applicable terms. | Discover listed series through verified manifests/events; do not assume fixture IDs are listed. |
| `OrderBook.activeOrderIds`, `getOrder`, `previewEffectiveLimit` | Read the bounded live series book. | Snapshot all dependent reads at one block; apply global trading/feed state and exclude non-executable size. |
| `RateOracle.latestFinalizedRound`, `finalizedRound`, `scheduledRound`, `isTradingOpen` | Read reference and availability. | Separate observation time, finalization, failure deadlines and stale state. |
| `OrderBook.placeOrder`, `cancelOrder` | Owner order lifecycle. | Vault is spender; unique intent and max pull constrain submission. |
| `OrderBook.matchOrders`, `expireOrder`, `invalidateOrder` | Permissionless bounded maintenance. | Caller receives no automatic reward. Eligibility still enforced onchain. |
| `PositionManager.getPosition`, `syncPosition`, `settleRounds` | Position and settlement state. | Bound work by config and repeat until caught up; never skip required earlier rounds. |
| `PositionManager.addMargin`, `liquidate` | Margin and eligible closure. | Top-up is owner-only; liquidation is permissionless when eligible, with no MM discount or bounty. |
| `CollateralVault.claimable`, `orderLedger`, `positionLedger`, `withdrawClaimable` | Accounting and owner withdrawal. | Closure/cancellation credits claims; withdrawal is a separate operation. |

Relevant lifecycle events include `OrderPlaced`, `OrderFilled`, `OrderClosed`, `MatchingPending`, `PositionCreated`, `RoundSettled`, `MarginCallUpdated`, `MarginAdded`, `PositionClosed`, and `ClaimWithdrawn`. Version event schemas from exported ABIs.

Each bilateral fill emits two `OrderFilled` logs for the two orders. Index it as one matched notional using deployment, transaction/log identities, and shared position ID; maintain the two account perspectives without doubling market volume. Handle removed/reorganized logs and reconcile positions and ledgers with canonical reads.

Proposed future data objects: existing `HedgeGroupView`, executable-depth snapshot, MM inventory view, full-leg transfer quote/request, and backstop-capacity view. Keep snapshot block, config version, oracle round, freshness, and availability explicit. No API routes, credentials, rate limits, websocket feed, MM SDK release, or service SLA are established in this draft.

### 7.9 Risks and FAQ — draft page text

**Can I earn real money today?**

No. The documented deployment uses valueless test tokens, and the current frontend disables protocol writes. Future real-value trading and program compensation require their own verified deployment and published terms.

**Do I earn yield by depositing liquidity?**

No passive liquidity pool exists. You fund orders, carry bilateral exposure, and manage collateral. The opportunity is trading P&L and, if introduced, separately agreed service compensation.

**Will I always be maker?**

No. The selected older order is maker per fill. A newly placed quote can execute as taker, and there is no current post-only option.

**Can I absorb someone’s existing position?**

That is the planned full-leg transfer role. Current contracts do not support it. The proposal preserves original economics and settled state when a replacement accepts.

**Can I withdraw profitable variation or net opposite legs?**

Profits remain locked while a position is live. Current positions are isolated, with no contractual netting or unilateral early close.

**Do I take over a defaulting participant’s unpaid debt automatically?**

No such takeover exists today. The planned process separates eligible past shortfall coverage from future exposure and requires explicit acceptance of replacement terms. The final policy must state any additional obligations.

**Does funded collateral guarantee payment?**

No. A gap can exceed available collateral, producing capped payment and recorded shortfall. Reserve/backstop coverage, if introduced, would also have defined limits.

**Can I hedge on another FX or stablecoin venue?**

Possibly, if you have access and funding. Rate methodology, tenor, settlement timing, token value, costs, and conversion restrictions can leave substantial basis. No hedge partner or arbitrage route is promised.

**What can interrupt trading or settlement?**

Oracle proposals/disputes, stale feeds, chain or token failures, paused new risk, delayed keepers, configuration retirement, and capacity limits can affect operations. Existing positions retain pinned terms, and maintenance requires submitted transactions.

**Do settlement or liquidation calls pay rewards?**

Current testnet rewards are zero. Treasury trading fees are not automatically distributed to market makers or keepers.

**What does applying commit me to?**

An application registers interest in integration and possible future participation. It does not deposit funds, open a trading account, grant protocol authority, or commit the applicant to carrying default exposure.

## 8. Onboarding plan and approval boundary

### Recruit through evidence and a limited pilot

After the copy is approved, build the informational page, home section, navigation/footer links, and contextual market/education placements together. Route interested firms into a real contact/application workflow, then use a structured discussion to establish:

- Their USD/NGN pricing model, hedge access, and reference-basis tolerance.
- Sizes, maturities, one-sided inventory limits, and maximum capital lock duration.
- Top-up operations, keeper assumptions, monitoring and incident coverage.
- Read/preview/signing requirements and contract-wallet support.
- Whether they want new-order quoting, voluntary takeovers, committed capacity, or several roles.
- What compensation and funded commitment would make each role worthwhile.

Follow with a limited testnet exercise showing multi-counterparty fills, separate margin, adverse reference moves, cancellation/claims, and withdrawals. Demonstrate takeover and replacement paths only after their contracts exist. Validate strategy economics using exact settlement paths and realistic funding/hedge costs; do not convert hypothetical results into marketing performance claims.

Track application receipt, qualified conversations, completed integrations, executable depth by maturity, unique matched notional, one-sided inventory, locked capital duration, calls/defaults/shortfalls, takeover acceptance/costs after release, and actual committed capacity. Report demo/testnet activity separately from real-value flow. Keep applications and sensitive operational records out of public analytics.

### Claims that must wait for verified evidence

| Proposed claim | Evidence needed before publication |
| --- | --- |
| “Earn maker rebates” or a quoted capacity payment | Agreed funded terms, eligibility, budget and payment mechanism. |
| “Absorb existing positions” as an available action | Verified transfer deployment, before/after ledger behavior and supported UI/integration. |
| “Continuous protection after default” | Funded shortfall policy plus committed interim/future capacity, enforceable limits and demonstrated exhaustion path. |
| “Live executable liquidity” | Canonical current book and feed/config state, not fixtures or inactive orders. |
| “Profitable market making” or any return figure | Actual attributable results, all costs and capital exposure, with relevant assumptions and limitations. |
| “Production API,” “sponsored gas,” or named partners | Delivered integration and verified availability/relationship. |

### Review requested

Approve or revise the public narrative in Section 5, the exact frontend copy and placements in Section 6, and the Mintlify draft in Section 7. Commercial structures in Sections 3–4 are recommendations for later design, not terms an applicant can rely on.

This change adds one Markdown document only. Frontend implementation follows copy approval on a branch. No page, form, contract change, outreach message, deployment, or merge is performed by this document change.

## 9. Source map

| Source | What it establishes |
| --- | --- |
| [Liquidity, continuity, and exits proposal](./liquidity-continuity-and-exits-proposal.md), §§1–3 | Bilateral multi-fills, proposed $50 lot/₦5 tick, ladder, live-book/indexer and grouped view. |
| Same proposal, §§4–6 | Default replacement, preserved economics, separate reserve/capacity, voluntary full-leg transfers, phased delivery and new-deployment requirement. |
| Same proposal, §§7–8 | Mintlify outline and remaining economic/configuration decisions. |
| [Build spec](./Naira%20Forward_%20Build%20Spec.md), §§1–3 | Inverse payoff, isolation, collateral limits, claim/withdrawal model, no current transfer/netting. |
| [Reviewed addendum](./spec-addendum.md), §§A2–A6 | Deferred MM tooling, fixed/pegged semantics, maker/taker fees, no rebates/rewards, source/basis and integration design. |
| [Contract/deployment documentation](./contracts.md) | Documented Monad testnet deployment, valueless test token and initialization prerequisites. |
| [OrderBook implementation](../contracts/OrderBook.sol) | Actual quote fields, price-time/maker-price execution, partial fills, ownership, bounds and order maintenance. |
| [PositionManager implementation](../contracts/PositionManager.sol), [Vault](../contracts/CollateralVault.sol), [ForwardMath](../contracts/libraries/ForwardMath.sol) | Exact entry/variation, isolated collateral, owner top-ups, capped default, terminal release and withdrawals. |
| [Frontend schemas](./frontend-flow-and-schemas.md), [README](../README.md), [current routes](../src/app/App.tsx) | Designed integration surfaces, current demo/write boundary and absence of an MM page. |
| [Approved consumer copy](./consumer-copy-revisions.md), [home](../src/pages/LandingPage.tsx), [shell](../src/app/AppShell.tsx) | Existing consumer language and placements to preserve while adding MM content after approval. |

This is a repository-based review, not a live deployment verification, independent market study, profit backtest, or confirmation of a funded reserve.

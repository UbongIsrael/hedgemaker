# HedgeMaker frontend copy — approval review

Status: **Approved by the user and implemented.** Branch: `copy/consumer-facing`. Source: `cbb628d`.

This review records **221 approved copy changes or removals** across all nine frontend screen types, shared UI, sample activity, and browser metadata. Each table preserves the original text and the approved replacement, all now implemented in the frontend.

The proposed voice is clear, direct, and written for people managing dollar–naira rate changes. Developer setup instructions, internal project/version labels, and documentation links are removed or replaced with the consequence that matters to the customer. Necessary financial terms are explained. Demo status, payout limits, locked funds, and unavailable actions stay clear.

## Approved scope

| Screen or shared area | Route | Approved items |
| --- | --- | ---: |
| Home | `/` | 28 |
| Market and order review | `/market` | 45 |
| How it works | `/learn` | 13 |
| Risks | `/terms` | 14 |
| Account overview | `/app` | 28 |
| Wallet | `/app/wallet` | 25 |
| Positions | `/app/positions` | 17 |
| Position details and missing-position state | `/app/positions/:positionId` | 23 |
| Page not found | Unmatched routes | 2 |
| Shared navigation, banners, sign-in, footer, and accessible indicators | All screens | 12 |
| Shared sample data and activity | Market and account screens | 12 |
| Browser title and search description | All screens | 2 |
| **Total** | | **221** |

The user approved the full list. All approved changes have been implemented on this branch for review and merge. Row IDs remain available to trace each implementation back to its approval.

Line numbers refer to the current source. `{…}` indicates a value inserted by the application; numeric values and calculation behavior stay unchanged. `<br />` indicates a displayed line break. A slash between current strings identifies separate pieces of text in the same UI element. Repeated strings are grouped when the same replacement applies. Lists beneath each table record suitable copy reviewed and left as written. Engineering exceptions that do not reach a screen are outside this consumer copy list.

The proposed removals are the footer GitHub link (S08), generic leftover health-indicator text (S12), internal rate-update number (D12), token configuration row (W22), and Wallet developer documentation link (W26). M19 also removes the crossed-out hypothetical fee reference while stating the demo trading fee clearly. The calculation example on How it works remains useful product education, with clearer labels.

## Shared navigation, sign-in, banners, and footer

Source: `src/app/AppShell.tsx` unless stated otherwise. These changes apply across every screen.

| ID | Source line / location | Current copy | Proposed copy or action |
| --- | --- | --- | --- |
| S01 | 35 · environment banner | Monad testnet preview | Demo mode |
| S02 | 37 · environment banner | Simulated reference rate | Sample exchange rates |
| S03 | 38 · environment banner | No real funds or conversion | No real money or currency exchange |
| S04 | 72 · signed-in header link | Dashboard | Overview |
| S05 | 75 · wallet loading state | Wallet loading | Loading wallet… |
| S06 | 89 · local-preview notice | Local preview. Add the verified Privy and Monad values from .env.example to enable real authentication. Protocol writes remain disabled. | You're exploring a demo with sample data. Trading, deposits, and withdrawals are unavailable. |
| S07 | 103 · footer description | Collateral-limited USD/NGN protection for direct hedgers. | Explore protection against changes in the dollar–naira exchange rate. Payouts depend on the funds backing each position. |
| S08 | 107 · footer link | GitHub | Remove this developer repository link from the product footer. |
| S09 | 109 · footer disclosure | Testnet prototype. Simulated rates and test tokens only. | Demo on Monad testnet. Sample rates and test tokens only. |
| S10 | `src/app/App.tsx:19` · sign-in loading | Preparing secure sign-in… | Getting sign-in ready… |
| S11 | `src/components/ui/Progress.tsx:47` · accessible indicator description | {used} of {total} used | {label}: {used} out of {total} |
| S12 | `src/components/ui/Progress.tsx:50` · generic indicator footer | {remaining} remaining | Remove this generic remaining amount from demo health indicators; keep the sample indicator value and its demo explanation. |

Reviewed and unchanged: HedgeMaker branding; Market, How it works, Risks, Overview, Positions, Wallet; Sign in, Enter demo, Sign out; Risk disclosures; Skip to content, HedgeMaker home, Open navigation, Close navigation, Primary navigation; wallet addresses.

## Market and order preview — `/market`

Source: `src/pages/MarketPage.tsx`. This screen previews orders; it cannot place trades.

| ID | Source line / location | Current copy | Proposed copy or action |
| --- | --- | --- | --- |
| M01 | 89 · badge | Public preview · no sign-in required | Try a demo · no sign-in needed |
| M02 | 91 · introduction | Start with the real-world outcome. We’ll translate it into the market terms and show the reserve before any wallet prompt. | Choose the amount and date you want to protect. See an example rate and the USDC needed before signing in. |
| M03 | 94 · rate label | Finalized demo rate | Sample exchange rate |
| M04 | 95 · rate badge | Round 42 finalized | Demo rate confirmed |
| M05 | 103 · form eyebrow | Order ticket | Your order preview |
| M06 | 118 · amount label | Reference USD amount ($) | Amount to protect (USD) |
| M07 | 118 · amount hint | Whole $100 lots | Enter multiples of $100, such as $100 or $1,000. |
| M08 | 121 · date label | Listed maturity | Protection end date |
| M09 | 133 · pricing option | Follow reference | Follow the exchange rate |
| M10 | 134 · pricing option | Fixed limit | Fixed rate limit |
| M11 | 139 · adjustment label | Offset from reference (BPS) | Rate adjustment (basis points) |
| M12 | 139 · adjustment hint | Signed basis points. The offset stays fixed while an unfilled order is live. | 100 basis points = 1%. Enter a positive or negative whole number. This adjustment stays the same while any part of your order waits to match. Once matched, each position's agreed rate stays fixed. |
| M13 | 143 · fixed-rate notice | The first fixed-order prototype binds to round 42 at ₦1,650.00. A new finalized round invalidates its unfilled remainder. | This demo uses a fixed rate limit of ₦1,650.00 per USD. With a fixed-limit order, any unmatched amount becomes unavailable when a new reference rate is confirmed. |
| M14 | 148 · rate summary | Effective strike now | Current rate limit |
| M15 | 148 · rate summary hint | NGN per USD · owner-protective tick rounding | Naira per dollar · rounded in your favor |
| M16 | 150 · collateral label | Initial collateral | Required starting balance |
| M17 | 151 · reserve label | Entry reserve | Extra collateral for rate adjustment |
| M18 | 152 · fee label | Protocol fee | Trading fee |
| M19 | 152 · crossed-out fee reference and current fee | 5 BPS ref. / 0 testnet | Replace the crossed-out reference and current text with “No trading fee in this demo”. |
| M20 | 153 · total label | Total wallet pull | Total USDC required |
| M21 | 160 · collateral and matching disclosure | Collateral and gains remain locked until a terminal outcome. This preview does not guarantee a fill or conversion rate. | Collateral is USDC set aside to cover losses. Once your order is matched, it and any gains stay locked until the position ends. An order may never be matched. HedgeMaker settles gains and losses in USDC; it does not exchange dollars or naira. |
| M22 | 170 · scenarios eyebrow | Illustrative next fixing | Example rate changes |
| M23 | 176, 180 · scenario outcomes | Favorable to your side | Rate move in your favor |
| M24 | 176, 180 · scenario outcomes | Adverse to your side | Rate move against you |
| M25 | 184 · scenario disclosure | Single-round contractual examples before collateral caps. They do not predict liquidation or final payout. | These examples show the calculated gain or loss at each sample rate, before limits on available collateral. They do not predict when a position might close or how much you would receive. |
| M26 | 189 · order book eyebrow | Local demo fixture | Sample orders |
| M27 | 189 · order book heading | Indicative depth | Orders at each rate |
| M28 | 191 · accessible table label | Illustrative order book depth | Sample orders by rate |
| M29 | 192 · table header | Strike | Rate |
| M30 | 199 · matching notice | No counterparty is guaranteed. Unmatched size rests until filled, cancelled, invalidated, or expired. | Your order needs someone to take the other side. Any unmatched amount stays open until it is matched, cancelled, expires, or becomes unavailable after a rate update. |
| M31 | 208 · review eyebrow | Your intent | Your plan |
| M32 | 208 · dynamic review sentence | {date} maturity at an effective {rate} strike. | Protection end date: {date}. Current rate limit: {rate} per USD. |
| M33 | 211 · dynamic review amount | {amount} USDC reserve | {amount} USDC required |
| M34 | 215 · disabled action | Protocol writes not configured | Trading unavailable in demo |
| M35 | 215 · disabled action tooltip | A verified protocol deployment is required before writes can be enabled. | You can review an example here, but you cannot place an order. |
| M36 | 217 · sign-in action | Sign in with Privy | Sign in |
| M37 | 217 · local demo action | Enter local demo | Enter demo |
| M38 | 43 · amount error | Enter a positive notional. | Enter an amount greater than $0. |
| M39 | 45 · amount error | Use $100 whole-lot increments. | Enter a multiple of $100, such as $100 or $1,000. |
| M40 | 78 · fallback error | Unable to calculate preview. | We couldn't calculate this example. Check your entries and try again. |
| M41 | `src/domain/units.ts:8,13`, displayed through MarketPage line 78 | Enter a plain decimal amount. | Enter a number, such as 100 or 1000, without commas or a currency symbol. |
| M42 | `src/domain/units.ts:15`, displayed through MarketPage line 78 | Amount supports at most {decimals} decimal places. | Use no more than {decimals} decimal places. |
| M43 | 48, 78 · generated numeric error, example | Cannot convert 1.5 to a BigInt | Enter a whole number for the rate adjustment, such as 10 or -10. |
| M44 | `src/domain/math.ts:70`, displayed through MarketPage line 78 | Pegged strike multiplier must be positive. | Enter a rate adjustment greater than -10,000 basis points (-100%). |
| M45 | `src/domain/math.ts:35`, displayed through MarketPage line 78 | Strike must be positive. | This adjustment makes the rate too low. Increase the rate adjustment. |

For M41–M45, translate errors at the frontend display boundary; leave financial calculations and accepted numeric precision unchanged. M43 is an example of a browser-generated error, whose wording varies by runtime. Internal exceptions caused only by programmer or configuration errors are not new product copy.

Reviewed and unchanged: Build your USD/NGN protection.; What are you protecting?; Draft; Choose your situation; I need dollars later / I earn dollars (including the review heading); How should the rate be set?; Review protection; What if the rate moves?; USD/NGN rises to ₦1,700 / falls to ₦1,600; Buyers, Sellers; Not live; Preview ready; Read risks; numeric previews and date/time values.

## Shared sample data and activity messages

Source: `src/demo/fixtures.ts`. These values appear on the market, overview, positions, and position-detail screens. Change visible values, keeping data keys, enums, IDs, amounts, rates, and timestamps intact.

| ID | Source line / location | Current copy | Proposed copy or action |
| --- | --- | --- | --- |
| F01 | 9 · market rate source | Simulated NFEM-style fixing | Sample USD/NGN reference rate |
| F02 | 10 · rate status | Finalized | Confirmed |
| F03 | 50 · position purpose | Need dollars later | I need dollars later |
| F04 | 68 · order purpose | Earn dollars | I earn dollars |
| F05 | 69 · order pricing | Reference − 10 BPS | Reference rate − 0.10% |
| F06 | 79 · activity heading | Rate finalized | Reference rate confirmed |
| F07 | 79 · activity detail | Round 42 · ₦1,650.00 / USD | Sample rate: ₦1,650.00 per USD |
| F08 | 80 · activity heading | Variation settled | Position balance updated |
| F09 | 81 · activity heading | Order partially filled | Order partly matched |
| F10 | 81 · activity detail | 2 of 5 lots filled | $200 of your $500 order matched |
| F11 | 82 · activity heading | Claim credited | Funds available to withdraw |
| F12 | 75 · sample order status | Partially filled | Partly matched |

Reviewed and unchanged: USD buyer, Open, USD / NGN, all amounts and rates; “+29.411764 USDC remains locked”, “29.411764 USDC ready to withdraw”; Yesterday; dates/times and maturity options. Unused fixture value “Challenge complete” is not displayed and needs no consumer copy change.

## Landing page — src/pages/LandingPage.tsx

| ID | Line | Exact before | Proposed after / action |
|---|---:|---|---|
| L01 | 11 | Take the USD-buyer side when a rising NGN price of USD would squeeze your future purchase. | Choose the buyer side if a more expensive dollar would put pressure on your budget. |
| L02 | 17 | Take the USD-seller side when a stronger naira could reduce what your dollar income converts into. | Choose the seller side if a stronger naira would mean getting fewer naira for your dollar income. |
| L03 | 21 | Collateral-limited | Know your limits |
| L04 | 23 | See initial margin, maintenance, entry adjustment and the limits of protection in one review. | Review the funds you need to set aside, when you may need to add more, any starting adjustment, and the limits of protection. |
| L05 | 32 | Metropolis market prototype | Explore the testnet demo |
| L06 | 35 | A direct market for people with opposite USD/NGN worries. Choose a listed date, post collateral in test USDC, and let the order book find the other side. | Explore how to plan for changes in the dollar-to-naira rate. Choose an end date and preview the test USDC needed to back your hedge. Protection would begin once your order matches with someone taking the other side. |
| L07 | 41 | No currency delivery. No guaranteed conversion rate. Protection is limited by posted collateral. | This does not exchange dollars or naira or guarantee a conversion rate. Protection is limited to the funds set aside to back the hedge. |
| L08 | 47 | Finalized round {DEMO_MARKET.roundId.toString()} | Confirmed demo rate *(Remove internal round number from this consumer summary.)* |
| L09 | 56 | since prior simulated fixing | since the previous demo rate |
| L10 | 61 | Best buyer | Best buyer rate |
| L11 | 66 | Best seller | Best seller rate |
| L12 | 79 | Listed maturities | Choose your end date |
| L13 | 79 | 7, 14 and 30 day demo series | 7, 14 or 30 days in the demo |
| L14 | 80 | Isolated margin | Separate funds for each hedge |
| L15 | 80 | Each position stands on its own | Each hedge has its own balance |
| L16 | 81 | Cash-settled on Monad testnet | Explore gains and losses in test USDC |
| L17 | 86 | Built around your exposure | Built around your plans |
| L18 | 87 | Plain-language protection.<br />Market-grade transparency. | Understand your hedge.<br />Know your risks. |
| L19 | 88 | You should understand the trade before you need to understand the jargon. | See how rate changes could affect your balance before you decide. |
| L20 | 111 | One transparent loop | How it works |
| L21 | 112 | From worry to<br />a monitored position. | Set up your hedge.<br />Follow its progress. |
| L22 | 115 | Describe the worry | Choose your goal |
| L23 | 115 | Need dollars later or earn dollars? Pick the real-world outcome first. | Need dollars later, or earn dollars? Choose the option that fits your plans. |
| L24 | 116 | See the rate, date, reserve, margin thresholds, fees and adverse scenario. | Review your rate, end date, required funds and fees. See what could happen if the rate moves against you. |
| L25 | 117 | Match and monitor | Match and track |
| L26 | 117 | Your order finds the opposite side. Finalized rates move locked collateral. | Your order can match with someone taking the other side. Confirmed rate updates adjust the funds locked in your hedge. |
| L27 | 118 | Claim after close | Withdraw your remaining funds |
| L28 | 118 | When the position closes, released equity becomes claimable before withdrawal. | Once your hedge closes, your remaining funds become available to withdraw to your wallet. |

Reviewed and unchanged: “For importers”, “Plan for a higher dollar.”, “For dollar earners”, “Protect a naira target.”, “Risk is visible before you sign.”, “Hedge the rate. / Keep the plan.”, “Explore the market”, “See an example”, accessible labels “Current demo market snapshot” and “Product facts”, “USD / NGN”, currency symbols, rate/quote figures, availability amounts, “Build a hedge”, “SIMULATED”, “Test USDC”, “Review the protection”, “Try the testnet experience”, “See both sides before you choose yours.”, “Open the USD/NGN market”, numbered visual steps.

## Learn page — src/pages/LearnPage.tsx

| ID | Line | Exact before | Proposed after / action |
|---|---:|---|---|
| LE01 | 9 | A two-minute primer | A two-minute guide |
| LE02 | 10 | A forward that settles the difference. | How your hedge gains or loses value. |
| LE03 | 11 | HedgeMaker creates collateral-limited exposure to an official USD/NGN reference rate. It does not exchange physical dollars or naira. | Explore how a hedge can help you manage changes in the dollar-to-naira reference rate. Gains and losses are calculated in USDC, and protection is limited to the funds backing the hedge. This demo uses sample rates and test USDC. No dollars or naira are exchanged. |
| LE04 | 16 | If USD/NGN rises above your strike, the buyer side gains locked USDC collateral. If it falls, the buyer side pays from its posted collateral. | If the dollar-to-naira rate rises above your agreed rate, your hedge gains USDC. If it falls below your agreed rate, your hedge loses USDC from the funds you set aside. Gains stay locked until your hedge closes. |
| LE05 | 20 | If USD/NGN falls below your strike, the seller side gains locked USDC collateral. If it rises, the seller side pays from its posted collateral. | If the dollar-to-naira rate falls below your agreed rate, your hedge gains USDC. If it rises above your agreed rate, your hedge loses USDC from the funds you set aside. Gains stay locked until your hedge closes. |
| LE06 | 24 | Contractual value to the buyer | How the buyer’s gain or loss is calculated |
| LE07 | 26 | Reference USD notional | Dollar amount your hedge covers |
| LE08 | 27 | Your fixed NGN/USD strike | Your agreed rate in naira per dollar |
| LE09 | 28 | Finalized reference rate | Confirmed reference rate in naira per dollar |
| LE10 | 32 | Example notional | Example hedge amount |
| LE11 | 33 | Strike | Agreed rate |
| LE12 | 37 | Gains remain locked while a position is open. If collateral is exhausted, the position defaults and the promised amount can exceed what is actually paid. | Gains stay locked until your hedge closes. If either side runs out of funds, the hedge closes in default. You may receive less than the calculated amount, and any unpaid amount is not insured. |
| LE13 | 38 | Build an example | Try an example hedge |

Reviewed and unchanged: “USD buyer”, “I need dollars later”, “USD seller”, “I earn dollars”, exact formula “V = N × (R − K) ÷ R”, N/K/R keys, $1,000, ₦1,650 / USD, “If rate is ₦1,700”, “If rate is ₦1,600”, “Buyer +29.411764 USDC”, “Buyer −31.250000 USDC”. Retain calculation as useful product education, with clearer labels rather than removing it.

## Risks and disclosures — src/pages/TermsPage.tsx

| ID | Line | Exact before | Proposed after / action |
|---|---:|---|---|
| T01 | 4 | Collateral-limited protection | Protection has a funding limit |
| T02 | 4 | A counterparty can owe more than its remaining collateral. Any unpaid amount is recorded as shortfall; it is not insured or socialized in V1. | The other side of your hedge may owe more than the funds it has left. Any unpaid amount is recorded, but it is not insured or covered by other users. |
| T03 | 5 | Official-rate basis risk | Your exchange rate may differ |
| T04 | 5 | The hedge follows the configured official reference, not necessarily the P2P or conversion rate you receive elsewhere. | A hedge follows the reference rate used by its market. That rate may differ from what a bank, exchange service or another person offers you. This demo uses sample rates. |
| T05 | 6 | Early termination | Your hedge can close early |
| T06 | 6 | Liquidation, collateral exhaustion, or an oracle failure can close protection before maturity. V1 has no early-close or position-transfer feature. | Your hedge can close before its end date if either side misses a required top-up deadline, either side runs out of funds, or the rate feed fails. You cannot choose to close a hedge early or transfer it to someone else in this version. |
| T07 | 7 | Test USDC assumptions | USDC has its own risks |
| T08 | 7 | The payoff assumes one USDC equals one USD. Token freezes, depegs, bridges, and issuer risks sit outside the hedge. | The calculation treats 1 USDC as 1 US dollar. Your hedge does not protect against USDC losing that value, being frozen, or problems with its issuer or services used to move it between networks. This demo uses test USDC. |
| T09 | 8 | Trusted demo roles | Demo rates rely on trusted operators |
| T10 | 8 | The testnet feed signer and dispute resolver are explicit trusted roles. Simulated rates are not real market observations. | This demo relies on trusted operators to submit rate updates and resolve disputes. Its simulated rates are examples, not real market prices. |
| T11 | 9 | Timing and liveness | Updates and closing can take time |
| T12 | 9 | Finalized oracle updates and keeper transactions drive settlement. Time passing by itself does not update or close a position. | Your hedge needs confirmed rate updates and processing transactions to settle. Reaching the end date alone does not update or close it. |
| T13 | 16 | Disclosure draft · v0.3 | Testnet demo disclosures *(Remove internal draft version number; retain disclosure purpose.)* |
| T14 | 18 | These are product-design disclosures for a testnet prototype, not legal, investment, or regulatory advice. | These disclosures explain the risks and limits of this testnet demo. They are not legal, investment or regulatory advice. |

Reviewed and unchanged: “Know what this hedge does—and what it cannot do.” and visual card numbering. All six risk topics retained; internal implementation terms are translated, not hidden risks.

## Not found — src/pages/NotFoundPage.tsx

| ID | Line | Exact before | Proposed after / action |
|---|---:|---|---|
| N01 | 8 | This market page does not exist. | We couldn’t find this page. |
| N02 | 9 | The order may have moved, or the link may be incomplete. | The link may be incorrect or the page may no longer be available. |

Reviewed and unchanged: “404”, “Return home”. “The order may have moved” appears to imply unsupported order-route behavior; replacement avoids that claim.

## Browser and search metadata — index.html

| ID | Line | Exact before | Proposed after / action |
|---|---:|---|---|
| H01 | 8 | HedgeMaker is a testnet market for collateral-limited USD/NGN protection. | Explore hedging changes in the dollar-to-naira rate with HedgeMaker’s testnet demo. Protection is limited to the funds set aside for each hedge. |
| H02 | 11 | HedgeMaker — USD/NGN protection on Monad | HedgeMaker — Try dollar-to-naira hedging |

Reviewed and unchanged: document language, viewport and theme-color metadata (non-copy). The proposed title removes platform jargon; the description preserves testnet and protection-limit disclosures.


## Dashboard

Source: `src/pages/app/DashboardPage.tsx`

| ID | Line | Before (exact rendered copy) | Proposed after |
|---|---:|---|---|
| D01 | 17 | Your USD / NGN positions, collateral, and market activity. | Track your USD / NGN positions, funds, and market activity. |
| D02 | 19 | Local demo · testnet preview | Demo · sample data |
| D03 | 23 | Wallet USDC | USDC balance |
| D04 | 23 | In connected wallet | Sample wallet balance |
| D05 | 25 | Claimable | Available to withdraw |
| D06 | 25 | Withdraw from the Vault | Withdraw to your wallet |
| D07 | 26 | USD / NGN · isolated margin | USD / NGN · funds held separately for each position |
| D08 | 33 | REFERENCE MARKET | MARKET RATE |
| D09 | 34 | Simulated fixing | Sample reference rate |
| D10 | 36 | Displayed rate is demo data and is not an executable quote. | This sample rate is for reference. You cannot trade at this rate in the demo. |
| D11 | 41 | +₦{previousChange} from prior round | +₦{previousChange} since the previous update |
| D12 | 44 | Round / #{DEMO_MARKET.roundId.toString()} | Remove the internal rate-update number from this consumer summary. |
| D13 | 45 | Source status | Rate status |
| D14 | 46 | Observed | Rate observed |
| D15 | 49 | Sample order book | Sample buy and sell orders |
| D16 | 50 | Local fixture · counterparties are not live | Example orders only. No buyers or sellers are trading here. |
| D17 | 69 | Margin belongs to each isolated position. | Funds set aside for each position are held separately. |
| D18 | 74 | {position.side} · {position.notional} notional | {position.side} · {position.notional} position size |
| D19 | 75 | Margin health | Collateral health |
| D20 | 76 | Demo health indicator. Contract health and cure amounts require live position data. | This is a sample health indicator. Live risk levels and any required top-up are unavailable in this demo. |
| D21 | 94 | Indicative strike | Current rate limit |
| D22 | 95 | Demo expiry | Expires (demo) |
| D23 | 105 | Example events from the local preview fixture. | Sample activity to show how your account history will look. |
| D24 | 115 | No activity shown here is a confirmed chain event. | This is example activity, with no confirmed transactions. |
| D25 | 122 | Wallet funding and Vault collateral are separate balances. | Your wallet balance and the funds held in HedgeMaker are separate. |
| D26 | 16 | Dashboard | Overview |
| D27 | 92 | Filled | Matched |
| D28 | 93 | Remaining | Waiting to match |

Reviewed and suitable unchanged: ACCOUNT OVERVIEW; Account summary; Locked in positions; Not available to withdraw; Open positions; Market and account details; USD / NGN; USD buyers; USD sellers; COLLATERAL; Position health; View position; OPEN ORDER; RECENT ACTIVITY; Account activity; View wallet; dynamic status plus “· demo”. Dynamic source status and activity/order text require review in fixtures.

## Wallet

Source: `src/pages/app/WalletPage.tsx`

| ID | Line | Before (exact rendered copy) | Proposed after |
|---|---:|---|---|
| W01 | 10 | Review wallet tokens, Vault reservations, and claimable funds. | See your wallet balance, funds held in HedgeMaker, and funds available to withdraw. |
| W02 | 11 | Local demo · testnet preview | Demo · sample data |
| W03 | 15 | Local demo value · wallet token balance | Sample wallet balance |
| W04 | 16 | Claimable in Vault | Available to withdraw |
| W05 | 16 | A separate withdrawal is required | Withdraw to your wallet |
| W06 | 17 | Network gas token | Network fee balance |
| W07 | 17 | Example balance · MON | Sample MON balance for network fees |
| W08 | 23 | USDC in connected wallet | Sample USDC wallet balance |
| W09 | 24 | Tokens held by the wallet. Not the same as collateral already deposited in the Vault. | These sample wallet funds are separate from funds set aside for orders and positions. |
| W10 | 27 | Demo fixture | Sample balance |
| W11 | 28 | Funding is not available in this preview. No token transfer or deposit has been initiated. | Adding funds is unavailable in this demo. No funds have been transferred or deposited. |
| W12 | 31 | Connect a configured Monad testnet funding flow to enable deposits. | Deposits are unavailable in this demo. |
| W13 | 38 | Vault breakdown | Funds held in HedgeMaker |
| W14 | 39 | Separate accounting buckets from local sample data. Locked collateral and claims are not wallet funds. | These sample balances show funds held in HedgeMaker, separately from your wallet. |
| W15 | 44 | Position collateral locked | Locked in positions |
| W16 | 45 | Claimable from Vault | Available to withdraw |
| W17 | 46 | Fee escrow | Reserved for fees |
| W18 | 49 | Withdraw claim | Withdraw funds |
| W19 | 50 | Withdrawal is disabled in preview. Claimable funds have not been transferred to the wallet. | Withdrawals are unavailable in this demo. Available funds have not been transferred to your wallet. |
| W20 | 56 | Preview identity and connection details. | Wallet and network details for this demo. |
| W21 | 59 | Monad testnet preview | Monad test network |
| W22 | 60 | USDC contract / Not configured | Remove this internal token configuration row. |
| W24 | 61 | Hidden in local demo | Not shown in this demo |
| W25 | 63 | Demo balances are fixture data and are not read from Privy or chain. | These are sample balances, not live balances from your wallet or the network. |
| W26 | 64 | Monad network docs | Remove this developer documentation link from the consumer screen. |

Reviewed and suitable unchanged: ACCOUNT; Wallet; Wallet balance summary; Wallet balance; Add funds; Reserved for open orders; Network and wallet; Network; Wallet address. Keep the wallet/Vault distinction and disabled-action explanations. W26 explicitly removes an internal/developer documentation link; no replacement destination is proposed.

## Positions

Source: `src/pages/app/PositionsPage.tsx`

| ID | Line | Before (exact rendered copy) | Proposed after |
|---|---:|---|---|
| P01 | 10 | Each matched fill has its own isolated collateral and settlement history. | Each position has its own funds set aside and a record of how it settles. |
| P02 | 11 | Local demo · testnet preview | Demo · sample data |
| P03 | 17 | Sample position records. Live contract status and oracle events are not connected. | Explore sample positions. Live position status and rate updates are unavailable in this demo. |
| P04 | 22 | Side / notional | Direction / size |
| P05 | 22 | Strike | Agreed rate |
| P06 | 22 | Current equity | Current position balance |
| P07 | 28 | Reference {position.currentRate} | Reference rate {position.currentRate} |
| P08 | 30 | Demo P&L {position.pnl} | Sample profit / loss {position.pnl} |
| P09 | 38 | This local sample list is not a record of real orders or onchain positions. | These are sample positions. They do not represent real orders or transactions. |
| P10 | 45 | Demo indicator | Sample indicator |
| P11 | 45 | Collateral for this position is isolated from other positions. | The funds set aside for this position are held separately from your other positions. |
| P12 | 47 | Margin health | Collateral health |
| P13 | 49 | Initial margin | Required starting balance |
| P14 | 50 | Maintenance margin | Top-up trigger balance |
| P15 | 51 | Counterparty equity | Other side's position balance |
| P16 | 53 | Use live position health and cure amount once contract reads are connected. | Live risk levels and any required top-up are unavailable in this demo. |
| P17 | 22 | Maturity | End date |

Reviewed and suitable unchanged: ACCOUNT; Positions; Position history; Demo positions (accessible region name); Position; Status; Details; “for {position.id}” (accessible link qualifier); Position health summary; “{position.id} health”. “Current position balance” includes collateral plus retained gains/losses; it is not a spendable wallet balance. Dynamic position records require review in fixtures.

## Position details (including missing-position state)

Source: `src/pages/app/PositionDetailPage.tsx`

| ID | Line | Before (exact rendered copy) | Proposed after |
|---|---:|---|---|
| PD01 | 15 | No demo position matches this route. | We couldn't find this position in the demo. |
| PD02 | 29 | ISOLATED POSITION · LOCAL DEMO | POSITION · DEMO |
| PD03 | 29 | {position.side} · {position.notional} notional · {position.maturity} maturity | {position.side} · {position.notional} position size · Ends {position.maturity} |
| PD04 | 30 | Testnet preview · fixture data | Demo · sample data |
| PD05 | 35 | Current position value | Estimated profit / loss |
| PD06 | 35 | Indicative fixture calculation using the sample reference rate. | An example calculation based on the sample reference rate. |
| PD07 | 39 | Contract strike | Agreed rate |
| PD08 | 41 | Current isolated equity | Current position balance |
| PD09 | 42 | Reported P&L fixture | Sample reported profit / loss |
| PD10 | 44 | P&L is an illustrative payoff, not a settled or withdrawable amount. Gains remain locked until position close. | This example profit or loss has not been settled and cannot be withdrawn. Gains stay locked until the position closes. |
| PD11 | 49 | Live collateral, deadline, and cure amount require confirmed contract reads. | Live collateral balances, top-up deadlines, and required top-up amounts are unavailable in this demo. |
| PD12 | 51 | Demo margin health | Sample collateral health |
| PD13 | 53 | Initial margin | Required starting balance |
| PD14 | 54 | Maintenance margin | Top-up trigger balance |
| PD15 | 55 | Counterparty equity | Other side's position balance |
| PD16 | 56 | Liquidation state | Forced closure status |
| PD17 | 59 | Add margin | Add collateral |
| PD18 | 60 | No transaction is available here; this page does not submit or simulate a margin top-up. | Adding collateral is unavailable in this demo. No funds will be added. |
| PD19 | 66 | Terms shown for illustration from the current local market fixture. | Sample terms for this demo position. |
| PD20 | 70 | Side | Direction |
| PD21 | 71 | Notional | Position size |
| PD22 | 73 | Maturity | End date |
| PD23 | 56 | Unavailable in preview | Unavailable in this demo |

Reviewed and suitable unchanged: All positions; Position not found; Return to positions; Position details; Sample reference rate; “· demo” equity suffix; Margin and risk; Position terms; Market; USD / NGN; Entry rate; Rate source; “· simulated” source suffix. Live source/status values remain precise.


## Implementation verification

- Confirmed all 221 approved row IDs have been implemented, including exact replacement wording, dynamic values, and removals.
- `npm run lint` passed.
- `npm run build` passed, including TypeScript checking and the production bundle.
- `npm run test` passed: 15 existing tests across three files.
- A temporary rendered-App smoke suite passed 19 checks: all nine screen types, missing-position state, sample payoff values, amount/rate-adjustment errors, and disabled trading, deposits, and withdrawals. The smoke suite was kept outside the committed change.
- `git diff --check` passed.
- Financial calculations, amounts, routes, authentication behavior, and contract code are unchanged. Validation errors are translated at the frontend display boundary.

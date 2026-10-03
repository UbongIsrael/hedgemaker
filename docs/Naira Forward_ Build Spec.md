# Naira Forward: Build Spec (Monad Metropolis)

Working name. Draft v1. All numbers marked *placeholder* need calibrating.

## 1. What it is

A cash-settled USD/NGN forward, settled in USDC on Monad. Two people with opposite worries are matched on an order book. Each posts a small deposit. Gains and losses are settled at every rate update, and a losing side that runs low on margin is topped up or closed out automatically.

**First users (to verify with 3-5 real conversations before pitching):**

- Earner side: a freelancer paid in dollars who loses naira value if the naira strengthens.
- Importer side: a small importer who needs dollars later and loses if the naira weakens.

**Why it may not exist for them:** bank forwards and FMDQ futures exist, but are gated through authorised dealers. Confirm this gap with real users; do not assert it in the pitch until you have.

## 2. Contracts

| Contract | Job |
| --- | --- |
| `MarketConfig` | Per-currency settings: reference source, lot size, tenors, initial and maintenance margin, grace period. Adding Ghana later is a new config, not new code. |
| `OrderBook` | Price-time limit orders on the strike (NGN per USD). Posting an order locks initial margin. Matching creates a position. |
| `PositionManager` | Holds open positions, runs variation settlement, margin calls, liquidation, early close and expiry. |
| `Vault` | Holds USDC margin. Only `PositionManager` can move it. |
| `RateOracle` | Stores signed daily rates with a source reference. Dispute window and void fallback live here. |

## 3. Payoff and margin

- Notional N (USD), strike K (NGN per USD), rate at update R.
- Value to the dollar-buyer: V = N x (R - K) / R, paid in USDC. The seller's value is -V.
- At each rate update, move (V_now - V_prev) from the losing side's margin to the winning side's balance. If the strike differs from the first rate seen, the first update settles the gap.
- Initial margin: 5% of N (*placeholder*). Maintenance margin: 2.5% of N (*placeholder*).
- If a side drops below maintenance: margin call event, grace period (*placeholder*, e.g. a few updates in the demo), then anyone may call `liquidate()` for a small reward (*placeholder*, bps). Liquidation closes the position and pays remaining margin to the other side.
- Early exit: close by trading the opposite side on the book.
- Expiry: final update at the fixing date, positions close, margins released.
- **Known residual risk:** if one update moves more than the loser's margin, the winner is short the difference. Disclose it on the ticket. Stretch: fee-funded reserve.

## 4. Oracle

- Production design: a signer posts the central bank's daily published rate with a link or hash of the source. A dispute window follows. If a rate is late or disputed past the grace period, the market voids and margins are returned.
- Non-publication days use the last published rate.
- **Demo mode:** an accelerated, clearly labelled simulated rate feed so margin movement can be shown in minutes. State this on screen and in the pitch.
- Basis risk, shown on the ticket: the hedge tracks the official rate, not the P2P rate people actually convert at.

## 5. Screens

1. **Ticket:** strike, notional, tenor, initial margin, maintenance level, and plain-language "what you can lose" and "what is not covered."
2. **Position:** two margin bars (yours and counterparty), current rate vs strike, running gain or loss.
3. **Margin call:** clear alert, countdown, one-tap top up.
4. **Receipt:** what happened, what each side received, and why, in one sentence.

## 6. Three-minute demo shot list

1. Ada (earner) and Bayo (importer) post and match an order at the strike. Deposits appear as bars.
2. Rate moves against Ada. Her bar shrinks, Bayo's grows with each update.
3. Margin call fires. Ada tops up. Bar refills.
4. A second sharp move drops her below the floor. Grace period passes. Liquidation closes the position.
5. Receipt screen: final amounts and the reason.
6. Close on the label: "Demo uses a simulated rate. Production uses the daily official fixing."

## 7. Open decisions

- Margin percentages and grace period (calibrate against historical naira moves).
- Who can liquidate: anyone (keeper model) or platform only.
- Lot size and tenors (suggested: $100 lots; 7, 14, 30 days).
- Second market for the "config, not code" slide: Ghana looks stronger than Kenya on demand. Verify.
- Testnet only, with a regulatory disclaimer. Nigeria's 2025 securities law requires SEC registration of derivative products.

## 8. Honest limits to state in the pitch

- Hedges the official rate, not the P2P rate.
- Demo uses a simulated rate feed; settlement logic is real onchain.
- Single-signer oracle in v1, with a path to multiple sources.
- Gap-risk beyond posted margin exists and is disclosed.

## 9. Before building

Talk to two or three freelancers and one or two importers. Ask which rate they actually convert at, how they hedge today, and whether they would lock a rate if they could. Their answers decide whether the first-user claim goes in the pitch.
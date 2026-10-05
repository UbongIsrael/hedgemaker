# Liquidity, continuity, and exits proposal

Status: design proposal; not yet part of the normative build specification

This proposal covers four related product changes:

1. filling one user's requested hedge from several opposing orders;
2. concentrating liquidity on a small set of selectable rate levels;
3. protecting a healthy user when a counterparty defaults; and
4. allowing a user to leave a live hedge without taking rights away from the
   other side.

It also defines the first live order-book view and a future documentation-site
outline.

## 1. Keep fills bilateral and group them for the user

The current contracts already support partial and multi-counterparty fills. The
matching loop repeatedly selects the best compatible buyer and seller, fills the
smaller remaining amount, and continues until the configured work limit is
reached or the book no longer crosses. Each fill creates a separate bilateral
position.

That onchain model should remain. A single pooled position with many counterparties
would couple their collateral, calls, defaults, and settlement. Separate child
positions preserve isolation and make every default attributable to one leg.

The product should add a user-facing parent object:

```ts
interface HedgeGroupView {
  hedgeId: string;
  sourceOrderId: string;
  requestedLots: string;
  matchedLots: string;
  remainingLots: string;
  positionIds: string[];
  status: 'waiting' | 'partly_matched' | 'matched' | 'partly_closed' | 'closed';
}
```

Example:

```text
$500 requested
  $200 matched with position A
  $100 matched with position B
   $50 matched with position C
  $150 matched with position D
```

The summary may aggregate requested and matched notional, PnL, and collateral.
It must also expose each leg's rate, health, margin deadline, and outcome. One
defaulted child leg must not be hidden behind a healthy aggregate label.

### Proposed lot size

The demo currently uses $100 whole lots, so a $50 fill is not valid. If the desired
minimum fragment is $50, configure `lotNotionalRaw` as 50 USDC before activating
the first economic version. If a version is already active, introduce this through
a new append-only version rather than mutating live terms.

## 2. Concentrate liquidity on a rate ladder

The contract already requires every fixed strike to be a multiple of
`tickSizeRaw`. This is the protocol-level rate grid. The demo currently uses a
₦0.50 tick. A proposed launch configuration is a **₦5 tick**, subject to scenario
testing with the selected lot size and margin settings.

The guided ticket should not use a free-form rate input. It should display a small
ladder around the current reference and show live opposing depth beside every
choice:

```text
Rate          Buyers       Sellers       Result for this order
₦1,565        $300         —             rests on book
₦1,570        $850         $200          can match up to $200
₦1,575        $100         $700          can match immediately
```

Advanced mode may allow another grid-aligned level, but never an off-grid value.
Clicking a level populates a limit; the review still states that a buyer limit is
the maximum acceptable rate and a seller limit is the minimum acceptable rate.

Orders do not need equal amounts or identical limits. Compatible limits cross and
execute at the older maker's rate, which preserves price improvement and price-time
priority. Exact-equality matching should not be introduced.

### Fixed and pegged presets are different

- A fixed order is bound to the current finalized oracle round. A new finalized
  round invalidates its unfilled remainder. It is suitable for an exact, short-lived
  rate choice.
- A pegged order can persist across rounds, but its effective rate moves with the
  reference. Guided presets for pegs should therefore be expressed as offsets, not
  as a promise that an absolute rate will remain available.
- Owner-protective tick rounding must remain. At a ₦1,572 reference with a ₦5 tick,
  a zero-offset buyer rounds down to ₦1,570 while a zero-offset seller rounds up to
  ₦1,575. Those orders do not cross. Presets concentrate liquidity; they cannot
  create opposite demand or justify rounding against a user's signed limit.

Recommended guided choices:

1. **Match available orders** — select an explicit maximum/minimum from current
   executable depth and show every expected rate level.
2. **Post at this rate** — choose one grid level and let the remainder rest for a
   short disclosed lifetime.
3. **Follow the reference** — an advanced persistent pegged order with a reviewed
   offset and bounds.

## 3. Build a real visible order book

The current market screen displays a static demo book. The live book should be
grouped by deployment, config version, market, maturity series, side, effective
strike, and oracle round.

Each row should show:

- rate;
- executable buyer notional and order count;
- executable seller notional and order count;
- cumulative depth;
- selected maturity;
- source round and last observed block;
- freshness/feed state; and
- whether matching is pending.

For the small testnet book, a reader can snapshot `activeOrderIds`, `getOrder`,
`previewEffectiveLimit`, config, and oracle state at one block. A production book
should use a reorg-aware event indexer and reconcile against canonical contract
reads. Pegged orders are grouped by current effective rate, not stored offset.
Expired, invalidated, inactive, or feed-suspended size must not appear as executable
depth. Owners may still see their inactive orders with the reason.

The indexer must treat the two `OrderFilled` events for one bilateral fill as one
fill, using the shared position ID, transaction hash, and log identities. It must
not double-count notional.

## 4. Healthy-user continuity after counterparty default

The current behavior is deterministic but not continuous: when either side's
collateral is exhausted, that bilateral child position closes, available collateral
is paid, and any shortfall is recorded. There is no replacement, insurance fund,
or transfer mechanism.

A matching engine alone cannot guarantee continued protection. Continuity requires
both:

1. capital to cover any eligible amount already unpaid; and
2. a funded party willing and able to carry the remaining future exposure.

The product must not promise that a hedge “cannot fail” unless a committed backstop
can satisfy both obligations within disclosed limits. Finite reserve exhaustion,
oracle failure, token failure, and chain failure remain explicit exceptions.

### Proposed replacement/novation sequence

1. Process all eligible finalized observations in deterministic order and establish
   one transfer round.
2. Settle the defaulting side's payable variation from its remaining equity.
3. Apply a separately funded reserve only to losses covered by the published
   reserve policy. Never borrow from unrelated positions.
4. Create a replacement request for the defaulting side. A replacement explicitly
   accepts the remaining exposure and posts the required collateral plus any agreed
   transfer payment.
5. Atomically replace the defaulting owner while preserving the healthy side's
   equity and the position's original notional, strike, maturity, config/oracle
   terms, last settled round, and last settled value.
6. Record lineage from the old owner/default event to the new owner. No settled
   interval may be charged twice and no terminal position may be silently revived.
7. If no market participant accepts, a precommitted backstop must carry the side
   during any replacement auction. If backstop capacity is exhausted, apply the
   disclosed capped closeout instead of claiming continuity.

“Rematch at the current rate” is not economically equivalent for this product. Its
inverse payoff is:

```text
V(R) = N × (1 − K/R)
```

Resetting the strike from `K` to the transfer rate changes future sensitivity.
The simple, auditable transfer therefore preserves the original strike, notional,
and last settled value. The current official reference is used to synchronize and
price the takeover process; it does not rewrite the healthy user's contract.

The reserve and replacement-capacity ledgers must be separate. A reserve may cover
an existing shortfall while still lacking enough capital to carry future exposure.

## 5. A live hedge can be transferable, but not freely cancellable

A filled hedge should not be unilaterally breakable merely because one side is
losing. That would erase an accrued obligation or remove protection the other user
already paid collateral to receive.

Offer these valid exits:

1. **Transfer request (recommended first):** the exiting user states size, expiry,
   and maximum transfer cost. Margin duties continue until a replacement accepts.
   The replacement posts collateral and acquires the exact remaining leg.
2. **Mutual close:** both parties sign an expiring close agreement after settlement
   through one common finalized round.
3. **Protocol closeout:** existing maturity, liquidation, default, or oracle-failure
   rules remain deterministic and permissionless.

Opening an opposite position is not the same as closing. Until contractual netting
exists, it creates another live, margined child position and must be presented that
way.

Start with full-leg transfers. Partial exit adds split accounting, rounding,
collateral allocation, and lineage complexity and should follow only after the
full-transfer invariants are tested.

## 6. Delivery sequence

### Phase A — liquidity and transparency

- Configure and scenario-test the proposed $50 lot and ₦5 tick.
- Add multi-counterparty contract tests for `$500 = $200 + $100 + $50 + $150`.
- Add the `HedgeGroupView` read model and grouped fill UI.
- Replace the static demo depth with a canonical live order book.
- Add grid-level selection, depth-aware previews, partial-fill summaries, and
  residual-order controls.
- Benchmark worst-case bounded matching gas before increasing book capacity.

### Phase B — voluntary transfers

- Specify transfer requests, acceptance, fees, expiry, and full-leg novation.
- Preserve original economics and current settlement state atomically.
- Add mutual-close messages and replay protection.
- Add transfer lineage and user receipts.

### Phase C — default continuity

- Specify reserve eligibility, contribution, caps, withdrawal delay, and waterfall.
- Fund and stress-test backstop exposure capacity independently from shortfall cover.
- Add default-triggered replacement auctions and a committed interim risk bearer.
- Publish measurable coverage limits before using continuity or guarantee language.

The contracts are non-upgradeable. Contract changes in Phases B and C require a new
deployment and an explicit policy for existing positions. Existing positions keep
their original terms.

## 7. Documentation site plan

Mintlify setup can wait until the economic decisions above are approved. The
repository should remain the source of truth. A future documentation site should
publish this information architecture:

1. Overview
2. How HedgeMaker works
3. Orders, partial fills, and the rate ladder
4. Collateral, margin calls, and liquidation
5. Defaults, replacement, and coverage limits
6. Exiting or transferring a hedge
7. Oracle and fixing methodology
8. Risks and non-guarantees
9. Contract addresses and verified deployments
10. Developer schemas, events, and integration guide

MCP tooling is not required for the canonical trading path or the documentation
site. Documentation generation may use tooling, but contracts, verified deployment
records, and versioned repository content remain authoritative.

## 8. Decisions required before implementation

1. Approve or change the proposed **$50 lot size**.
2. Approve or change the proposed **₦5 rate tick**.
3. Choose whether guided mode defaults to a short-lived fixed preset or a persistent
   reference-pegged preset.
4. Decide whether voluntary transfer is required before the next deployment.
5. Decide whether the protocol will capitalize a reserve/backstop. Without it,
   replacement can be attempted but continuity cannot be guaranteed.

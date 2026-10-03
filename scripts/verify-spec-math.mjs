// Reference arithmetic for the documentation, not a contract implementation,
// historical backtest, or proof of economic safety. Run with Node.js >= 18.
import assert from 'node:assert/strict';

const BPS = 10_000n;
const UNIT = 1_000_000n;
const max = (a, b) => a > b ? a : b;
const ceil = (a, b) => {
  assert(a >= 0n && b > 0n);
  return (a + b - 1n) / b;
};
const value = (notional, strike, rate) => {
  assert(notional > 0n && strike > 0n && rate > 0n);
  return notional * (rate - strike) / rate; // BigInt truncates toward zero.
};
const peg = (rate, offset, tick, side) => {
  const numerator = rate * (BPS + offset);
  assert(numerator > 0n && tick > 0n);
  return (side === 1n ? numerator / (BPS * tick) : ceil(numerator, BPS * tick)) * tick;
};
const pegReserve = (lot, lots, offset, side) => ceil(max(0n, side * lot * offset), BPS) * lots;
const fixedReserve = (lot, lots, strike, rate, side) =>
  ceil(max(0n, -side * lot * (rate - strike)), rate) * lots;

assert.equal(value(1000n * UNIT, 1650n * UNIT, 1700n * UNIT), 29_411_764n);
assert.equal(value(1000n * UNIT, 1650n * UNIT, 1600n * UNIT), -31_250_000n);
assert.equal(-31_250_000n - 29_411_764n, -60_661_764n);
assert.equal(value(1000n * UNIT, 1700n * UNIT, 1600n * UNIT), -62_500_000n);
let cumulative = 0n;
let previous = 0n;
for (const rate of [1650n, 1700n, 1600n, 1673n, 1491n, 1650n]) {
  const current = value(1000n * UNIT, 1650n * UNIT, rate * UNIT);
  cumulative += current - previous;
  assert.equal(cumulative, current);
  previous = current;
}
// Ideal identity in exact rational arithmetic, before rounding/fees/shortfall.
for (const r of [800n, 1600n, 1650n, 1700n, 2500n]) {
  const n = 1000n, k = 1650n;
  assert.equal(n * r - n * (r - k), n * k);
}
for (const due of [40n, 50n, 80n]) {
  const paid = due > 50n ? 50n : due;
  assert.equal((50n + paid) + (50n - paid), 100n);
  assert.equal(due - paid, due > 50n ? due - 50n : 0n);
}

let reserveCases = 0;
let mixedMatchCases = 0;
const rates = [1n, 17n, 101n, 1234567n, 1600123456n, 2500000000n];
const offsets = [-9900n, -250n, -1n, 0n, 1n, 250n, 9900n];
for (const rate of rates) {
  for (const tick of [1n, 13n, 1000000n]) {
    for (const offset of offsets) {
      for (const side of [1n, -1n]) {
        const limit = peg(rate, offset, tick, side);
        if (side === 1n) assert(limit * BPS <= rate * (BPS + offset));
        else assert(limit * BPS >= rate * (BPS + offset));
        if (limit <= 0n) continue; // An inactive zero strike must never execute.
        for (const lot of [101n, 100n * UNIT]) {
          for (const lots of [1n, 2n, 7n]) {
            for (const improvedTicks of [0n, 1n, 3n]) {
              const execution = limit - side * improvedTicks * tick;
              if (execution <= 0n) continue;
              const adverse = max(0n, -side * value(lot * lots, execution, rate));
              assert(adverse <= pegReserve(lot, lots, offset, side));
              reserveCases++;
            }
          }
        }
      }
    }
    // Test all fixed/pegged pairings with either side as the older maker.
    for (const buyerKind of ['fixed', 'pegged']) {
      for (const sellerKind of ['fixed', 'pegged']) {
        for (const buyerOffset of offsets) {
          for (const sellerOffset of offsets) {
            const buy = peg(rate, buyerOffset, tick, 1n);
            const sell = peg(rate, sellerOffset, tick, -1n);
            if (sell <= 0n || buy < sell) continue;
            for (const execution of [buy, sell]) {
              const lot = 100n * UNIT, lots = 3n;
              const v = value(lot * lots, execution, rate);
              const rb = buyerKind === 'pegged'
                ? pegReserve(lot, lots, buyerOffset, 1n)
                : fixedReserve(lot, lots, buy, rate, 1n);
              const rs = sellerKind === 'pegged'
                ? pegReserve(lot, lots, sellerOffset, -1n)
                : fixedReserve(lot, lots, sell, rate, -1n);
              assert(max(0n, -v) <= rb && max(0n, v) <= rs);
              mixedMatchCases++;
            }
          }
        }
      }
    }
  }
}
// Against-owner rounding is actually unsafe without extra reserve: retain witness.
const adverseOldBuyerStrike = ceil(101n, 10n) * 10n;
assert(value(1000n, adverseOldBuyerStrike, 101n) < 0n);
assert.equal(pegReserve(1000n, 1n, 0n, 1n), 0n);
// Band edge can become inactive after rounding; don't silently clamp it.
const bandRate = 101n, band = 100n;
const rounded = peg(bandRate, -band, 10n, 1n);
assert((bandRate - rounded) * BPS > bandRate * band);

let feePaths = 0;
for (const f of [0n, 1n, 5n, 100n]) {
  const fee = n => ceil(n * f, BPS);
  for (const lot of [101n, 100n * UNIT]) {
    for (let mask = 0; mask < 64; mask++) {
      let remaining = 6n * lot, taker = 0n, earned = 0n, refunds = 0n;
      const original = fee(remaining);
      let escrow = original;
      for (let i = 0; i < 6; i++) {
        const charge = mask & (1 << i) ? fee(taker + lot) - fee(taker) : 0n;
        if (mask & (1 << i)) taker += lot;
        remaining -= lot;
        const retain = fee(taker + remaining) - fee(taker);
        assert(escrow >= charge + retain);
        refunds += escrow - charge - retain;
        earned += charge;
        escrow = retain;
        assert.equal(original, escrow + earned + refunds);
        assert.equal(earned, fee(taker));
      }
      assert.equal(escrow, 0n);
      feePaths++;
    }
  }
}

// Binary-search boundary is compared against an independent exhaustive grid.
function boundary(breached, side, lo, hi) {
  const adverseEnd = side === 1n ? lo : hi;
  const safeEnd = side === 1n ? hi : lo;
  if (!breached(adverseEnd)) return {kind: 'all_safe'};
  if (breached(safeEnd)) return {kind: 'all_breached'};
  let a = lo, b = hi;
  while (b - a > 1n) {
    const mid = (a + b) / 2n;
    if (side === 1n ? breached(mid) : !breached(mid)) a = mid;
    else b = mid;
  }
  return {kind: 'boundary', safe: side === 1n ? b : a, breach: side === 1n ? a : b};
}
let triggerCases = 0;
for (const n of [1n, 7n, 100n]) {
  for (const k of [1n, 17n, 50n]) {
    for (const reference of [3n, 25n, 59n]) {
      for (const equity of [0n, 1n, 25n, 120n]) {
        for (const maintenance of [1n, 20n, 150n]) {
          for (const side of [1n, -1n]) {
            const vl = value(n, k, reference);
            const breached = r => equity + side * (value(n, k, r) - vl) < maintenance;
            const grid = Array.from({length: 60}, (_, i) => BigInt(i + 1));
            const bad = grid.filter(breached), safe = grid.filter(r => !breached(r));
            const result = boundary(breached, side, 1n, 60n);
            if (!bad.length) assert.equal(result.kind, 'all_safe');
            else if (!safe.length) assert.equal(result.kind, 'all_breached');
            else {
              assert.equal(result.kind, 'boundary');
              assert.equal(result.breach, side === 1n ? bad.at(-1) : bad[0]);
              assert.equal(result.safe, side === 1n ? safe[0] : safe.at(-1));
            }
            triggerCases++;
          }
        }
      }
    }
  }
}
// Domain cases that the continuous "no finite trigger" shorthand obscures.
assert.equal(boundary(r => 0n + value(100n, 1n, r) - 90n < 20n,
  1n, 1n, 10000n).kind, 'all_breached');
assert.equal(boundary(r => 30n - (value(100n, 1n, r) - 90n) < 20n,
  -1n, 1n, 10000n).kind, 'all_safe');

console.log(JSON.stringify({payoffExamples: 'passed', idealHedgeIdentity: 'passed',
  reserveCases, mixedMatchCases, feePaths, triggerCases, status: 'passed'}, null, 2));

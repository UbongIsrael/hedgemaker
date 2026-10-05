import {ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Info, LockKeyhole} from 'lucide-react';
import {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  DEFAULT_INITIAL_MARGIN_BPS,
  DEFAULT_MAINTENANCE_MARGIN_BPS,
  buyerPayoffRaw,
  formatFixed,
  formatUsdc,
  orderReserve,
  parseUsdc,
  peggedAdverseEntryReservePerLotRaw,
  peggedStrikeRaw,
  type Side,
} from '@/domain';
import {Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, SegmentedControl} from '@/components/ui';
import {LiveOrderBook} from '@/components/LiveOrderBook';
import {DEMO_MARKET} from '@/demo/fixtures';
import {useAuth} from '@/integrations/privy/AuthProvider';
import {marketMakerRelease} from '@/content/marketMakers';

type PricingKind = 'pegged' | 'fixed';

function formatRate(raw: bigint) {
  return `₦${formatFixed(raw, 2, 6)}`;
}

function formatSignedUsdc(raw: bigint) {
  const sign = raw > 0n ? '+' : '';
  return `${sign}${formatFixed(raw, 6)} USDC`;
}

function previewErrorMessage(error: unknown): string {
  if (error instanceof SyntaxError) {
    return "Enter a whole number for the rate adjustment, such as 10 or -10.";
  }
  if (error instanceof Error) {
    switch (error.message) {
      case "Enter a positive notional.":
        return "Enter an amount greater than $0.";
      case "Use $100 whole-lot increments.":
        return "Enter a multiple of $100, such as $100 or $1,000.";
      case "Enter a plain decimal amount.":
        return "Enter a number, such as 100 or 1000, without commas or a currency symbol.";
      case "Pegged strike multiplier must be positive.":
        return "Enter a rate adjustment greater than -10,000 basis points (-100%).";
      case "Strike must be positive.":
        return "This adjustment makes the rate too low. Increase the rate adjustment.";
    }
    const precision = /^Amount supports at most (\d+) decimal places\.$/.exec(error.message);
    if (precision) return `Use no more than ${precision[1]} decimal places.`;
  }
  return "We couldn't calculate this example. Check your entries and try again.";
}

export function MarketPage() {
  const auth = useAuth();
  const [side, setSide] = useState<Side>('USD_BUYER');
  const [amount, setAmount] = useState('1000');
  const [pricing, setPricing] = useState<PricingKind>('pegged');
  const [offsetBps, setOffsetBps] = useState('0');
  const [maturity, setMaturity] = useState(DEMO_MARKET.maturities[1]?.id ?? 'oct-17');
  const [reviewOpen, setReviewOpen] = useState(false);

  const preview = useMemo(() => {
    try {
      const notionalRaw = parseUsdc(amount);
      if (notionalRaw <= 0n) throw new Error('Enter a positive notional.');
      if (notionalRaw % DEMO_MARKET.lotNotionalRaw !== 0n) {
        throw new Error('Use $100 whole-lot increments.');
      }
      const lots = notionalRaw / DEMO_MARKET.lotNotionalRaw;
      const offset = pricing === 'pegged' ? BigInt(offsetBps || '0') : 0n;
      const strikeRaw = pricing === 'pegged'
        ? peggedStrikeRaw(DEMO_MARKET.referenceRateRaw, offset, DEMO_MARKET.tickRaw, side)
        : DEMO_MARKET.referenceRateRaw;
      const adversePerLot = pricing === 'pegged'
        ? peggedAdverseEntryReservePerLotRaw(DEMO_MARKET.lotNotionalRaw, offset, side)
        : 0n;
      const reserve = orderReserve({
        notionalPerLotRaw: DEMO_MARKET.lotNotionalRaw,
        lots,
        initialMarginBps: DEFAULT_INITIAL_MARGIN_BPS,
        maintenanceMarginBps: DEFAULT_MAINTENANCE_MARGIN_BPS,
        adverseEntryReservePerLotRaw: adversePerLot,
      });
      const buyerUp = buyerPayoffRaw(notionalRaw, strikeRaw, DEMO_MARKET.referenceRateRaw + 50_000_000n);
      const buyerDown = buyerPayoffRaw(notionalRaw, strikeRaw, DEMO_MARKET.referenceRateRaw - 50_000_000n);
      return {
        error: undefined,
        notionalRaw,
        lots,
        offset,
        strikeRaw,
        initialRaw: reserve.initialMarginPerLotRaw * lots,
        maintenanceRaw: reserve.maintenanceMarginPerLotRaw * lots,
        adverseRaw: reserve.adverseEntryReservePerLotRaw * lots,
        totalReserveRaw: reserve.totalReserveRaw,
        highRateValueRaw: side === 'USD_BUYER' ? buyerUp : -buyerUp,
        lowRateValueRaw: side === 'USD_BUYER' ? buyerDown : -buyerDown,
      };
    } catch (error) {
      return {error: previewErrorMessage(error)};
    }
  }, [amount, offsetBps, pricing, side]);

  const selectedMaturity = DEMO_MARKET.maturities.find((item) => item.id === maturity);
  const activeSideLabel = side === 'USD_BUYER' ? 'Buying dollars later' : 'Selling dollars later';

  return (
    <div className="market-page page-shell">
      <header className="market-heading">
        <div>
          <Badge variant="info">Try a demo · no sign-in needed</Badge>
          <h1>Build your USD/NGN protection.</h1>
          <p>Choose the amount and date you want to protect. See an example rate and the USDC needed before signing in.</p>
        </div>
        <div className="rate-panel">
          <div><span>Sample exchange rate</span><strong>₦1,650.00</strong><small>per USD</small></div>
          <Badge variant="success">Demo rate confirmed</Badge>
          <p>{DEMO_MARKET.observedAt} · {DEMO_MARKET.source}</p>
        </div>
      </header>

      <div className="market-layout">
        <form className="ticket-panel" onSubmit={(event) => { event.preventDefault(); setReviewOpen(true); }}>
          <div className="ticket-panel__header">
            <div><span className="eyebrow">Your order preview</span><h2>What are you protecting?</h2></div>
            <Badge>Draft</Badge>
          </div>

          <SegmentedControl
            label="Choose your situation"
            value={side}
            onChange={setSide}
            options={[
              {value: 'USD_BUYER', label: 'Buying dollars later'},
              {value: 'USD_SELLER', label: 'Selling dollars later'},
            ]}
          />

          <div className="ticket-grid">
            <Field label="Amount to protect (USD)" hint="Enter multiples of $100, such as $100 or $1,000." error={preview.error}>
              <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Field>
            <Field label="Protection end date" hint={selectedMaturity?.fixing}>
              <select className="hm-input" value={maturity} onChange={(event) => setMaturity(event.target.value)}>
                {DEMO_MARKET.maturities.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.tenor}</option>)}
              </select>
            </Field>
          </div>

          <SegmentedControl
            label="How should the rate be set?"
            value={pricing}
            onChange={setPricing}
            options={[
              {value: 'pegged', label: 'Follow the exchange rate'},
              {value: 'fixed', label: 'Fixed rate limit'},
            ]}
          />

          {pricing === 'pegged' ? (
            <Field label="Rate adjustment (basis points)" hint="100 basis points = 1%. Enter a positive or negative whole number. This adjustment stays the same while any part of your order waits to match. Once matched, each position's agreed rate stays fixed.">
              <Input inputMode="numeric" value={offsetBps} onChange={(event) => setOffsetBps(event.target.value)} />
            </Field>
          ) : (
            <div className="inline-notice"><Info aria-hidden="true" /><span>This demo uses a fixed rate limit of ₦1,650.00 per USD. With a fixed-limit order, any unmatched amount becomes unavailable when a new reference rate is confirmed.</span></div>
          )}

          {!preview.error && preview.strikeRaw !== undefined && (
            <div className="ticket-summary" aria-live="polite">
              <div className="ticket-summary__primary"><span>Current rate limit</span><strong>{formatRate(preview.strikeRaw)}</strong><small>Naira per dollar · rounded in your favor</small></div>
              <dl>
                <div><dt>Required starting balance</dt><dd>{formatUsdc(preview.initialRaw ?? 0n)} USDC</dd></div>
                <div><dt>Extra collateral for rate adjustment</dt><dd>{formatUsdc(preview.adverseRaw ?? 0n)} USDC</dd></div>
                <div><dt>Trading fee</dt><dd>No trading fee in this demo</dd></div>
                <div className="ticket-summary__total"><dt>Total USDC required</dt><dd>{formatUsdc(preview.totalReserveRaw ?? 0n)} USDC</dd></div>
              </dl>
            </div>
          )}

          <div className="ticket-disclosure">
            <LockKeyhole aria-hidden="true" />
            <p>Collateral is USDC set aside to cover losses. Once your order is matched, it and any gains stay locked until the position ends. An order may never be matched. HedgeMaker settles gains and losses in USDC; it does not exchange dollars or naira.</p>
          </div>

          <Button fullWidth size="lg" type="submit" disabled={Boolean(preview.error)}>
            Review protection <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </form>

        <aside className="market-sidebar">
          <Card className="scenario-card">
            <CardHeader><div><span className="eyebrow">Example rate changes</span><CardTitle>What if the rate moves?</CardTitle></div></CardHeader>
            <CardContent>
              {!preview.error && (
                <>
                  <div className="scenario-row scenario-row--positive">
                    <ArrowUpRight aria-hidden="true" />
                    <div><span>USD/NGN rises to ₦1,700</span><strong>{formatSignedUsdc(preview.highRateValueRaw ?? 0n)}</strong><small>{side === 'USD_BUYER' ? 'Rate move in your favor' : 'Rate move against you'}</small></div>
                  </div>
                  <div className="scenario-row scenario-row--negative">
                    <ArrowDownRight aria-hidden="true" />
                    <div><span>USD/NGN falls to ₦1,600</span><strong>{formatSignedUsdc(preview.lowRateValueRaw ?? 0n)}</strong><small>{side === 'USD_SELLER' ? 'Rate move in your favor' : 'Rate move against you'}</small></div>
                  </div>
                </>
              )}
              <p className="scenario-card__note">These examples show the calculated gain or loss at each sample rate, before limits on available collateral. They do not predict when a position might close or how much you would receive.</p>
            </CardContent>
          </Card>

          <LiveOrderBook />
          <Card className="mm-market-callout"><CardContent><span className="eyebrow">For market makers</span><p>{marketMakerRelease.placements.market}</p><Link className="text-link" to="/market-makers">For market makers<ArrowRight size={15} aria-hidden="true" /></Link></CardContent></Card>
        </aside>
      </div>

      {reviewOpen && !preview.error && (
        <section className="review-panel" aria-live="polite">
          <div className="review-panel__status"><CheckCircle2 aria-hidden="true" /><span>Preview ready</span></div>
          <div><span className="eyebrow">Your plan</span><h2>{activeSideLabel} · {amount} USD</h2><p>Protection end date: {selectedMaturity?.label}. Current rate limit: {preview.strikeRaw !== undefined ? formatRate(preview.strikeRaw) : '—'} per USD.</p></div>
          <div className="review-panel__facts">
            <span><Clock3 aria-hidden="true" /> {selectedMaturity?.fixing}</span>
            <span><LockKeyhole aria-hidden="true" /> {formatUsdc(preview.totalReserveRaw ?? 0n)} USDC required</span>
          </div>
          <div className="review-panel__actions">
            {auth.authenticated ? (
              <Button disabled title="You can review an example here, but you cannot place an order.">Trading unavailable in demo</Button>
            ) : (
              <Button onClick={auth.login}>{auth.mode === 'privy' ? 'Sign in' : 'Enter demo'}</Button>
            )}
            <Link className="text-link" to="/terms">Read risks</Link>
          </div>
        </section>
      )}
    </div>
  );
}

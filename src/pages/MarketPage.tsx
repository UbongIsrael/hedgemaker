import {ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, Clock3, Info, LockKeyhole} from 'lucide-react';
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
import {DEMO_BOOK, DEMO_MARKET} from '@/demo/fixtures';
import {useAuth} from '@/integrations/privy/AuthProvider';

type PricingKind = 'pegged' | 'fixed';

function formatRate(raw: bigint) {
  return `₦${formatFixed(raw, 2, 6)}`;
}

function formatSignedUsdc(raw: bigint) {
  const sign = raw > 0n ? '+' : '';
  return `${sign}${formatFixed(raw, 6)} USDC`;
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
      return {error: error instanceof Error ? error.message : 'Unable to calculate preview.'};
    }
  }, [amount, offsetBps, pricing, side]);

  const selectedMaturity = DEMO_MARKET.maturities.find((item) => item.id === maturity);
  const activeSideLabel = side === 'USD_BUYER' ? 'I need dollars later' : 'I earn dollars';

  return (
    <div className="market-page page-shell">
      <header className="market-heading">
        <div>
          <Badge variant="info">Public preview · no sign-in required</Badge>
          <h1>Build your USD/NGN protection.</h1>
          <p>Start with the real-world outcome. We’ll translate it into the market terms and show the reserve before any wallet prompt.</p>
        </div>
        <div className="rate-panel">
          <div><span>Finalized demo rate</span><strong>₦1,650.00</strong><small>per USD</small></div>
          <Badge variant="success">Round 42 finalized</Badge>
          <p>{DEMO_MARKET.observedAt} · {DEMO_MARKET.source}</p>
        </div>
      </header>

      <div className="market-layout">
        <form className="ticket-panel" onSubmit={(event) => { event.preventDefault(); setReviewOpen(true); }}>
          <div className="ticket-panel__header">
            <div><span className="eyebrow">Order ticket</span><h2>What are you protecting?</h2></div>
            <Badge>Draft</Badge>
          </div>

          <SegmentedControl
            label="Choose your situation"
            value={side}
            onChange={setSide}
            options={[
              {value: 'USD_BUYER', label: 'I need dollars later'},
              {value: 'USD_SELLER', label: 'I earn dollars'},
            ]}
          />

          <div className="ticket-grid">
            <Field label="Reference USD amount ($)" hint="Whole $100 lots" error={preview.error}>
              <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Field>
            <Field label="Listed maturity" hint={selectedMaturity?.fixing}>
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
              {value: 'pegged', label: 'Follow reference'},
              {value: 'fixed', label: 'Fixed limit'},
            ]}
          />

          {pricing === 'pegged' ? (
            <Field label="Offset from reference (BPS)" hint="Signed basis points. The offset stays fixed while an unfilled order is live.">
              <Input inputMode="numeric" value={offsetBps} onChange={(event) => setOffsetBps(event.target.value)} />
            </Field>
          ) : (
            <div className="inline-notice"><Info aria-hidden="true" /><span>The first fixed-order prototype binds to round 42 at ₦1,650.00. A new finalized round invalidates its unfilled remainder.</span></div>
          )}

          {!preview.error && preview.strikeRaw !== undefined && (
            <div className="ticket-summary" aria-live="polite">
              <div className="ticket-summary__primary"><span>Effective strike now</span><strong>{formatRate(preview.strikeRaw)}</strong><small>NGN per USD · owner-protective tick rounding</small></div>
              <dl>
                <div><dt>Initial collateral</dt><dd>{formatUsdc(preview.initialRaw ?? 0n)} USDC</dd></div>
                <div><dt>Entry reserve</dt><dd>{formatUsdc(preview.adverseRaw ?? 0n)} USDC</dd></div>
                <div><dt>Protocol fee</dt><dd><s>5 BPS ref.</s> 0 testnet</dd></div>
                <div className="ticket-summary__total"><dt>Total wallet pull</dt><dd>{formatUsdc(preview.totalReserveRaw ?? 0n)} USDC</dd></div>
              </dl>
            </div>
          )}

          <div className="ticket-disclosure">
            <LockKeyhole aria-hidden="true" />
            <p>Collateral and gains remain locked until a terminal outcome. This preview does not guarantee a fill or conversion rate.</p>
          </div>

          <Button fullWidth size="lg" type="submit" disabled={Boolean(preview.error)}>
            Review protection <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </form>

        <aside className="market-sidebar">
          <Card className="scenario-card">
            <CardHeader><div><span className="eyebrow">Illustrative next fixing</span><CardTitle>What if the rate moves?</CardTitle></div></CardHeader>
            <CardContent>
              {!preview.error && (
                <>
                  <div className="scenario-row scenario-row--positive">
                    <ArrowUpRight aria-hidden="true" />
                    <div><span>USD/NGN rises to ₦1,700</span><strong>{formatSignedUsdc(preview.highRateValueRaw ?? 0n)}</strong><small>{side === 'USD_BUYER' ? 'Favorable to your side' : 'Adverse to your side'}</small></div>
                  </div>
                  <div className="scenario-row scenario-row--negative">
                    <ArrowDownRight aria-hidden="true" />
                    <div><span>USD/NGN falls to ₦1,600</span><strong>{formatSignedUsdc(preview.lowRateValueRaw ?? 0n)}</strong><small>{side === 'USD_SELLER' ? 'Favorable to your side' : 'Adverse to your side'}</small></div>
                  </div>
                </>
              )}
              <p className="scenario-card__note">Single-round contractual examples before collateral caps. They do not predict liquidation or final payout.</p>
            </CardContent>
          </Card>

          <Card className="depth-card">
            <CardHeader><div><span className="eyebrow">Local demo fixture</span><CardTitle>Indicative depth</CardTitle></div><Badge variant="warning">Not live</Badge></CardHeader>
            <CardContent>
              <div className="depth-table" role="table" aria-label="Illustrative order book depth">
                <div className="depth-table__head" role="row"><span role="columnheader">Buyers</span><span role="columnheader">Strike</span><span role="columnheader">Sellers</span></div>
                {[0, 1, 2].map((index) => {
                  const buyer = DEMO_BOOK.buyers[index];
                  const seller = DEMO_BOOK.sellers[index];
                  return <div className="depth-table__row" role="row" key={index}><span>{buyer?.notional}</span><strong>{buyer?.strike} / {seller?.strike}</strong><span>{seller?.notional}</span></div>;
                })}
              </div>
              <div className="inline-notice inline-notice--compact"><CircleAlert aria-hidden="true" /><span>No counterparty is guaranteed. Unmatched size rests until filled, cancelled, invalidated, or expired.</span></div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {reviewOpen && !preview.error && (
        <section className="review-panel" aria-live="polite">
          <div className="review-panel__status"><CheckCircle2 aria-hidden="true" /><span>Preview ready</span></div>
          <div><span className="eyebrow">Your intent</span><h2>{activeSideLabel} · {amount} USD</h2><p>{selectedMaturity?.label} maturity at an effective {preview.strikeRaw !== undefined ? formatRate(preview.strikeRaw) : '—'} strike.</p></div>
          <div className="review-panel__facts">
            <span><Clock3 aria-hidden="true" /> {selectedMaturity?.fixing}</span>
            <span><LockKeyhole aria-hidden="true" /> {formatUsdc(preview.totalReserveRaw ?? 0n)} USDC reserve</span>
          </div>
          <div className="review-panel__actions">
            {auth.authenticated ? (
              <Button disabled title="A verified protocol deployment is required before writes can be enabled.">Protocol writes not configured</Button>
            ) : (
              <Button onClick={auth.login}>{auth.mode === 'privy' ? 'Sign in with Privy' : 'Enter local demo'}</Button>
            )}
            <Link className="text-link" to="/terms">Read risks</Link>
          </div>
        </section>
      )}
    </div>
  );
}

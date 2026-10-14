import {ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Info, LockKeyhole, RefreshCw, TriangleAlert} from 'lucide-react';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {keccak256, stringToHex, type Hex} from 'viem';
import {
  buyerPayoffRaw,
  cumulativeFeeRaw,
  fixedAdverseEntryReservePerLotRaw,
  formatFixed,
  formatUsdc,
  orderReserve,
  parseFixed,
  parseUsdc,
  peggedAdverseEntryReservePerLotRaw,
  peggedStrikeRaw,
  type Side,
} from '@/domain';
import {Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, SegmentedControl} from '@/components/ui';
import {LiveOrderBook} from '@/components/LiveOrderBook';
import {marketMakerRelease} from '@/content/marketMakers';
import {
  buildPlaceOrder,
  buildSettlementTokenApproval,
  type BuiltPlaceOrder,
  type OrderPriceType,
} from '@/integrations/contracts/transactionBuilders';
import {useLiveOrderBook} from '@/integrations/contracts/useLiveOrderBook';
import {useMarketMakerPortfolio} from '@/integrations/contracts/useMarketMakerPortfolio';
import {useProtocolTransaction} from '@/integrations/contracts/useProtocolTransaction';
import {useAuth} from '@/integrations/privy/AuthProvider';

function formatRate(raw: bigint) {
  return `₦${formatFixed(raw, 2, 6)}`;
}

function formatSignedUsdc(raw: bigint) {
  const sign = raw > 0n ? '+' : '';
  return `${sign}${formatFixed(raw, 6)} mUSDC`;
}

function previewErrorMessage(error: unknown, lotNotionalRaw?: bigint): string {
  if (error instanceof SyntaxError) return 'Enter a valid whole-number rate adjustment.';
  if (error instanceof Error) {
    if (error.message === 'Enter a positive notional.') return 'Enter an amount greater than $0.';
    if (error.message === 'Use whole-lot increments.') return `Enter a multiple of $${lotNotionalRaw ? formatUsdc(lotNotionalRaw) : 'the configured lot size'}.`;
    if (error.message === 'Enter a plain decimal amount.') return 'Enter a number without commas or a currency symbol.';
    return error.message;
  }
  return 'The order could not be calculated from current chain state.';
}

type TicketPreview = {
  ok: true;
  notionalRaw: bigint;
  lots: number;
  effectiveStrikeRaw: bigint;
  initialRaw: bigint;
  adverseRaw: bigint;
  feeRaw: bigint;
  totalRequiredRaw: bigint;
  highRate: bigint;
  lowRate: bigint;
  highRateValueRaw: bigint;
  lowRateValueRaw: bigint;
} | {
  ok: false;
  error: string;
};

interface PreparedOrderReview {
  built: BuiltPlaceOrder;
  walletAddress: string;
  sideLabel: string;
  amountLabel: string;
  fixingLabel: string;
  seriesId: Hex;
  configVersion: bigint;
  roundId: bigint;
  referenceRateRaw: bigint;
}

export function MarketPage() {
  const auth = useAuth();
  const book = useLiveOrderBook();
  const portfolio = useMarketMakerPortfolio(auth.walletReady ? auth.walletAddress : undefined);
  const transaction = useProtocolTransaction();
  const [side, setSide] = useState<Side>('USD_BUYER');
  const [amount, setAmount] = useState('');
  const [pricing, setPricing] = useState<OrderPriceType>('pegged');
  const [offsetBps, setOffsetBps] = useState('0');
  const [rateLimit, setRateLimit] = useState('');
  const [review, setReview] = useState<PreparedOrderReview>();
  const [reviewError, setReviewError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();

  const data = book.data;
  const config = data?.config;
  const series = data?.selectedSeries;
  const marketReady = Boolean(
    data?.activeVersion
      && config
      && series
      && data.roundId
      && data.referenceRateRaw
      && data.tradingOpen
      && !data.matchingPaused,
  );

  const amountInput = amount || (config ? formatUsdc(config.lotNotionalRaw) : '');
  const rateLimitInput = rateLimit || (data?.referenceRateRaw ? formatFixed(data.referenceRateRaw, 2, 6) : '');
  const preview: TicketPreview | undefined = (() => {
    if (!config || !data?.referenceRateRaw) return undefined;
    try {
      const notionalRaw = parseUsdc(amountInput);
      if (notionalRaw <= 0n) throw new Error('Enter a positive notional.');
      if (notionalRaw % config.lotNotionalRaw !== 0n) throw new Error('Use whole-lot increments.');
      const lots = notionalRaw / config.lotNotionalRaw;
      if (lots > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('The order size is too large.');
      const offset = pricing === 'pegged' ? BigInt(offsetBps || '0') : 0n;
      const enteredLimit = parseFixed(rateLimitInput);
      const effectiveStrikeRaw = pricing === 'pegged'
        ? peggedStrikeRaw(data.referenceRateRaw, offset, config.tickSizeRaw, side)
        : enteredLimit;
      const adversePerLot = pricing === 'pegged'
        ? peggedAdverseEntryReservePerLotRaw(config.lotNotionalRaw, offset, side)
        : fixedAdverseEntryReservePerLotRaw(config.lotNotionalRaw, enteredLimit, data.referenceRateRaw, side);
      const reserve = orderReserve({
        notionalPerLotRaw: config.lotNotionalRaw,
        lots,
        initialMarginBps: BigInt(config.initialMarginBps),
        maintenanceMarginBps: BigInt(config.maintenanceMarginBps),
        adverseEntryReservePerLotRaw: adversePerLot,
      });
      const feeRaw = cumulativeFeeRaw(notionalRaw, BigInt(config.effectiveTakerFeeBps));
      const scenarioMove = data.referenceRateRaw * 300n / 10_000n;
      const highRate = data.referenceRateRaw + scenarioMove;
      const lowRate = data.referenceRateRaw > scenarioMove ? data.referenceRateRaw - scenarioMove : 1n;
      const buyerHigh = buyerPayoffRaw(notionalRaw, effectiveStrikeRaw, highRate);
      const buyerLow = buyerPayoffRaw(notionalRaw, effectiveStrikeRaw, lowRate);
      return {
        ok: true,
        notionalRaw,
        lots: Number(lots),
        effectiveStrikeRaw,
        initialRaw: reserve.initialMarginPerLotRaw * lots,
        adverseRaw: reserve.adverseEntryReservePerLotRaw * lots,
        feeRaw,
        totalRequiredRaw: reserve.totalReserveRaw + feeRaw,
        highRate,
        lowRate,
        highRateValueRaw: side === 'USD_BUYER' ? buyerHigh : -buyerHigh,
        lowRateValueRaw: side === 'USD_BUYER' ? buyerLow : -buyerLow,
      };
    } catch (error) {
      return {ok: false, error: previewErrorMessage(error, config.lotNotionalRaw)};
    }
  })();

  const selectedDate = series ? new Date(Number(series.fixingAt) * 1_000) : undefined;
  const transactionPending = transaction.status === 'awaiting_signature' || transaction.status === 'confirming';
  const clearPreparedReview = () => {
    setReview(undefined);
    setReviewError(undefined);
    setSubmitError(undefined);
    transaction.reset();
  };

  const prepareReview = () => {
    setReview(undefined);
    setReviewError(undefined);
    setSubmitError(undefined);
    if (!marketReady || !data?.roundId || !data.referenceRateRaw || !config || !series || !preview?.ok) {
      setReviewError('The market must have an active configuration, listed maturity, and fresh finalized oracle round.');
      return;
    }
    try {
      const maxLifetimeEnd = data.blockTimestamp + BigInt(config.maxOrderLifetime);
      const validUntil = maxLifetimeEnd < series.fixingAt ? maxLifetimeEnd : series.fixingAt - 1n;
      const submitByCandidate = data.blockTimestamp + 120n;
      const submitBy = submitByCandidate < validUntil ? submitByCandidate : validUntil;
      const built = buildPlaceOrder({
        intentId: keccak256(stringToHex(globalThis.crypto.randomUUID())),
        seriesId: series.seriesId,
        side,
        priceType: pricing,
        timeInForce: 'rest',
        lots: preview.lots,
        minimumImmediateFillLots: 0,
        validUntil,
        submitBy,
        limitStrikeRaw: parseFixed(rateLimitInput),
        offsetBps: pricing === 'pegged' ? Number(offsetBps) : 0,
        lastExecutableRoundId: pricing === 'pegged'
          ? data.roundId + BigInt(Math.min(config.maxPegLifetimeRounds, 5))
          : 0n,
      }, {
        blockNumber: data.blockNumber,
        blockTimestamp: data.blockTimestamp,
        configVersion: data.activeVersion,
        roundId: data.roundId,
        referenceRateRaw: data.referenceRateRaw,
        tradingOpen: data.tradingOpen,
        matchingPaused: data.matchingPaused,
        series,
        config,
      });
      setReview({
        built,
        walletAddress: auth.walletAddress?.toLowerCase() ?? '',
        sideLabel: side === 'USD_BUYER' ? 'Buying dollars later' : 'Selling dollars later',
        amountLabel: amountInput,
        fixingLabel: selectedDate?.toLocaleString() ?? 'Unknown',
        seriesId: series.seriesId,
        configVersion: data.activeVersion,
        roundId: data.roundId,
        referenceRateRaw: data.referenceRateRaw,
      });
    } catch (error) {
      setReviewError(previewErrorMessage(error, config.lotNotionalRaw));
    }
  };

  const placeOrder = async () => {
    if (!review || !portfolio.data) return;
    setSubmitError(undefined);
    const currentWallet = auth.walletAddress?.toLowerCase() ?? '';
    if (
      !data || !data.selectedSeries || !data.roundId || !data.referenceRateRaw
        || review.walletAddress !== currentWallet
        || review.seriesId !== data.selectedSeries.seriesId
        || review.configVersion !== data.activeVersion
        || review.roundId !== data.roundId
        || review.referenceRateRaw !== data.referenceRateRaw
        || !data.tradingOpen || data.matchingPaused
        || data.blockTimestamp > BigInt(String(review.built.transaction.decodedIntent.submitBy))
    ) {
      setReview(undefined);
      setSubmitError('The wallet or live market state changed. Review a fresh order before signing.');
      return;
    }
    if (portfolio.data.walletBalanceRaw < review.built.preview.maxTokenPullRaw) {
      setSubmitError(`Your wallet needs ${formatUsdc(review.built.preview.maxTokenPullRaw)} mUSDC for this order.`);
      return;
    }
    try {
      if (portfolio.data.vaultAllowanceRaw < review.built.preview.maxTokenPullRaw) {
        await transaction.submit(buildSettlementTokenApproval(review.built.preview.maxTokenPullRaw));
        await portfolio.refresh();
        setReview(undefined);
        setSubmitError('Approval confirmed. Review the order again so its short submission window uses fresh chain state.');
        return;
      }
      await transaction.submit(review.built.transaction);
      portfolio.refresh();
      book.refresh();
      setReview(undefined);
    } catch {
      // The transaction hook exposes a user-safe error and leaves the review intact for inspection.
    }
  };

  return (
    <div className="market-page page-shell">
      <header className="market-heading">
        <div>
          <Badge variant={marketReady ? 'success' : 'warning'}>{marketReady ? 'Live Monad market' : 'Market setup required'}</Badge>
          <h1>Build your USD/NGN protection.</h1>
          <p>Every rate, maturity, limit, balance, and order below comes from the deployed testnet contracts.</p>
        </div>
        <div className="rate-panel">
          <div><span>Latest finalized oracle rate</span><strong>{data?.referenceRateRaw ? formatRate(data.referenceRateRaw) : '—'}</strong><small>per USD</small></div>
          <Badge variant={data?.tradingOpen ? 'success' : 'warning'}>{data?.tradingOpen ? 'Trading open' : 'Trading closed'}</Badge>
          <p>Round {data?.roundId?.toString() ?? '—'} · block {data?.blockNumber.toString() ?? '—'}</p>
        </div>
      </header>

      {book.loading && <div className="live-book__state" role="status"><RefreshCw className="live-book__refresh-icon" aria-hidden="true" /><div><strong>Reading market configuration</strong><p>Loading the active version, oracle round, series, and limits.</p></div></div>}
      {book.error && <div className="live-book__state live-book__state--error" role="alert"><TriangleAlert aria-hidden="true" /><div><strong>Market unavailable</strong><p>{book.error}</p></div></div>}
      {data?.activeVersion === 0n && <div className="live-book__state live-book__state--warning" role="status"><TriangleAlert aria-hidden="true" /><div><strong>No active market configuration</strong><p>The deployment is real, but the operator has not configured economics, an oracle feed, or listed maturities. No placeholder values are substituted.</p></div></div>}

      <div className="market-layout">
        <form className="ticket-panel" onSubmit={(event) => { event.preventDefault(); prepareReview(); }}>
          <div className="ticket-panel__header">
            <div><span className="eyebrow">Canonical order</span><h2>What are you protecting?</h2></div>
            <Badge>{marketReady ? 'Live draft' : 'Unavailable'}</Badge>
          </div>

          <SegmentedControl label="Choose your situation" value={side} onChange={(value) => { clearPreparedReview(); setSide(value); }} options={[{value: 'USD_BUYER', label: 'Buying dollars later'}, {value: 'USD_SELLER', label: 'Selling dollars later'}]} />

          <div className="ticket-grid">
            <Field label="Amount to protect (USD)" hint={config ? `Whole lots of $${formatUsdc(config.lotNotionalRaw)}.` : 'Waiting for configured lot size.'} error={preview && !preview.ok ? preview.error : undefined}>
              <Input inputMode="decimal" value={amountInput} onChange={(event) => { clearPreparedReview(); setAmount(event.target.value); }} disabled={!config} />
            </Field>
            <Field label="Protection end date" hint={selectedDate?.toLocaleString()}>
              <select className="hm-input" value={series?.seriesId ?? ''} onChange={(event) => { clearPreparedReview(); book.setSelectedSeriesId(event.target.value as Hex); }} disabled={!data?.series.length}>
                {!data?.series.length && <option value="">No listed maturities</option>}
                {data?.series.map((item) => <option key={item.seriesId} value={item.seriesId}>{new Date(Number(item.fixingAt) * 1_000).toLocaleString()}</option>)}
              </select>
            </Field>
          </div>

          <SegmentedControl label="How should the rate be set?" value={pricing} onChange={(value) => { clearPreparedReview(); setPricing(value); }} options={[{value: 'pegged', label: 'Follow the oracle rate'}, {value: 'fixed', label: 'Fixed rate limit'}]} />

          {pricing === 'pegged' && <Field label="Oracle-rate adjustment (basis points)" hint={config ? `Allowed range: ±${config.maxOffsetBps} bps.` : undefined}><Input inputMode="numeric" value={offsetBps} onChange={(event) => { clearPreparedReview(); setOffsetBps(event.target.value); }} disabled={!config} /></Field>}
          <Field label={pricing === 'pegged' ? 'Worst acceptable rate (NGN/USD)' : 'Fixed rate limit (NGN/USD)'} hint={config ? `Tick size: ₦${formatFixed(config.tickSizeRaw, 2, 6)}.` : undefined}><Input inputMode="decimal" value={rateLimitInput} onChange={(event) => { clearPreparedReview(); setRateLimit(event.target.value); }} disabled={!config} /></Field>
          {pricing === 'fixed' && <div className="inline-notice"><Info aria-hidden="true" /><span>A fixed order binds to the current finalized oracle round. An unmatched fixed order becomes invalid when a new round finalizes.</span></div>}

          {preview?.ok && (
            <div className="ticket-summary" aria-live="polite">
              <div className="ticket-summary__primary"><span>Effective rate limit</span><strong>{formatRate(preview.effectiveStrikeRaw)}</strong><small>Derived from the current finalized oracle round</small></div>
              <dl>
                <div><dt>Initial margin</dt><dd>{formatUsdc(preview.initialRaw)} mUSDC</dd></div>
                <div><dt>Adverse-entry reserve</dt><dd>{formatUsdc(preview.adverseRaw)} mUSDC</dd></div>
                <div><dt>Trading fee escrow</dt><dd>{formatUsdc(preview.feeRaw)} mUSDC</dd></div>
                <div className="ticket-summary__total"><dt>Maximum token pull</dt><dd>{formatUsdc(preview.totalRequiredRaw)} mUSDC</dd></div>
              </dl>
            </div>
          )}

          <div className="ticket-disclosure"><LockKeyhole aria-hidden="true" /><p>The Vault pulls approved mUSDC only when the order is submitted. There is no general deposit balance. Filled collateral stays isolated until closure; released funds become claimable before withdrawal.</p></div>
          {reviewError && <p className="hm-field__error" role="alert">{reviewError}</p>}
          <Button fullWidth size="lg" type="submit" disabled={!marketReady || !preview?.ok}>Review live order <ArrowRight size={17} aria-hidden="true" /></Button>
        </form>

        <aside className="market-sidebar">
          <Card className="scenario-card">
            <CardHeader><div><span className="eyebrow">Live-rate scenarios</span><CardTitle>What if the rate moves by 3%?</CardTitle></div></CardHeader>
            <CardContent>
              {preview?.ok ? <>
                <div className="scenario-row scenario-row--positive"><ArrowUpRight aria-hidden="true" /><div><span>USD/NGN rises to {formatRate(preview.highRate)}</span><strong>{formatSignedUsdc(preview.highRateValueRaw)}</strong><small>{side === 'USD_BUYER' ? 'Rate move in your favor' : 'Rate move against you'}</small></div></div>
                <div className="scenario-row scenario-row--negative"><ArrowDownRight aria-hidden="true" /><div><span>USD/NGN falls to {formatRate(preview.lowRate)}</span><strong>{formatSignedUsdc(preview.lowRateValueRaw)}</strong><small>{side === 'USD_SELLER' ? 'Rate move in your favor' : 'Rate move against you'}</small></div></div>
              </> : <p className="scenario-card__note">A finalized oracle rate and active configuration are required before scenarios can be calculated.</p>}
              <p className="scenario-card__note">These values are calculations from the current onchain rate, not predictions or balances.</p>
            </CardContent>
          </Card>
          <LiveOrderBook />
          <Card className="mm-market-callout"><CardContent><span className="eyebrow">For market makers</span><p>{marketMakerRelease.placements.market}</p><Link className="text-link" to="/market-makers">For market makers<ArrowRight size={15} aria-hidden="true" /></Link></CardContent></Card>
        </aside>
      </div>

      {review && (
        <section className="review-panel" aria-live="polite">
          <div className="review-panel__status"><CheckCircle2 aria-hidden="true" /><span>Built from block {review.built.transaction.decodedIntent.snapshotBlock}</span></div>
          <div><span className="eyebrow">Your live order</span><h2>{review.sideLabel} · {review.amountLabel} USD</h2><p>Fixing: {review.fixingLabel}. Effective rate: {formatRate(review.built.preview.effectiveStrikeRaw)} per USD.</p></div>
          <div className="review-panel__facts"><span><Clock3 aria-hidden="true" /> Oracle round {review.built.transaction.decodedIntent.oracleRound}</span><span><LockKeyhole aria-hidden="true" /> Up to {formatUsdc(review.built.preview.maxTokenPullRaw)} mUSDC</span></div>
          <div className="review-panel__actions">
            {auth.authenticated ? <Button onClick={placeOrder} disabled={!portfolio.data || transactionPending}>{transactionPending ? 'Confirm in wallet…' : portfolio.data && portfolio.data.vaultAllowanceRaw < review.built.preview.maxTokenPullRaw ? 'Approve vault' : 'Place order'}</Button> : <Button onClick={auth.login}>{auth.mode === 'privy' ? 'Sign in, then review again' : 'Sign-in unavailable'}</Button>}
            <Link className="text-link" to="/terms">Read risks</Link>
          </div>
          {(submitError || transaction.error) && <p className="hm-field__error" role="alert">{submitError ?? transaction.error}</p>}
        </section>
      )}
    </div>
  );
}

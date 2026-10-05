import {
  CheckCircle2,
  Clipboard,
  Code2,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import {useMemo, useState, type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {isAddress, keccak256, stringToHex, type Hex} from 'viem';
import {Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input} from '@/components/ui';
import {PageMetadata} from '@/components/PageMetadata';
import {formatFixed, formatUsdc, parseFixed} from '@/domain';
import {protocolReadConfig} from '@/integrations/contracts/config';
import {useLiveOrderBook} from '@/integrations/contracts/useLiveOrderBook';
import {useMarketMakerPortfolio} from '@/integrations/contracts/useMarketMakerPortfolio';
import {
  buildPlaceOrder,
  type BuiltPlaceOrder,
  type OrderPriceType,
  type OrderTimeInForce,
} from '@/integrations/contracts/transactionBuilders';
import {useAuth} from '@/integrations/privy/AuthProvider';

function compactAddress(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function readinessLabel(ready: boolean) {
  return ready ? <><CheckCircle2 aria-hidden="true" />Available</> : <><TriangleAlert aria-hidden="true" />Waiting</>;
}

function formatRate(raw: bigint) {
  return `₦${formatFixed(raw, 2, 6)}`;
}

export function MarketMakerIntegrationPage() {
  const auth = useAuth();
  const book = useLiveOrderBook();
  const [walletInput, setWalletInput] = useState('');
  const [portfolioOwner, setPortfolioOwner] = useState<string>();
  const portfolio = useMarketMakerPortfolio(portfolioOwner);
  const [side, setSide] = useState<'USD_BUYER' | 'USD_SELLER'>('USD_BUYER');
  const [priceType, setPriceType] = useState<OrderPriceType>('fixed');
  const [timeInForce, setTimeInForce] = useState<OrderTimeInForce>('rest');
  const [lots, setLots] = useState('1');
  const [minimumFillLots, setMinimumFillLots] = useState('0');
  const [rateLimit, setRateLimit] = useState('');
  const [offsetBps, setOffsetBps] = useState('0');
  const [lifetimeMinutes, setLifetimeMinutes] = useState('15');
  const [buildResult, setBuildResult] = useState<BuiltPlaceOrder>();
  const [buildError, setBuildError] = useState<string>();
  const [copied, setCopied] = useState(false);

  const selectedSeries = book.data?.selectedSeries;
  const canBuild = Boolean(
    selectedSeries
      && book.data?.config
      && book.data.roundId
      && book.data.referenceRateRaw
      && book.data.tradingOpen
      && !book.data.matchingPaused,
  );
  const transactionTargetsReady = Boolean(
    protocolReadConfig.chainId
      && protocolReadConfig.orderBookAddress
      && protocolReadConfig.positionManagerAddress
      && protocolReadConfig.settlementTokenAddress
      && protocolReadConfig.vaultAddress,
  );
  const outputJson = useMemo(() => buildResult ? JSON.stringify({
    transaction: buildResult.transaction,
    preview: Object.fromEntries(
      Object.entries(buildResult.preview).map(([key, value]) => [
        key,
        typeof value === 'bigint' ? value.toString() : value,
      ]),
    ),
  }, null, 2) : '', [buildResult]);

  const loadPortfolio = (event: FormEvent) => {
    event.preventDefault();
    const candidate = walletInput.trim();
    if (!isAddress(candidate)) {
      setPortfolioOwner(undefined);
      return;
    }
    setPortfolioOwner(candidate);
  };

  const useConnectedWallet = () => {
    if (!auth.walletAddress || !isAddress(auth.walletAddress)) return;
    setWalletInput(auth.walletAddress);
    setPortfolioOwner(auth.walletAddress);
  };

  const buildOrder = (event: FormEvent) => {
    event.preventDefault();
    setBuildError(undefined);
    setBuildResult(undefined);
    const data = book.data;
    if (!data?.config || !data.selectedSeries || !data.roundId || !data.referenceRateRaw) {
      setBuildError('An active configuration, maturity, and finalized oracle round are required.');
      return;
    }
    try {
      const lifetimeSeconds = BigInt(lifetimeMinutes) * 60n;
      const validUntil = data.blockTimestamp + lifetimeSeconds;
      const submitBy = data.blockTimestamp + (lifetimeSeconds < 120n ? lifetimeSeconds : 120n);
      const result = buildPlaceOrder({
        intentId: keccak256(stringToHex(globalThis.crypto.randomUUID())),
        seriesId: data.selectedSeries.seriesId,
        side,
        priceType,
        timeInForce,
        lots: Number(lots),
        minimumImmediateFillLots: Number(minimumFillLots),
        validUntil,
        submitBy,
        limitStrikeRaw: parseFixed(rateLimit),
        offsetBps: priceType === 'fixed' ? 0 : Number(offsetBps),
        lastExecutableRoundId: priceType === 'pegged'
          ? data.roundId + BigInt(Math.min(data.config.maxPegLifetimeRounds, 5))
          : 0n,
      }, {
        blockNumber: data.blockNumber,
        blockTimestamp: data.blockTimestamp,
        configVersion: data.activeVersion,
        roundId: data.roundId,
        referenceRateRaw: data.referenceRateRaw,
        tradingOpen: data.tradingOpen,
        matchingPaused: data.matchingPaused,
        series: data.selectedSeries,
        config: data.config,
      });
      setBuildResult(result);
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : 'The order could not be prepared.');
    }
  };

  const copyOutput = async () => {
    if (!outputJson) return;
    await navigator.clipboard.writeText(outputJson);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <div className="page-shell mm-integration-page">
      <PageMetadata
        title="Market-maker integration console — HedgeMaker"
        description="Canonical Monad market data, unsigned transaction preparation, and isolated inventory monitoring for HedgeMaker market makers."
      />
      <header className="mm-integration-hero">
        <div>
          <span className="eyebrow">Testnet integration pack</span>
          <h1>Quote and monitor from <em>canonical chain state.</em></h1>
          <p>Inspect one-block snapshots, prepare reviewable unsigned calldata, and reconcile each isolated order and position. This console never signs or submits a transaction.</p>
        </div>
        <div className="mm-integration-hero__actions">
          <Link className="hm-button hm-button--secondary hm-button--md" to="/market-makers/guide#integration">Read integration guide</Link>
          <Link className="text-link" to="/market">View public order book</Link>
        </div>
      </header>

      <section className="mm-readiness" aria-labelledby="integration-readiness-title">
        <div className="section-heading">
          <span className="eyebrow">Release boundary</span>
          <h2 id="integration-readiness-title">What is usable now</h2>
        </div>
        <div className="mm-readiness__grid">
          <Card><CardContent><strong>Canonical market reads</strong><span className={book.configured ? 'mm-ready' : 'mm-waiting'}>{readinessLabel(book.configured)}</span><p>Deployment, maturity, order depth, oracle round, matching state, and snapshot block.</p></CardContent></Card>
          <Card><CardContent><strong>Unsigned transaction pack</strong><span className={transactionTargetsReady ? 'mm-ready' : 'mm-waiting'}>{readinessLabel(transactionTargetsReady)}</span><p>Exact order preview plus approval, order, claim, margin, matching, sync, and liquidation builders.</p></CardContent></Card>
          <Card><CardContent><strong>Inventory reconciliation</strong><span className={book.configured ? 'mm-ready' : 'mm-waiting'}>{readinessLabel(book.configured)}</span><p>Wallet balance, vault allowance, claims, order reserves, child-position equity, calls, and unsettled rounds.</p></CardContent></Card>
          <Card><CardContent><strong>Transfers and backstop</strong><span className="mm-deferred"><ShieldAlert aria-hidden="true" />Deferred</span><p>The current contracts have no full-leg transfer, replacement auction, reserve, or committed-capacity ABI.</p></CardContent></Card>
        </div>
        {book.data?.activeVersion === 0n && (
          <div className="live-book__state live-book__state--warning" role="status">
            <TriangleAlert aria-hidden="true" />
            <div><strong>Deployment is connected but not initialized</strong><p>Economic configuration v1, oracle schedules, and listed series must be activated before order calldata can be prepared.</p></div>
          </div>
        )}
      </section>

      <div className="mm-integration-grid">
        <section aria-labelledby="unsigned-builder-title">
          <Card className="mm-builder-card">
            <CardHeader><div><span className="eyebrow">Exact preview</span><CardTitle id="unsigned-builder-title">Build an unsigned order</CardTitle></div><Badge variant="info">No submission</Badge></CardHeader>
            <CardContent>
              {!canBuild ? (
                <div className="live-book__state" role="status"><Code2 aria-hidden="true" /><div><strong>Builder waiting for an active market</strong><p>The form unlocks from verified configuration, series, and finalized-round data. No fixture IDs or rates are substituted.</p></div></div>
              ) : (
                <form className="mm-builder-form" onSubmit={buildOrder}>
                  <Field label="Protection end date">
                    <select className="hm-input" value={selectedSeries?.seriesId ?? ''} onChange={(event) => book.setSelectedSeriesId(event.target.value as Hex)}>
                      {book.data?.series.map((series) => <option key={series.seriesId} value={series.seriesId}>{new Date(Number(series.fixingAt) * 1_000).toLocaleString()}</option>)}
                    </select>
                  </Field>
                  <div className="mm-builder-form__split">
                    <Field label="Side"><select className="hm-input" value={side} onChange={(event) => setSide(event.target.value as typeof side)}><option value="USD_BUYER">USD buyer</option><option value="USD_SELLER">USD seller</option></select></Field>
                    <Field label="Order type"><select className="hm-input" value={priceType} onChange={(event) => setPriceType(event.target.value as OrderPriceType)}><option value="fixed">Fixed</option><option value="pegged">Reference-pegged</option></select></Field>
                  </div>
                  <div className="mm-builder-form__split">
                    <Field label="Lots" hint={book.data?.config ? `${formatUsdc(book.data.config.lotNotionalRaw)} USDC per lot` : undefined}><Input inputMode="numeric" value={lots} onChange={(event) => setLots(event.target.value)} required /></Field>
                    <Field label="Minimum immediate fill"><Input inputMode="numeric" value={minimumFillLots} onChange={(event) => setMinimumFillLots(event.target.value)} required /></Field>
                  </div>
                  <Field label={priceType === 'fixed' ? 'Fixed rate limit (NGN/USD)' : 'Protective rate limit (NGN/USD)'} hint={book.data?.referenceRateRaw ? `Current reference: ${formatRate(book.data.referenceRateRaw)}` : undefined}><Input inputMode="decimal" value={rateLimit} onChange={(event) => setRateLimit(event.target.value)} required /></Field>
                  {priceType === 'pegged' && <Field label="Reference offset (basis points)" hint="The effective rate is rounded to the configured tick in your protective direction."><Input inputMode="numeric" value={offsetBps} onChange={(event) => setOffsetBps(event.target.value)} required /></Field>}
                  <div className="mm-builder-form__split">
                    <Field label="Time in force"><select className="hm-input" value={timeInForce} onChange={(event) => setTimeInForce(event.target.value as OrderTimeInForce)}><option value="rest">REST</option><option value="ioc">Immediate or cancel</option></select></Field>
                    <Field label="Lifetime (minutes)"><Input inputMode="numeric" value={lifetimeMinutes} onChange={(event) => setLifetimeMinutes(event.target.value)} required /></Field>
                  </div>
                  {buildError && <p className="hm-field__error" role="alert">{buildError}</p>}
                  <Button type="submit" fullWidth>Prepare unsigned calldata</Button>
                </form>
              )}

              {buildResult && (
                <div className="mm-build-output" aria-live="polite">
                  <div className="mm-build-output__summary">
                    <div><span>Effective rate</span><strong>{formatRate(buildResult.preview.effectiveStrikeRaw)}</strong></div>
                    <div><span>Collateral reserve</span><strong>{formatUsdc(buildResult.preview.collateralReserveRaw)} USDC</strong></div>
                    <div><span>Fee escrow</span><strong>{formatUsdc(buildResult.preview.feeEscrowRaw)} USDC</strong></div>
                    <div><span>Maximum token pull</span><strong>{formatUsdc(buildResult.preview.maxTokenPullRaw)} USDC</strong></div>
                  </div>
                  {!buildResult.preview.currentlyExecutable && <p className="mm-build-output__warning"><TriangleAlert aria-hidden="true" />This pegged quote is currently outside its protective limit and would rest as non-executable.</p>}
                  <div className="mm-build-output__code-head"><strong>Review payload</strong><Button variant="ghost" size="sm" onClick={copyOutput}><Clipboard size={14} aria-hidden="true" />{copied ? 'Copied' : 'Copy JSON'}</Button></div>
                  <pre><code>{outputJson}</code></pre>
                  <p>The settlement-token approval must target the vault, not the order book. Rebuild after a round, configuration, or deadline change.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="inventory-monitor-title">
          <Card className="mm-portfolio-card">
            <CardHeader><div><span className="eyebrow">Address-scoped reads</span><CardTitle id="inventory-monitor-title">Monitor isolated inventory</CardTitle></div>{portfolio.data && <Badge variant={portfolio.data.marginCallCount > 0 ? 'danger' : 'success'}>{portfolio.data.marginCallCount > 0 ? `${portfolio.data.marginCallCount} calls` : 'No calls'}</Badge>}</CardHeader>
            <CardContent>
              <form className="mm-wallet-lookup" onSubmit={loadPortfolio}>
                <Field label="Market-maker wallet" error={walletInput && !isAddress(walletInput) ? 'Enter a complete EVM address.' : undefined}><Input value={walletInput} onChange={(event) => setWalletInput(event.target.value)} placeholder="0x…" autoComplete="off" /></Field>
                <div className="mm-wallet-lookup__actions"><Button type="submit" disabled={!isAddress(walletInput) || portfolio.loading}>Load inventory</Button>{auth.walletAddress && isAddress(auth.walletAddress) && <Button variant="ghost" onClick={useConnectedWallet}>Use connected wallet</Button>}</div>
              </form>

              {portfolio.loading && <div className="live-book__state" role="status"><RefreshCw className="live-book__refresh-icon" aria-hidden="true" /><div><strong>Reconciling chain history</strong><p>Reading canonical orders, positions, ledgers, and rounds at one block.</p></div></div>}
              {portfolio.error && <div className="live-book__state live-book__state--error" role="alert"><TriangleAlert aria-hidden="true" /><div><strong>Inventory unavailable</strong><p>{portfolio.error}</p></div></div>}
              {!portfolioOwner && !portfolio.loading && <div className="live-book__state"><Code2 aria-hidden="true" /><div><strong>Enter a public wallet address</strong><p>No Privy identity is queried or exposed. This view reads public onchain state only.</p></div></div>}

              {portfolio.data && (
                <div className="mm-portfolio" aria-live="polite">
                  <div className="mm-portfolio__head"><span>{compactAddress(portfolio.data.owner)}</span><Button variant="ghost" size="sm" onClick={portfolio.refresh} disabled={portfolio.refreshing}><RefreshCw className={portfolio.refreshing ? 'live-book__refresh-icon' : ''} size={14} aria-hidden="true" />Refresh</Button></div>
                  <dl className="mm-portfolio__summary">
                    <div><dt>Wallet</dt><dd>{formatUsdc(portfolio.data.walletBalanceRaw)} USDC</dd></div>
                    <div><dt>Order reserves</dt><dd>{formatUsdc(portfolio.data.reservedOrdersRaw)} USDC</dd></div>
                    <div><dt>Locked equity</dt><dd>{formatUsdc(portfolio.data.lockedPositionsRaw)} USDC</dd></div>
                    <div><dt>Claimable</dt><dd>{formatUsdc(portfolio.data.claimableRaw)} USDC</dd></div>
                    <div><dt>Open order notional</dt><dd>{formatUsdc(portfolio.data.openOrderNotionalRaw)} USD</dd></div>
                    <div><dt>Live position notional</dt><dd>{formatUsdc(portfolio.data.livePositionNotionalRaw)} USD</dd></div>
                  </dl>

                  <h3>Orders</h3>
                  {portfolio.data.orders.length === 0 ? <p className="mm-portfolio__empty">No orders were found for this deployment.</p> : <div className="mm-portfolio__table-wrap"><table><thead><tr><th scope="col">Order</th><th scope="col">Side</th><th scope="col">Fill</th><th scope="col">Reserved</th><th scope="col">Status</th></tr></thead><tbody>{portfolio.data.orders.map((order) => <tr key={order.orderId.toString()}><th scope="row">#{order.orderId.toString()}</th><td>{order.side}</td><td>{order.lotsFilled}/{order.lotsTotal} lots</td><td>{formatUsdc(order.collateralReservedRaw + order.feeEscrowRaw)} USDC</td><td>{order.status}</td></tr>)}</tbody></table></div>}

                  <h3>Child positions</h3>
                  {portfolio.data.positions.length === 0 ? <p className="mm-portfolio__empty">No bilateral child positions were found.</p> : <div className="mm-portfolio__table-wrap"><table><thead><tr><th scope="col">Position</th><th scope="col">Exposure</th><th scope="col">Equity / maintenance</th><th scope="col">Rounds behind</th><th scope="col">Call</th></tr></thead><tbody>{portfolio.data.positions.map((position) => <tr key={position.positionId.toString()}><th scope="row">#{position.positionId.toString()}</th><td>{position.side} · {formatUsdc(position.notionalRaw)} USD</td><td>{formatUsdc(position.equityRaw)} / {formatUsdc(position.maintenanceMarginRaw)}</td><td>{position.unsettledRounds.toString()}</td><td>{position.marginCallDeadline === 0n ? 'None' : `${formatUsdc(position.cureAmountRaw)} USDC due`}</td></tr>)}</tbody></table></div>}

                  <p className="live-book__provenance">Block {portfolio.data.blockNumber.toString()} · {portfolio.data.blockHash.slice(0, 12)}… · auto-refreshes every 30 seconds. Notifications are not a rescue guarantee.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <section className="mm-operator-notes" aria-labelledby="operator-notes-title">
        <span className="eyebrow">Operator boundary</span><h2 id="operator-notes-title">Polling remains the source of truth.</h2>
        <div><p>Reconcile events against pinned contract reads after reconnects and reorgs. A submitted transaction is not final merely because it has a hash. Repeat bounded matching and settlement calls only after refreshing current state.</p><p>Builders are scoped to the versioned Monad deployment and never accept arbitrary targets or RPC URLs. They return calldata for wallet or policy review; ownership and authorization are still enforced by the contracts.</p><p>Position transfers, public auctions, backstop capacity, websocket feeds, signed alerts, sponsorship, and service-level guarantees remain outside this release.</p></div>
      </section>
    </div>
  );
}

import {RefreshCw, RadioTower, TriangleAlert} from 'lucide-react';
import type {HTMLAttributes, ReactNode} from 'react';
import type {Hex} from 'viem';
import {formatFixed, formatUsdc} from '@/domain';
import {Badge, Button, Card, CardContent, CardHeader, CardTitle} from '@/components/ui';
import {Link} from 'react-router-dom';
import {marketMakerRelease} from '@/content/marketMakers';
import {useLiveOrderBook} from '@/integrations/contracts/useLiveOrderBook';
import type {LiveBookLevel, LiveSeriesSummary} from '@/integrations/contracts/orderBook';

function formatRate(raw: bigint): string {
  return `₦${formatFixed(raw, 2, 6)}`;
}

function formatNotional(raw: bigint): string {
  return `$${formatUsdc(raw)}`;
}

function compactId(value: Hex): string {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function formatFixing(series: LiveSeriesSummary): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: 'short',
  }).format(new Date(Number(series.fixingAt) * 1_000));
}

function formatBookSide(
  notionalRaw: bigint,
  orderCount: number,
  cumulativeRaw: bigint,
): ReactNode {
  if (orderCount === 0) return <span className="live-book__empty-cell">—</span>;
  return (
    <span className="live-book__depth">
      <strong>{formatNotional(notionalRaw)}</strong>
      <small>{orderCount} {orderCount === 1 ? 'order' : 'orders'} · {formatNotional(cumulativeRaw)} cumulative</small>
    </span>
  );
}

function BookRows({levels}: {levels: LiveBookLevel[]}) {
  return levels.map((level) => (
    <tr key={level.strikeRaw.toString()}>
      <td>{formatBookSide(
        level.buyerNotionalRaw,
        level.buyerOrderCount,
        level.cumulativeBuyerNotionalRaw,
      )}</td>
      <th scope="row">{formatRate(level.strikeRaw)}</th>
      <td>{formatBookSide(
        level.sellerNotionalRaw,
        level.sellerOrderCount,
        level.cumulativeSellerNotionalRaw,
      )}</td>
    </tr>
  ));
}

export type LiveOrderBookProps = HTMLAttributes<HTMLElement>;

export function LiveOrderBook({className = '', ...props}: LiveOrderBookProps) {
  const book = useLiveOrderBook();
  const data = book.data;
  const selectedSeriesId = book.selectedSeriesId ?? data?.selectedSeries?.seriesId ?? '';
  const statusText = book.loading
    ? 'Loading the live Monad order book.'
    : book.refreshing
      ? 'Refreshing the live Monad order book.'
      : book.error
        ? book.error
        : data
          ? `Order book updated at block ${data.blockNumber.toString()}.`
          : 'Live order book is not configured.';

  return (
    <Card className={['depth-card', 'live-book', className].filter(Boolean).join(' ')} aria-labelledby="live-book-title" {...props}>
      <CardHeader className="live-book__header">
        <div>
          <span className="eyebrow">Monad testnet</span>
          <CardTitle id="live-book-title">Live orders by rate</CardTitle>
        </div>
        <div className="live-book__actions">
          <Badge variant={book.error ? 'danger' : data ? 'success' : book.loading ? 'info' : 'warning'}>
            {book.error ? 'Unavailable' : data ? 'Chain snapshot' : book.loading ? 'Connecting' : 'Setup needed'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={book.refresh}
            disabled={!book.configured || book.loading || book.refreshing}
            aria-label="Refresh live order book"
          >
            <RefreshCw className={book.refreshing ? 'live-book__refresh-icon' : ''} size={15} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="hm-sr-only" aria-live="polite" aria-atomic="true">{statusText}</p>

        {!book.configured && (
          <div className="live-book__state" role="status">
            <RadioTower aria-hidden="true" />
            <div>
              <strong>Live reads need configuration</strong>
              <p>Add {book.missingConfiguration.join(', ')} to the public environment before deployment.</p>
            </div>
          </div>
        )}

        {book.configured && book.loading && !data && (
          <div className="live-book__state" role="status">
            <RefreshCw className="live-book__refresh-icon" aria-hidden="true" />
            <div><strong>Reading Monad</strong><p>Building one canonical block snapshot.</p></div>
          </div>
        )}

        {book.configured && book.error && !data && (
          <div className="live-book__state live-book__state--error" role="alert">
            <TriangleAlert aria-hidden="true" />
            <div><strong>Live book unavailable</strong><p>{book.error}</p></div>
          </div>
        )}

        {data && (
          <>
            {book.error && (
              <div className="live-book__state live-book__state--error" role="status">
                <TriangleAlert aria-hidden="true" />
                <div><strong>Showing the last good snapshot</strong><p>{book.error}</p></div>
              </div>
            )}

            {data.series.length > 0 && (
              <div className="live-book__series-control">
                <label htmlFor="live-book-series">Protection end date</label>
                <select
                  id="live-book-series"
                  className="hm-input"
                  value={selectedSeriesId}
                  onChange={(event) => book.setSelectedSeriesId(event.target.value as Hex)}
                >
                  {data.series.map((series) => (
                    <option key={series.seriesId} value={series.seriesId}>
                      {formatFixing(series)} · {compactId(series.seriesId)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {data.activeVersion === 0n ? (
              <div className="live-book__state" role="status">
                <RadioTower aria-hidden="true" />
                <div><strong>Market setup in progress</strong><p>The contracts are connected, but no economic configuration is active yet.</p></div>
              </div>
            ) : data.series.length === 0 ? (
              <div className="live-book__state" role="status">
                <RadioTower aria-hidden="true" />
                <div><strong>No live maturity series</strong><p>No future series is listed under configuration v{data.activeVersion.toString()}.</p></div>
              </div>
            ) : (
              <>
                <dl className="live-book__summary">
                  <div><dt>Reference rate</dt><dd>{data.referenceRateRaw ? formatRate(data.referenceRateRaw) : 'Awaiting rate'}</dd></div>
                  <div><dt>Lot size</dt><dd>{data.lotNotionalRaw ? formatNotional(data.lotNotionalRaw) : '—'}</dd></div>
                  <div><dt>Oracle round</dt><dd>{data.roundId?.toString() ?? '—'}</dd></div>
                  <div><dt>Snapshot block</dt><dd>{data.blockNumber.toString()}</dd></div>
                </dl>

                {!data.tradingOpen && (
                  <div className="live-book__state live-book__state--warning" role="status">
                    <TriangleAlert aria-hidden="true" />
                    <div><strong>Oracle trading is unavailable</strong><p>Orders remain visible for reconciliation, but none are executable until the finalized feed reopens trading.</p></div>
                  </div>
                )}

                {data.matchingPaused && (
                  <div className="live-book__state live-book__state--warning" role="status">
                    <TriangleAlert aria-hidden="true" />
                    <div><strong>New matching is paused</strong><p>Resting orders are not shown as executable while the pause is active.</p></div>
                  </div>
                )}

                {data.levels.length === 0 ? (
                  <div className="live-book__state" role="status">
                    <RadioTower aria-hidden="true" />
                    <div>
                      <strong>No executable orders</strong>
                      <p>{data.inactiveOrderCount > 0
                        ? `${data.inactiveOrderCount} resting ${data.inactiveOrderCount === 1 ? 'order is' : 'orders are'} currently ineligible.`
                        : 'This maturity has no active buyer or seller orders yet.'}</p>
                      <Link className="text-link" to="/market-makers">{marketMakerRelease.placements.empty}</Link>
                    </div>
                  </div>
                ) : (
                  <div className="live-book__table-wrap">
                    <table className="live-book__table">
                      <caption className="hm-sr-only">Executable buyer and seller depth grouped by rate</caption>
                      <thead><tr><th scope="col">Buyers</th><th scope="col">Rate</th><th scope="col">Sellers</th></tr></thead>
                      <tbody><BookRows levels={data.levels} /></tbody>
                    </table>
                  </div>
                )}

                <p className="live-book__provenance">
                  Configuration v{data.activeVersion.toString()} · {data.activeOrderCount} active onchain {data.activeOrderCount === 1 ? 'order' : 'orders'} · block {data.blockNumber.toString()} · auto-refreshes every 30 seconds
                </p>
              </>
            )}
          </>
        )}

        <div className="inline-notice inline-notice--compact">
          <TriangleAlert aria-hidden="true" />
          <span>Visible depth is a block snapshot, not a guaranteed fill. Another transaction may match or cancel an order first.</span>
        </div>
      </CardContent>
    </Card>
  );
}

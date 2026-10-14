import {ArrowUpRight, Clock3, RefreshCw, TriangleAlert, WalletCards} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, MarginBar, Stat} from '@/components/ui';
import {formatFixed, formatUsdc} from '@/domain';
import {buildCancelOrder} from '@/integrations/contracts/transactionBuilders';
import {useLiveOrderBook} from '@/integrations/contracts/useLiveOrderBook';
import {useMarketMakerPortfolio} from '@/integrations/contracts/useMarketMakerPortfolio';
import {useProtocolTransaction} from '@/integrations/contracts/useProtocolTransaction';
import {useAuth} from '@/integrations/privy/AuthProvider';

function healthPercent(equity: bigint, initial: bigint) {
  if (initial <= 0n) return 0;
  const percent = Number((equity * 100n) / initial);
  return Math.max(0, Math.min(100, percent));
}

function positionStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'active') return 'success';
  if (status === 'awaiting_final_fixing') return 'warning';
  if (status === 'liquidated' || status === 'defaulted' || status === 'oracle_closed') return 'danger';
  return 'info';
}

export function DashboardPage() {
  const auth = useAuth();
  const portfolio = useMarketMakerPortfolio(auth.walletReady ? auth.walletAddress : undefined);
  const book = useLiveOrderBook();
  const transaction = useProtocolTransaction();
  const data = portfolio.data;
  const firstPosition = data?.positions[0];
  const openOrders = data?.orders.filter((order) => order.status === 'active') ?? [];
  const livePositions = data?.positions.filter((position) => position.status === 'active' || position.status === 'awaiting_final_fixing') ?? [];
  const value = (amount?: bigint) => amount === undefined ? '—' : `${formatUsdc(amount)} mUSDC`;
  const cancelOrder = async (orderId: bigint) => {
    try {
      await transaction.submit(buildCancelOrder(orderId));
      portfolio.refresh();
      book.refresh();
    } catch {
      // The transaction hook exposes a user-safe error and preserves the snapshot.
    }
  };

  return (
    <div className="hm-page hm-dashboard" aria-labelledby="dashboard-title">
      <div className="hm-page__heading">
        <div>
          <p className="hm-eyebrow">LIVE ACCOUNT OVERVIEW</p>
          <h1 id="dashboard-title">Overview</h1>
          <p className="hm-page__description">Your wallet, orders, positions, and current USD / NGN market state from Monad.</p>
        </div>
        <Badge variant={portfolio.error || book.error ? 'danger' : 'success'}>{portfolio.error || book.error ? 'Read unavailable' : 'Canonical chain data'}</Badge>
      </div>

      {(portfolio.loading || book.loading) && (
        <div className="live-book__state" role="status"><RefreshCw className="live-book__refresh-icon" aria-hidden="true" /><div><strong>Reading Monad</strong><p>Reconciling this account and market at canonical blocks.</p></div></div>
      )}
      {(portfolio.error || book.error) && (
        <div className="live-book__state live-book__state--error" role="alert"><TriangleAlert aria-hidden="true" /><div><strong>Live account data is incomplete</strong><p>{portfolio.error ?? book.error}</p></div></div>
      )}

      <section className="hm-dashboard__stats" aria-label="Account summary" aria-busy={portfolio.loading}>
        <Stat label="mUSDC balance" value={value(data?.walletBalanceRaw)} detail="Connected wallet" />
        <Stat label="Locked in positions" value={value(data?.lockedPositionsRaw)} detail="Canonical position ledgers" />
        <Stat label="Available to withdraw" value={value(data?.claimableRaw)} detail="Canonical vault claim" />
        <Stat label="Open positions" value={data ? String(livePositions.length) : '—'} detail="Owned bilateral positions" />
      </section>

      <section className="hm-dashboard__main-grid" aria-label="Market and account details">
        <Card className="hm-market-card">
          <CardHeader>
            <div className="hm-card__title-row">
              <div><p className="hm-eyebrow">ORACLE MARKET</p><CardTitle>USD / NGN</CardTitle></div>
              <Badge variant={book.data?.tradingOpen ? 'success' : 'warning'}>{book.data?.tradingOpen ? 'Trading open' : 'Trading closed'}</Badge>
            </div>
            <CardDescription>Latest finalized oracle round and executable order depth from the deployed contracts.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hm-market-card__rate">
              <span className="hm-market-card__number">{book.data?.referenceRateRaw === undefined ? '—' : `₦${formatFixed(book.data.referenceRateRaw, 2, 6)}`}</span>
              <span className="hm-market-card__change">Finalized round {book.data?.roundId?.toString() ?? 'not available'}</span>
            </div>
            <dl className="hm-definition-list">
              <div><dt>Configuration</dt><dd>{book.data?.activeVersion ? `v${book.data.activeVersion}` : 'Not activated'}</dd></div>
              <div><dt>Snapshot block</dt><dd>{book.data?.blockNumber.toString() ?? '—'}</dd></div>
            </dl>
            <div className="hm-market-card__book">
              <h3>Executable order depth</h3>
              {book.data?.levels.length ? (
                <div className="hm-book-grid">
                  <div><h4>USD buyers</h4><ul className="hm-book-list">{book.data.levels.filter((level) => level.buyerNotionalRaw > 0n).slice(0, 3).map((level) => <li key={`b-${level.strikeRaw}`}><span>₦{formatFixed(level.strikeRaw, 2, 6)}</span><span>${formatUsdc(level.buyerNotionalRaw)}</span></li>)}</ul></div>
                  <div><h4>USD sellers</h4><ul className="hm-book-list">{book.data.levels.filter((level) => level.sellerNotionalRaw > 0n).slice(-3).map((level) => <li key={`s-${level.strikeRaw}`}><span>₦{formatFixed(level.strikeRaw, 2, 6)}</span><span>${formatUsdc(level.sellerNotionalRaw)}</span></li>)}</ul></div>
                </div>
              ) : <p className="hm-muted">No executable orders exist in the active series.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="hm-eyebrow">COLLATERAL</p>
            <CardTitle>Position health</CardTitle>
            <CardDescription>Live equity compared with the position’s configured initial and maintenance requirements.</CardDescription>
          </CardHeader>
          <CardContent>
            {firstPosition ? (
              <div className="hm-position-summary">
                <div><span className="hm-position-summary__id">#{firstPosition.positionId.toString()}</span><Badge variant={positionStatusVariant(firstPosition.status)}>{firstPosition.status.replaceAll('_', ' ')}</Badge></div>
                <p>{firstPosition.side} · {formatUsdc(firstPosition.notionalRaw)} USD notional</p>
                <MarginBar used={healthPercent(firstPosition.equityRaw, firstPosition.initialMarginRaw)} total={100} label="Initial-margin coverage" tone={firstPosition.marginCallDeadline === 0n ? 'default' : 'warning'} formatAmount={(amount) => `${amount}%`} />
                <p className="hm-muted">Equity {formatUsdc(firstPosition.equityRaw)} mUSDC · maintenance {formatUsdc(firstPosition.maintenanceMarginRaw)} mUSDC.</p>
                <Link className="hm-text-link" to={`/app/positions/${firstPosition.positionId}`}>View position <ArrowUpRight size={16} aria-hidden="true" /></Link>
              </div>
            ) : <p className="hm-muted">This wallet has no positions in the deployed protocol.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="hm-eyebrow">OPEN ORDERS</p>
            <CardTitle>{openOrders.length ? `${openOrders.length} cancellable` : 'No open orders'}</CardTitle>
            <CardDescription>Every resting order from this wallet that remains active onchain.</CardDescription>
          </CardHeader>
          <CardContent>
            {openOrders.length ? openOrders.map((order) => (
              <div className="hm-order-summary" key={order.orderId.toString()}>
                <div className="hm-card__title-row"><strong>Order #{order.orderId.toString()}</strong><Badge variant="warning">{order.status}</Badge></div>
                <dl className="hm-definition-list">
                  <div><dt>Side</dt><dd>{order.side}</dd></div>
                  <div><dt>Matched</dt><dd>{order.lotsFilled} of {order.lotsTotal} lots</dd></div>
                  <div><dt>Waiting</dt><dd>{order.lotsRemaining} lots</dd></div>
                  <div><dt>Reserved</dt><dd>{formatUsdc(order.collateralReservedRaw + order.feeEscrowRaw)} mUSDC</dd></div>
                </dl>
                <Button variant="secondary" size="sm" onClick={() => { void cancelOrder(order.orderId); }} disabled={transaction.status === 'awaiting_signature' || transaction.status === 'confirming'}>{transaction.status === 'awaiting_signature' || transaction.status === 'confirming' ? 'Confirming…' : `Cancel order #${order.orderId.toString()}`}</Button>
              </div>
            )) : <p className="hm-muted">This wallet has no active orders in this deployment.</p>}
            {transaction.error && <p className="hm-field__error" role="alert">{transaction.error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="hm-eyebrow">CHAIN RECORDS</p>
            <CardTitle>Account entities</CardTitle>
            <CardDescription>Orders and positions discovered from protocol events and verified with pinned contract reads.</CardDescription>
          </CardHeader>
          <CardContent>
            {!data || (data.orders.length === 0 && data.positions.length === 0) ? <p className="hm-muted">No protocol activity exists for this wallet.</p> : (
              <ol className="hm-activity-list">
                {data.orders.slice(0, 2).map((order) => <li key={`order-${order.orderId}`}><span className="hm-activity-list__icon" aria-hidden="true"><Clock3 size={16} /></span><div><p>Order #{order.orderId.toString()}</p><span>{order.side} · {order.status}</span></div><time>{order.lotsFilled}/{order.lotsTotal} lots</time></li>)}
                {data.positions.slice(0, 2).map((position) => <li key={`position-${position.positionId}`}><span className="hm-activity-list__icon" aria-hidden="true"><Clock3 size={16} /></span><div><p>Position #{position.positionId.toString()}</p><span>{position.side} · {position.status.replaceAll('_', ' ')}</span></div><time>{formatUsdc(position.notionalRaw)} USD</time></li>)}
              </ol>
            )}
            {data && <p className="hm-demo-note">Snapshot block {data.blockNumber.toString()} · refreshes every 30 seconds.</p>}
          </CardContent>
        </Card>
      </section>

      <aside className="hm-dashboard__wallet-link">
        <WalletCards size={20} aria-hidden="true" />
        <p>Wallet funds, order reserves, position equity, and claimable funds are separate onchain balances.</p>
        <Link className="hm-button hm-button--secondary hm-button--sm" to="/app/wallet">View wallet</Link>
      </aside>
    </div>
  );
}

import {ArrowUpRight, RefreshCw, TriangleAlert} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, MarginBar} from '@/components/ui';
import {formatFixed, formatUsdc} from '@/domain';
import {useMarketMakerPortfolio} from '@/integrations/contracts/useMarketMakerPortfolio';
import type {MarketMakerPositionView} from '@/integrations/contracts/marketMakerPortfolio';
import {useAuth} from '@/integrations/privy/AuthProvider';

function healthPercent(position: MarketMakerPositionView) {
  if (position.initialMarginRaw <= 0n) return 0;
  return Math.max(0, Math.min(100, Number((position.equityRaw * 100n) / position.initialMarginRaw)));
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'active') return 'success';
  if (status === 'awaiting_final_fixing') return 'warning';
  if (status === 'liquidated' || status === 'defaulted' || status === 'oracle_closed') return 'danger';
  return 'info';
}

export function PositionsPage() {
  const auth = useAuth();
  const portfolio = useMarketMakerPortfolio(auth.walletReady ? auth.walletAddress : undefined);
  const positions = portfolio.data?.positions ?? [];

  return (
    <div className="hm-page hm-positions-page" aria-labelledby="positions-title">
      <div className="hm-page__heading">
        <div><p className="hm-eyebrow">LIVE ACCOUNT</p><h1 id="positions-title">Positions</h1><p className="hm-page__description">Bilateral positions owned by this wallet in the deployed HedgeMaker protocol.</p></div>
        <Badge variant={portfolio.error ? 'danger' : 'success'}>{portfolio.error ? 'Read unavailable' : 'Monad testnet · live'}</Badge>
      </div>

      {portfolio.loading && <div className="live-book__state" role="status"><RefreshCw className="live-book__refresh-icon" aria-hidden="true" /><div><strong>Reading position history</strong><p>Scanning protocol events and reconciling every position at one canonical block.</p></div></div>}
      {portfolio.error && <div className="live-book__state live-book__state--error" role="alert"><TriangleAlert aria-hidden="true" /><div><strong>Positions unavailable</strong><p>{portfolio.error}</p></div></div>}

      <Card>
        <CardHeader>
          <CardTitle>Position history</CardTitle>
          <CardDescription>{portfolio.data ? `Canonical snapshot at block ${portfolio.data.blockNumber.toString()}.` : 'Waiting for a canonical account snapshot.'}</CardDescription>
        </CardHeader>
        <CardContent>
          {portfolio.data && positions.length === 0 ? (
            <div className="live-book__state"><div><strong>No positions</strong><p>This wallet has no positions in the current deployment. No placeholder rows are shown.</p></div></div>
          ) : positions.length > 0 && (
            <div className="hm-table-scroll" role="region" aria-label="Live positions" tabIndex={0}>
              <table className="hm-data-table">
                <thead><tr><th scope="col">Position</th><th scope="col">Direction / size</th><th scope="col">Agreed rate</th><th scope="col">Equity</th><th scope="col">Margin call</th><th scope="col">Status</th><th scope="col"><span className="hm-sr-only">Details</span></th></tr></thead>
                <tbody>
                  {positions.map((position) => (
                    <tr key={position.positionId.toString()}>
                      <th scope="row"><Link to={`/app/positions/${position.positionId}`} className="hm-table-link">#{position.positionId.toString()}<ArrowUpRight size={14} aria-hidden="true" /></Link><span className="hm-table-secondary">Series {position.seriesId.slice(0, 10)}…</span></th>
                      <td>{position.side}<span className="hm-table-secondary">{formatUsdc(position.notionalRaw)} USD</span></td>
                      <td>₦{formatFixed(position.strikeRaw, 2, 6)}<span className="hm-table-secondary">Entry round {position.lastRoundId.toString()}</span></td>
                      <td>{formatUsdc(position.equityRaw)} mUSDC<span className="hm-table-secondary">Maintenance {formatUsdc(position.maintenanceMarginRaw)}</span></td>
                      <td>{position.marginCallDeadline === 0n ? 'None' : `${formatUsdc(position.cureAmountRaw)} mUSDC due`}</td>
                      <td><Badge variant={statusVariant(position.status)}>{position.status.replaceAll('_', ' ')}</Badge></td>
                      <td><Link to={`/app/positions/${position.positionId}`} className="hm-text-link">Details<span className="hm-sr-only"> for position {position.positionId.toString()}</span></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {positions.length > 0 && <section className="hm-position-cards" aria-label="Position health summary">
        {positions.map((position) => (
          <Card key={`${position.positionId}-health`}>
            <CardHeader><div className="hm-card__title-row"><CardTitle>Position #{position.positionId.toString()} health</CardTitle><Badge variant={position.marginCallDeadline === 0n ? 'success' : 'warning'}>{position.marginCallDeadline === 0n ? 'No margin call' : 'Top-up required'}</Badge></div><CardDescription>Isolated position collateral from the canonical vault ledger.</CardDescription></CardHeader>
            <CardContent>
              <MarginBar used={healthPercent(position)} total={100} label="Initial-margin coverage" tone={position.marginCallDeadline === 0n ? 'default' : 'warning'} formatAmount={(amount) => `${amount}%`} />
              <dl className="hm-definition-list">
                <div><dt>Position equity</dt><dd>{formatUsdc(position.equityRaw)} mUSDC</dd></div>
                <div><dt>Initial margin</dt><dd>{formatUsdc(position.initialMarginRaw)} mUSDC</dd></div>
                <div><dt>Maintenance margin</dt><dd>{formatUsdc(position.maintenanceMarginRaw)} mUSDC</dd></div>
                <div><dt>Unsettled rounds</dt><dd>{position.unsettledRounds.toString()}</dd></div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </section>}
    </div>
  );
}

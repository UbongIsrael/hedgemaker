import {ArrowLeft, CircleHelp, RefreshCw, ShieldAlert, TriangleAlert} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import {Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, MarginBar} from '@/components/ui';
import {formatFixed, formatUsdc} from '@/domain';
import {loadMarketMakerPortfolio} from '@/integrations/contracts/marketMakerPortfolio';
import {buildAddMargin, buildSettlementTokenApproval, buildSettleRounds, buildSyncPosition} from '@/integrations/contracts/transactionBuilders';
import {useMarketMakerPortfolio} from '@/integrations/contracts/useMarketMakerPortfolio';
import {useProtocolTransaction} from '@/integrations/contracts/useProtocolTransaction';
import {useAuth} from '@/integrations/privy/AuthProvider';

function compactAddress(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function PositionDetailPage() {
  const {positionId} = useParams<{positionId: string}>();
  const auth = useAuth();
  const portfolio = useMarketMakerPortfolio(auth.walletReady ? auth.walletAddress : undefined);
  const transaction = useProtocolTransaction();
  const numericId = positionId && /^\d+$/.test(positionId) ? BigInt(positionId) : undefined;
  const position = numericId === undefined
    ? undefined
    : portfolio.data?.positions.find((item) => item.positionId === numericId);
  const transactionPending = transaction.status === 'awaiting_signature' || transaction.status === 'confirming';

  if (portfolio.loading || !auth.walletReady) {
    return <div className="hm-page"><div className="live-book__state" role="status"><RefreshCw className="live-book__refresh-icon" aria-hidden="true" /><div><strong>Reading position</strong><p>Reconciling this wallet’s canonical position history.</p></div></div></div>;
  }

  if (portfolio.error) {
    return <div className="hm-page"><div className="live-book__state live-book__state--error" role="alert"><TriangleAlert aria-hidden="true" /><div><strong>Position unavailable</strong><p>{portfolio.error}</p></div></div></div>;
  }

  if (!position) {
    return (
      <div className="hm-page" aria-labelledby="position-missing-title">
        <Link className="hm-back-link" to="/app/positions"><ArrowLeft size={16} aria-hidden="true" /> All positions</Link>
        <Card><CardHeader><CardTitle id="position-missing-title">Position not found</CardTitle><CardDescription>This connected wallet does not own position {positionId ? `#${positionId}` : ''} in the deployed protocol.</CardDescription></CardHeader><CardContent><Link className="hm-text-link" to="/app/positions">Return to positions</Link></CardContent></Card>
      </div>
    );
  }

  const ownerValueRaw = position.side === 'buyer' ? position.lastValueRaw : -position.lastValueRaw;
  const positionActionable = position.status === 'active' || position.status === 'awaiting_final_fixing';
  const health = position.initialMarginRaw === 0n
    ? 0
    : Math.max(0, Math.min(100, Number((position.equityRaw * 100n) / position.initialMarginRaw)));
  const addRequiredMargin = async () => {
    if (!portfolio.data || !auth.walletAddress || position.cureAmountRaw <= 0n) return;
    try {
      if (portfolio.data.vaultAllowanceRaw < position.cureAmountRaw) {
        await transaction.submit(buildSettlementTokenApproval(position.cureAmountRaw));
      }
      // Approval is a separate transaction. Re-read a canonical snapshot before
      // signing the state-dependent top-up so a newly settled round, ownership
      // change, or cured margin call cannot make us submit stale parameters.
      const current = await loadMarketMakerPortfolio(auth.walletAddress);
      const currentPosition = current.positions.find((item) => item.positionId === position.positionId);
      if (
        !currentPosition
        || currentPosition.side !== position.side
        || (currentPosition.status !== 'active' && currentPosition.status !== 'awaiting_final_fixing')
        || currentPosition.cureAmountRaw <= 0n
      ) {
        portfolio.refresh();
        return;
      }
      await transaction.submit(buildAddMargin(
        currentPosition.positionId,
        currentPosition.side === 'buyer',
        currentPosition.cureAmountRaw,
        currentPosition.maxSyncBatch,
        currentPosition.maxSyncBatch,
      ));
      portfolio.refresh();
    } catch {
      // The transaction hook exposes a user-safe error and preserves the current snapshot.
    }
  };
  const runPositionAction = async (kind: 'sync' | 'settle') => {
    try {
      const built = kind === 'sync'
        ? buildSyncPosition(position.positionId, position.maxSyncBatch, position.maxSyncBatch)
        : buildSettleRounds(position.positionId, position.maxSyncBatch, position.maxSyncBatch);
      await transaction.submit(built);
      portfolio.refresh();
    } catch {
      // The transaction hook exposes a user-safe error and preserves the current snapshot.
    }
  };

  return (
    <div className="hm-page hm-position-detail" aria-labelledby="position-title">
      <div className="hm-page__heading">
        <div><Link className="hm-back-link" to="/app/positions"><ArrowLeft size={16} aria-hidden="true" /> All positions</Link><p className="hm-eyebrow">LIVE POSITION</p><h1 id="position-title">#{position.positionId.toString()}</h1><p className="hm-page__description">{position.side} · {formatUsdc(position.notionalRaw)} USD notional · fixing {new Date(Number(position.fixingAt) * 1_000).toLocaleString()}</p></div>
        <Badge variant={position.marginCallDeadline === 0n ? 'success' : 'warning'}>{position.status.replaceAll('_', ' ')}</Badge>
      </div>

      <section className="hm-position-detail__grid" aria-label="Position details">
        <Card>
          <CardHeader><div className="hm-card__title-row"><CardTitle>Settled-to-round value</CardTitle><Badge variant={ownerValueRaw >= 0n ? 'success' : 'danger'}>{ownerValueRaw >= 0n ? 'Positive' : 'Negative'}</Badge></div><CardDescription>Contract value after the last processed finalized oracle round.</CardDescription></CardHeader>
          <CardContent>
            <p className="hm-position-value">{ownerValueRaw >= 0n ? '+' : '−'}{formatUsdc(ownerValueRaw >= 0n ? ownerValueRaw : -ownerValueRaw)} mUSDC</p>
            <dl className="hm-definition-list">
              <div><dt>Agreed rate</dt><dd>₦{formatFixed(position.strikeRaw, 2, 6)}</dd></div>
              <div><dt>Latest finalized rate</dt><dd>₦{formatFixed(position.latestReferenceRateRaw, 2, 6)}</dd></div>
              <div><dt>Your position equity</dt><dd>{formatUsdc(position.equityRaw)} mUSDC</dd></div>
              <div><dt>Last processed round</dt><dd>{position.lastRoundId.toString()} of latest {position.latestRoundId.toString()}</dd></div>
            </dl>
            <p className="hm-demo-note"><CircleHelp size={16} aria-hidden="true" /> Equity and value are contract reads. Unprocessed oracle rounds require a sync or settlement transaction.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Margin and risk</CardTitle><CardDescription>Isolated collateral for both sides of this bilateral position.</CardDescription></CardHeader>
          <CardContent>
            <MarginBar used={health} total={100} label="Initial-margin coverage" tone={position.marginCallDeadline === 0n ? 'default' : 'warning'} formatAmount={(amount) => `${amount}%`} />
            <dl className="hm-definition-list">
              <div><dt>Your equity</dt><dd>{formatUsdc(position.equityRaw)} mUSDC</dd></div>
              <div><dt>Initial margin</dt><dd>{formatUsdc(position.initialMarginRaw)} mUSDC</dd></div>
              <div><dt>Maintenance margin</dt><dd>{formatUsdc(position.maintenanceMarginRaw)} mUSDC</dd></div>
              <div><dt>Counterparty equity</dt><dd>{formatUsdc(position.counterpartyEquityRaw)} mUSDC</dd></div>
              <div><dt>Unpaid shortfall</dt><dd>{formatUsdc(position.unpaidShortfall)} mUSDC</dd></div>
            </dl>
            <div className="hm-preview-action">
              <Button onClick={addRequiredMargin} disabled={position.cureAmountRaw <= 0n || transactionPending}>
                <ShieldAlert size={16} aria-hidden="true" />
                {transactionPending ? 'Confirming…' : position.cureAmountRaw > 0n ? `Add ${formatUsdc(position.cureAmountRaw)} mUSDC` : 'No top-up required'}
              </Button>
              {position.marginCallDeadline > 0n && <p className="hm-muted">Margin deadline: {new Date(Number(position.marginCallDeadline) * 1_000).toLocaleString()}.</p>}
            </div>
            <div className="hm-wallet-actions">
              <Button variant="secondary" size="sm" onClick={() => { void runPositionAction('sync'); }} disabled={transactionPending || !positionActionable}>{position.unsettledRounds > 0n ? 'Sync finalized rounds' : 'Run deadline checks'}</Button>
              <Button variant="ghost" size="sm" onClick={() => { void runPositionAction('settle'); }} disabled={transactionPending || !positionActionable}>{position.unsettledRounds > 0n ? 'Settle available rounds' : 'Check final settlement'}</Button>
            </div>
            {transaction.error && <p className="hm-field__error" role="alert">{transaction.error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Position terms</CardTitle><CardDescription>Pinned onchain terms and counterparties.</CardDescription></CardHeader>
          <CardContent>
            <dl className="hm-ledger-list">
              <div><dt>Series</dt><dd title={position.seriesId}>{position.seriesId.slice(0, 12)}…</dd></div>
              <div><dt>Configuration</dt><dd>v{position.configVersion.toString()}</dd></div>
              <div><dt>Direction</dt><dd>{position.side}</dd></div>
              <div><dt>Position size</dt><dd>{formatUsdc(position.notionalRaw)} USD</dd></div>
              <div><dt>Entry rate</dt><dd>₦{formatFixed(position.strikeRaw, 2, 6)}</dd></div>
              <div><dt>Fixing time</dt><dd>{new Date(Number(position.fixingAt) * 1_000).toLocaleString()}</dd></div>
              <div><dt>Buyer</dt><dd title={position.buyer}>{compactAddress(position.buyer)}</dd></div>
              <div><dt>Seller</dt><dd title={position.seller}>{compactAddress(position.seller)}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

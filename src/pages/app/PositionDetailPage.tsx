import {ArrowLeft, CircleHelp, ShieldAlert} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';
import {Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, MarginBar} from '@/components/ui';
import {DEMO_MARKET, DEMO_POSITIONS} from '@/demo/fixtures';
import {formatFixed, formatUsdc, parseFixed, parseUsdc, payoffRaw, USD_BUYER} from '@/domain';

export function PositionDetailPage() {
  const {positionId} = useParams<{positionId: string}>();
  const position = DEMO_POSITIONS.find((item) => item.id === positionId);

  if (!position) {
    return (
      <div className="hm-page" aria-labelledby="position-missing-title">
        <Link className="hm-back-link" to="/app/positions"><ArrowLeft size={16} aria-hidden="true" /> All positions</Link>
        <Card><CardHeader><CardTitle id="position-missing-title">Position not found</CardTitle><CardDescription>No demo position matches this route.</CardDescription></CardHeader><CardContent><Link className="hm-text-link" to="/app/positions">Return to positions</Link></CardContent></Card>
      </div>
    );
  }

  const notionalRaw = parseUsdc('1000');
  const strikeRaw = DEMO_MARKET.referenceRateRaw;
  const currentRateRaw = parseFixed(position.currentRate.replace(/[₦,\s]/g, ''));
  const valueRaw = payoffRaw(USD_BUYER, notionalRaw, strikeRaw, currentRateRaw);
  const equityRaw = parseUsdc(position.initial.split(' ')[0] ?? '0') + valueRaw;

  return (
    <div className="hm-page hm-position-detail" aria-labelledby="position-title">
      <div className="hm-page__heading">
        <div><Link className="hm-back-link" to="/app/positions"><ArrowLeft size={16} aria-hidden="true" /> All positions</Link><p className="hm-eyebrow">ISOLATED POSITION · LOCAL DEMO</p><h1 id="position-title">{position.id}</h1><p className="hm-page__description">{position.side} · {position.notional} notional · {position.maturity} maturity</p></div>
        <Badge variant="warning">Testnet preview · fixture data</Badge>
      </div>

      <section className="hm-position-detail__grid" aria-label="Position details">
        <Card>
          <CardHeader><div className="hm-card__title-row"><CardTitle>Current position value</CardTitle><Badge variant="success">{position.status}</Badge></div><CardDescription>Indicative fixture calculation using the sample reference rate.</CardDescription></CardHeader>
          <CardContent>
            <p className="hm-position-value">{valueRaw >= 0n ? '+' : '−'}{formatUsdc(valueRaw >= 0n ? valueRaw : -valueRaw)} USDC</p>
            <dl className="hm-definition-list">
              <div><dt>Contract strike</dt><dd>{position.strike}</dd></div>
              <div><dt>Sample reference rate</dt><dd>₦{formatFixed(currentRateRaw, 2, 6)}</dd></div>
              <div><dt>Current isolated equity</dt><dd>{formatUsdc(equityRaw)} USDC · demo</dd></div>
              <div><dt>Reported P&amp;L fixture</dt><dd>{position.pnl}</dd></div>
            </dl>
            <p className="hm-demo-note"><CircleHelp size={16} aria-hidden="true" /> P&amp;L is an illustrative payoff, not a settled or withdrawable amount. Gains remain locked until position close.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Margin and risk</CardTitle><CardDescription>Live collateral, deadline, and cure amount require confirmed contract reads.</CardDescription></CardHeader>
          <CardContent>
            <MarginBar used={position.health} total={100} label="Demo margin health" tone="warning" formatAmount={(value) => `${value}%`} />
            <dl className="hm-definition-list">
              <div><dt>Initial margin</dt><dd>{position.initial}</dd></div>
              <div><dt>Maintenance margin</dt><dd>{position.maintenance}</dd></div>
              <div><dt>Counterparty equity</dt><dd>{position.counterpartyEquity}</dd></div>
              <div><dt>Liquidation state</dt><dd>Unavailable in preview</dd></div>
            </dl>
            <div className="hm-preview-action">
              <Button disabled><ShieldAlert size={16} aria-hidden="true" /> Add margin</Button>
              <p className="hm-muted">No transaction is available here; this page does not submit or simulate a margin top-up.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Position terms</CardTitle><CardDescription>Terms shown for illustration from the current local market fixture.</CardDescription></CardHeader>
          <CardContent>
            <dl className="hm-ledger-list">
              <div><dt>Market</dt><dd>USD / NGN</dd></div>
              <div><dt>Side</dt><dd>{position.side}</dd></div>
              <div><dt>Notional</dt><dd>{position.notional}</dd></div>
              <div><dt>Entry rate</dt><dd>{position.strike}</dd></div>
              <div><dt>Maturity</dt><dd>{position.maturity}</dd></div>
              <div><dt>Rate source</dt><dd>{DEMO_MARKET.source} · simulated</dd></div>
            </dl>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

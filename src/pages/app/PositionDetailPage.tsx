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
        <Card><CardHeader><CardTitle id="position-missing-title">Position not found</CardTitle><CardDescription>We couldn't find this position in the demo.</CardDescription></CardHeader><CardContent><Link className="hm-text-link" to="/app/positions">Return to positions</Link></CardContent></Card>
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
        <div><Link className="hm-back-link" to="/app/positions"><ArrowLeft size={16} aria-hidden="true" /> All positions</Link><p className="hm-eyebrow">POSITION · DEMO</p><h1 id="position-title">{position.id}</h1><p className="hm-page__description">{position.side} · {position.notional} position size · Ends {position.maturity}</p></div>
        <Badge variant="warning">Demo · sample data</Badge>
      </div>

      <section className="hm-position-detail__grid" aria-label="Position details">
        <Card>
          <CardHeader><div className="hm-card__title-row"><CardTitle>Estimated profit / loss</CardTitle><Badge variant="success">{position.status}</Badge></div><CardDescription>An example calculation based on the sample reference rate.</CardDescription></CardHeader>
          <CardContent>
            <p className="hm-position-value">{valueRaw >= 0n ? '+' : '−'}{formatUsdc(valueRaw >= 0n ? valueRaw : -valueRaw)} USDC</p>
            <dl className="hm-definition-list">
              <div><dt>Agreed rate</dt><dd>{position.strike}</dd></div>
              <div><dt>Sample reference rate</dt><dd>₦{formatFixed(currentRateRaw, 2, 6)}</dd></div>
              <div><dt>Current position balance</dt><dd>{formatUsdc(equityRaw)} USDC · demo</dd></div>
              <div><dt>Sample reported profit / loss</dt><dd>{position.pnl}</dd></div>
            </dl>
            <p className="hm-demo-note"><CircleHelp size={16} aria-hidden="true" /> This example profit or loss has not been settled and cannot be withdrawn. Gains stay locked until the position closes.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Margin and risk</CardTitle><CardDescription>Live collateral balances, top-up deadlines, and required top-up amounts are unavailable in this demo.</CardDescription></CardHeader>
          <CardContent>
            <MarginBar used={position.health} total={100} label="Sample collateral health" tone="warning" formatAmount={(value) => `${value}%`} />
            <dl className="hm-definition-list">
              <div><dt>Required starting balance</dt><dd>{position.initial}</dd></div>
              <div><dt>Top-up trigger balance</dt><dd>{position.maintenance}</dd></div>
              <div><dt>Other side's position balance</dt><dd>{position.counterpartyEquity}</dd></div>
              <div><dt>Forced closure status</dt><dd>Unavailable in this demo</dd></div>
            </dl>
            <div className="hm-preview-action">
              <Button disabled><ShieldAlert size={16} aria-hidden="true" /> Add collateral</Button>
              <p className="hm-muted">Adding collateral is unavailable in this demo. No funds will be added.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Position terms</CardTitle><CardDescription>Sample terms for this demo position.</CardDescription></CardHeader>
          <CardContent>
            <dl className="hm-ledger-list">
              <div><dt>Market</dt><dd>USD / NGN</dd></div>
              <div><dt>Direction</dt><dd>{position.side}</dd></div>
              <div><dt>Position size</dt><dd>{position.notional}</dd></div>
              <div><dt>Entry rate</dt><dd>{position.strike}</dd></div>
              <div><dt>End date</dt><dd>{position.maturity}</dd></div>
              <div><dt>Rate source</dt><dd>{DEMO_MARKET.source} · simulated</dd></div>
            </dl>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

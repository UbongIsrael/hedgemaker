import {ArrowUpRight, CircleHelp} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, MarginBar} from '@/components/ui';
import {DEMO_POSITIONS} from '@/demo/fixtures';

export function PositionsPage() {
  return (
    <div className="hm-page hm-positions-page" aria-labelledby="positions-title">
      <div className="hm-page__heading">
        <div><p className="hm-eyebrow">ACCOUNT</p><h1 id="positions-title">Positions</h1><p className="hm-page__description">Each matched fill has its own isolated collateral and settlement history.</p></div>
        <Badge variant="warning">Local demo · testnet preview</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Position history</CardTitle>
          <CardDescription>Sample position records. Live contract status and oracle events are not connected.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hm-table-scroll" role="region" aria-label="Demo positions" tabIndex={0}>
            <table className="hm-data-table">
              <thead><tr><th scope="col">Position</th><th scope="col">Side / notional</th><th scope="col">Strike</th><th scope="col">Maturity</th><th scope="col">Current equity</th><th scope="col">Status</th><th scope="col"><span className="hm-sr-only">Details</span></th></tr></thead>
              <tbody>
                {DEMO_POSITIONS.map((position) => (
                  <tr key={position.id}>
                    <th scope="row"><Link to={`/app/positions/${position.id}`} className="hm-table-link">{position.id}<ArrowUpRight size={14} aria-hidden="true" /></Link><span className="hm-table-secondary">{position.intent}</span></th>
                    <td>{position.side}<span className="hm-table-secondary">{position.notional}</span></td>
                    <td>{position.strike}<span className="hm-table-secondary">Reference {position.currentRate}</span></td>
                    <td>{position.maturity}</td>
                    <td>{position.equity}<span className="hm-table-secondary">Demo P&amp;L {position.pnl}</span></td>
                    <td><Badge variant="success">{position.status}</Badge></td>
                    <td><Link to={`/app/positions/${position.id}`} className="hm-text-link">Details<span className="hm-sr-only"> for {position.id}</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hm-demo-note"><CircleHelp size={16} aria-hidden="true" /> This local sample list is not a record of real orders or onchain positions.</p>
        </CardContent>
      </Card>

      <section className="hm-position-cards" aria-label="Position health summary">
        {DEMO_POSITIONS.map((position) => (
          <Card key={`${position.id}-health`}>
            <CardHeader><div className="hm-card__title-row"><CardTitle>{position.id} health</CardTitle><Badge variant="warning">Demo indicator</Badge></div><CardDescription>Collateral for this position is isolated from other positions.</CardDescription></CardHeader>
            <CardContent>
              <MarginBar used={position.health} total={100} label="Margin health" tone="warning" formatAmount={(value) => `${value}%`} />
              <dl className="hm-definition-list">
                <div><dt>Initial margin</dt><dd>{position.initial}</dd></div>
                <div><dt>Maintenance margin</dt><dd>{position.maintenance}</dd></div>
                <div><dt>Counterparty equity</dt><dd>{position.counterpartyEquity}</dd></div>
              </dl>
              <p className="hm-muted">Use live position health and cure amount once contract reads are connected.</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

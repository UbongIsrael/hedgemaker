import {ArrowUpRight, CircleHelp} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, MarginBar} from '@/components/ui';
import {DEMO_POSITIONS} from '@/demo/fixtures';

export function PositionsPage() {
  return (
    <div className="hm-page hm-positions-page" aria-labelledby="positions-title">
      <div className="hm-page__heading">
        <div><p className="hm-eyebrow">ACCOUNT</p><h1 id="positions-title">Positions</h1><p className="hm-page__description">Each position has its own funds set aside and a record of how it settles.</p></div>
        <Badge variant="warning">Demo · sample data</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Position history</CardTitle>
          <CardDescription>Explore sample positions. Live position status and rate updates are unavailable in this demo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hm-table-scroll" role="region" aria-label="Demo positions" tabIndex={0}>
            <table className="hm-data-table">
              <thead><tr><th scope="col">Position</th><th scope="col">Direction / size</th><th scope="col">Agreed rate</th><th scope="col">End date</th><th scope="col">Current position balance</th><th scope="col">Status</th><th scope="col"><span className="hm-sr-only">Details</span></th></tr></thead>
              <tbody>
                {DEMO_POSITIONS.map((position) => (
                  <tr key={position.id}>
                    <th scope="row"><Link to={`/app/positions/${position.id}`} className="hm-table-link">{position.id}<ArrowUpRight size={14} aria-hidden="true" /></Link><span className="hm-table-secondary">{position.intent}</span></th>
                    <td>{position.side}<span className="hm-table-secondary">{position.notional}</span></td>
                    <td>{position.strike}<span className="hm-table-secondary">Reference rate {position.currentRate}</span></td>
                    <td>{position.maturity}</td>
                    <td>{position.equity}<span className="hm-table-secondary">Sample profit / loss {position.pnl}</span></td>
                    <td><Badge variant="success">{position.status}</Badge></td>
                    <td><Link to={`/app/positions/${position.id}`} className="hm-text-link">Details<span className="hm-sr-only"> for {position.id}</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hm-demo-note"><CircleHelp size={16} aria-hidden="true" /> These are sample positions. They do not represent real orders or transactions.</p>
        </CardContent>
      </Card>

      <section className="hm-position-cards" aria-label="Position health summary">
        {DEMO_POSITIONS.map((position) => (
          <Card key={`${position.id}-health`}>
            <CardHeader><div className="hm-card__title-row"><CardTitle>{position.id} health</CardTitle><Badge variant="warning">Sample indicator</Badge></div><CardDescription>The funds set aside for this position are held separately from your other positions.</CardDescription></CardHeader>
            <CardContent>
              <MarginBar used={position.health} total={100} label="Collateral health" tone="warning" formatAmount={(value) => `${value}%`} />
              <dl className="hm-definition-list">
                <div><dt>Required starting balance</dt><dd>{position.initial}</dd></div>
                <div><dt>Top-up trigger balance</dt><dd>{position.maintenance}</dd></div>
                <div><dt>Other side's position balance</dt><dd>{position.counterpartyEquity}</dd></div>
              </dl>
              <p className="hm-muted">Live risk levels and any required top-up are unavailable in this demo.</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

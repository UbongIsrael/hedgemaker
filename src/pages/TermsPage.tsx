import {Badge, Card, CardContent, CardHeader, CardTitle} from '@/components/ui';

const risks = [
  ['Collateral-limited protection', 'A counterparty can owe more than its remaining collateral. Any unpaid amount is recorded as shortfall; it is not insured or socialized in V1.'],
  ['Official-rate basis risk', 'The hedge follows the configured official reference, not necessarily the P2P or conversion rate you receive elsewhere.'],
  ['Early termination', 'Liquidation, collateral exhaustion, or an oracle failure can close protection before maturity. V1 has no early-close or position-transfer feature.'],
  ['Test USDC assumptions', 'The payoff assumes one USDC equals one USD. Token freezes, depegs, bridges, and issuer risks sit outside the hedge.'],
  ['Trusted demo roles', 'The testnet feed signer and dispute resolver are explicit trusted roles. Simulated rates are not real market observations.'],
  ['Timing and liveness', 'Finalized oracle updates and keeper transactions drive settlement. Time passing by itself does not update or close a position.'],
];

export function TermsPage() {
  return (
    <div className="page-shell content-page">
      <div className="content-page__intro">
        <Badge variant="warning">Disclosure draft · v0.3</Badge>
        <h1>Know what this hedge does—and what it cannot do.</h1>
        <p>These are product-design disclosures for a testnet prototype, not legal, investment, or regulatory advice.</p>
      </div>
      <div className="risk-grid">
        {risks.map(([heading, body], index) => (
          <Card key={heading} className="risk-card">
            <CardHeader><span className="risk-card__number">{String(index + 1).padStart(2, '0')}</span><CardTitle>{heading}</CardTitle></CardHeader>
            <CardContent><p>{body}</p></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import {Badge, Card, CardContent, CardHeader, CardTitle} from '@/components/ui';

const risks = [
  ['Protection has a funding limit', 'The other side of your hedge may owe more than the funds it has left. Any unpaid amount is recorded, but it is not insured or covered by other users.'],
  ['Your exchange rate may differ', 'A hedge follows the reference rate used by its market. That rate may differ from what a bank, exchange service or another person offers you. This demo uses sample rates.'],
  ['Your hedge can close early', 'Your hedge can close before its end date if either side misses a required top-up deadline, either side runs out of funds, or the rate feed fails. You cannot choose to close a hedge early or transfer it to someone else in this version.'],
  ['USDC has its own risks', 'The calculation treats 1 USDC as 1 US dollar. Your hedge does not protect against USDC losing that value, being frozen, or problems with its issuer or services used to move it between networks. This demo uses test USDC.'],
  ['Demo rates rely on trusted operators', 'This demo relies on trusted operators to submit rate updates and resolve disputes. Its simulated rates are examples, not real market prices.'],
  ['Updates and closing can take time', 'Your hedge needs confirmed rate updates and processing transactions to settle. Reaching the end date alone does not update or close it.'],
];

export function TermsPage() {
  return (
    <div className="page-shell content-page">
      <div className="content-page__intro">
        <Badge variant="warning">Testnet demo disclosures</Badge>
        <h1>Know what this hedge does—and what it cannot do.</h1>
        <p>These disclosures explain the risks and limits of this testnet demo. They are not legal, investment or regulatory advice.</p>
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

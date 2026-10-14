import {Badge, Card, CardContent, CardHeader, CardTitle} from '@/components/ui';
import {Link} from 'react-router-dom';
import {marketMakerRelease} from '@/content/marketMakers';

const risks = [
  ['Protection has a funding limit', 'The other side of your hedge may owe more than the funds it has left. Any unpaid amount is recorded, but it is not insured or covered by other users.'],
  ['Your exchange rate may differ', 'A hedge follows the finalized onchain reference rate used by its market. That rate may differ from what a bank, exchange service or another person offers you.'],
  ['Your hedge can close early', 'Your hedge can close before its end date if either side misses a required top-up deadline, either side runs out of funds, or the rate feed fails. You cannot choose to close a hedge early or transfer it to someone else in this version.'],
  ['USDC has its own risks', 'The calculation treats 1 USDC as 1 US dollar. Your hedge does not protect against USDC losing that value, being frozen, or problems with its issuer or services used to move it between networks. This demo uses test USDC.'],
  ['Rehearsal rates are not an official fixing', 'The testnet quorum submits timestamped source observations and a 60-minute TWAP onchain. Until independent providers are licensed and qualified, these synthetic rehearsal inputs are not an official NFEM fixing or a real executable market price.'],
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
      <section className="mm-context-callout"><span className="eyebrow">For market makers</span><p>{marketMakerRelease.placements.risks}</p><Link className="text-link" to="/market-makers/guide#risks">Read market-maker risks</Link></section>
    </div>
  );
}

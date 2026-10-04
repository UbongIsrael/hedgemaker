import {ArrowRight, Info} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Badge, Button, Card, CardContent, CardHeader, CardTitle} from '@/components/ui';

export function LearnPage() {
  return (
    <div className="page-shell content-page">
      <div className="content-page__intro">
        <Badge variant="info">A two-minute primer</Badge>
        <h1>A forward that settles the difference.</h1>
        <p>HedgeMaker creates collateral-limited exposure to an official USD/NGN reference rate. It does not exchange physical dollars or naira.</p>
      </div>
      <div className="explanation-grid">
        <Card className="explanation-card explanation-card--buyer">
          <CardHeader><span className="eyebrow">USD buyer</span><CardTitle>I need dollars later</CardTitle></CardHeader>
          <CardContent><p>If USD/NGN rises above your strike, the buyer side gains locked USDC collateral. If it falls, the buyer side pays from its posted collateral.</p></CardContent>
        </Card>
        <Card className="explanation-card explanation-card--seller">
          <CardHeader><span className="eyebrow">USD seller</span><CardTitle>I earn dollars</CardTitle></CardHeader>
          <CardContent><p>If USD/NGN falls below your strike, the seller side gains locked USDC collateral. If it rises, the seller side pays from its posted collateral.</p></CardContent>
        </Card>
      </div>
      <section className="formula-card">
        <div><span className="eyebrow">Contractual value to the buyer</span><strong>V = N × (R − K) ÷ R</strong></div>
        <dl>
          <div><dt>N</dt><dd>Reference USD notional</dd></div>
          <div><dt>K</dt><dd>Your fixed NGN/USD strike</dd></div>
          <div><dt>R</dt><dd>Finalized reference rate</dd></div>
        </dl>
      </section>
      <div className="example-ledger">
        <div><span>Example notional</span><strong>$1,000</strong></div>
        <div><span>Strike</span><strong>₦1,650 / USD</strong></div>
        <div className="positive"><span>If rate is ₦1,700</span><strong>Buyer +29.411764 USDC</strong></div>
        <div className="negative"><span>If rate is ₦1,600</span><strong>Buyer −31.250000 USDC</strong></div>
      </div>
      <div className="risk-note"><Info aria-hidden="true" /><p>Gains remain locked while a position is open. If collateral is exhausted, the position defaults and the promised amount can exceed what is actually paid.</p></div>
      <Link to="/market"><Button size="lg">Build an example <ArrowRight size={17} aria-hidden="true" /></Button></Link>
    </div>
  );
}

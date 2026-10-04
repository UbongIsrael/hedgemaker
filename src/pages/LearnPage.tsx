import {ArrowRight, Info} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Badge, Button, Card, CardContent, CardHeader, CardTitle} from '@/components/ui';

export function LearnPage() {
  return (
    <div className="page-shell content-page">
      <div className="content-page__intro">
        <Badge variant="info">A two-minute guide</Badge>
        <h1>How your hedge gains or loses value.</h1>
        <p>Explore how a hedge can help you manage changes in the dollar-to-naira reference rate. Gains and losses are calculated in USDC, and protection is limited to the funds backing the hedge. This demo uses sample rates and test USDC. No dollars or naira are exchanged.</p>
      </div>
      <div className="explanation-grid">
        <Card className="explanation-card explanation-card--buyer">
          <CardHeader><span className="eyebrow">USD buyer</span><CardTitle>Buying dollars later</CardTitle></CardHeader>
          <CardContent><p>If the dollar-to-naira rate rises above your agreed rate, your hedge gains USDC. If it falls below your agreed rate, your hedge loses USDC from the funds you set aside. Gains stay locked until your hedge closes.</p></CardContent>
        </Card>
        <Card className="explanation-card explanation-card--seller">
          <CardHeader><span className="eyebrow">USD seller</span><CardTitle>Selling dollars later</CardTitle></CardHeader>
          <CardContent><p>If the dollar-to-naira rate falls below your agreed rate, your hedge gains USDC. If it rises above your agreed rate, your hedge loses USDC from the funds you set aside. Gains stay locked until your hedge closes.</p></CardContent>
        </Card>
      </div>
      <section className="formula-card">
        <div><span className="eyebrow">How the buyer’s gain or loss is calculated</span><strong>V = N × (R − K) ÷ R</strong></div>
        <dl>
          <div><dt>N</dt><dd>Dollar amount your hedge covers</dd></div>
          <div><dt>K</dt><dd>Your agreed rate in naira per dollar</dd></div>
          <div><dt>R</dt><dd>Confirmed reference rate in naira per dollar</dd></div>
        </dl>
      </section>
      <div className="example-ledger">
        <div><span>Example hedge amount</span><strong>$1,000</strong></div>
        <div><span>Agreed rate</span><strong>₦1,650 / USD</strong></div>
        <div className="positive"><span>If rate is ₦1,700</span><strong>Buyer +29.411764 USDC</strong></div>
        <div className="negative"><span>If rate is ₦1,600</span><strong>Buyer −31.250000 USDC</strong></div>
      </div>
      <div className="risk-note"><Info aria-hidden="true" /><p>Gains stay locked until your hedge closes. If either side runs out of funds, the hedge closes in default. You may receive less than the calculated amount, and any unpaid amount is not insured.</p></div>
      <Link to="/market"><Button size="lg">Try an example hedge <ArrowRight size={17} aria-hidden="true" /></Button></Link>
    </div>
  );
}

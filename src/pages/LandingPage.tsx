import {ArrowRight, CircleDollarSign, Clock3, LockKeyhole, ShieldAlert, Sparkles} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Badge, Button, Card, CardContent} from '@/components/ui';
import {DEMO_MARKET} from '@/demo/fixtures';

const featureItems = [
  {
    icon: CircleDollarSign,
    eyebrow: 'For importers',
    title: 'Plan for a higher dollar.',
    body: 'Take the USD-buyer side when a rising NGN price of USD would squeeze your future purchase.',
  },
  {
    icon: ShieldAlert,
    eyebrow: 'For dollar earners',
    title: 'Protect a naira target.',
    body: 'Take the USD-seller side when a stronger naira could reduce what your dollar income converts into.',
  },
  {
    icon: LockKeyhole,
    eyebrow: 'Collateral-limited',
    title: 'Risk is visible before you sign.',
    body: 'See initial margin, maintenance, entry adjustment and the limits of protection in one review.',
  },
];

export function LandingPage() {
  return (
    <div className="landing-page">
      <section className="hero page-shell">
        <div className="hero__copy">
          <Badge variant="info"><Sparkles size={14} aria-hidden="true" /> Metropolis market prototype</Badge>
          <h1>Hedge the rate.<br /><em>Keep the plan.</em></h1>
          <p className="hero__lead">
            A direct market for people with opposite USD/NGN worries. Choose a listed date, post collateral in test USDC, and let the order book find the other side.
          </p>
          <div className="hero__actions">
            <Link to="/market"><Button size="lg">Explore the market <ArrowRight size={17} aria-hidden="true" /></Button></Link>
            <Link className="text-link" to="/learn">See an example</Link>
          </div>
          <p className="hero__footnote">No currency delivery. No guaranteed conversion rate. Protection is limited by posted collateral.</p>
        </div>

        <div className="hero-market" aria-label="Current demo market snapshot">
          <div className="hero-market__topline">
            <span>USD / NGN</span>
            <Badge variant="success">Finalized round {DEMO_MARKET.roundId.toString()}</Badge>
          </div>
          <div className="hero-market__rate">
            <span className="hero-market__currency">₦</span>
            <strong>1,650.00</strong>
            <span>/ USD</span>
          </div>
          <div className="hero-market__change">
            <span>+₦7.50</span>
            <span>since prior simulated fixing</span>
          </div>
          <div className="hero-market__divider" />
          <div className="hero-market__quote-grid">
            <div>
              <span>Best buyer</span>
              <strong>₦1,649.00</strong>
              <small>$1,200 available</small>
            </div>
            <div>
              <span>Best seller</span>
              <strong>₦1,651.00</strong>
              <small>$900 available</small>
            </div>
          </div>
          <Link className="hero-market__cta" to="/market">
            Build a hedge <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <span className="hero-market__stamp" aria-hidden="true">SIMULATED</span>
        </div>
      </section>

      <section className="signal-bar" aria-label="Product facts">
        <div><Clock3 aria-hidden="true" /><span><strong>Listed maturities</strong> 7, 14 and 30 day demo series</span></div>
        <div><LockKeyhole aria-hidden="true" /><span><strong>Isolated margin</strong> Each position stands on its own</span></div>
        <div><CircleDollarSign aria-hidden="true" /><span><strong>Test USDC</strong> Cash-settled on Monad testnet</span></div>
      </section>

      <section className="page-shell section-block">
        <div className="section-heading">
          <span className="eyebrow">Built around your exposure</span>
          <h2>Plain-language protection.<br />Market-grade transparency.</h2>
          <p>You should understand the trade before you need to understand the jargon.</p>
        </div>
        <div className="feature-grid">
          {featureItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="feature-card">
                <CardContent>
                  <div className="feature-card__number">0{index + 1}</div>
                  <Icon className="feature-card__icon" aria-hidden="true" />
                  <span className="eyebrow">{item.eyebrow}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="how-it-works">
        <div className="page-shell how-it-works__inner">
          <div className="section-heading section-heading--light">
            <span className="eyebrow">One transparent loop</span>
            <h2>From worry to<br />a monitored position.</h2>
          </div>
          <ol className="process-list">
            <li><span>01</span><div><h3>Describe the worry</h3><p>Need dollars later or earn dollars? Pick the real-world outcome first.</p></div></li>
            <li><span>02</span><div><h3>Review the protection</h3><p>See the rate, date, reserve, margin thresholds, fees and adverse scenario.</p></div></li>
            <li><span>03</span><div><h3>Match and monitor</h3><p>Your order finds the opposite side. Finalized rates move locked collateral.</p></div></li>
            <li><span>04</span><div><h3>Claim after close</h3><p>When the position closes, released equity becomes claimable before withdrawal.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="page-shell callout-band">
        <div>
          <span className="eyebrow">Try the testnet experience</span>
          <h2>See both sides before you choose yours.</h2>
        </div>
        <Link to="/market"><Button size="lg">Open the USD/NGN market <ArrowRight size={17} aria-hidden="true" /></Button></Link>
      </section>
    </div>
  );
}

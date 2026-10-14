import {ArrowRight, CircleDollarSign, Clock3, LockKeyhole, ShieldAlert, Sparkles} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Badge, Button, Card, CardContent} from '@/components/ui';
import {marketMakerCopy, marketMakerRelease} from '@/content/marketMakers';
import {formatFixed, formatUsdc} from '@/domain';
import {useLiveOrderBook} from '@/integrations/contracts/useLiveOrderBook';

const featureItems = [
  {
    icon: CircleDollarSign,
    eyebrow: 'For importers',
    title: 'Plan for a higher dollar.',
    body: 'Choose the buyer side if a more expensive dollar would put pressure on your budget.',
  },
  {
    icon: ShieldAlert,
    eyebrow: 'For dollar earners',
    title: 'Protect a naira target.',
    body: 'Choose the seller side if a stronger naira would mean getting fewer naira for your dollar income.',
  },
  {
    icon: LockKeyhole,
    eyebrow: 'Know your limits',
    title: 'Risk is visible before you sign.',
    body: 'Review the funds you need to set aside, when you may need to add more, any starting adjustment, and the limits of protection.',
  },
];

export function LandingPage() {
  const book = useLiveOrderBook();
  const buyerLevels = book.data?.levels.filter((level) => level.buyerNotionalRaw > 0n) ?? [];
  const sellerLevels = book.data?.levels.filter((level) => level.sellerNotionalRaw > 0n) ?? [];
  const bestBuyer = buyerLevels[0];
  const bestSeller = sellerLevels.at(-1);

  return (
    <div className="landing-page">
      <section className="hero page-shell">
        <div className="hero__copy">
          <Badge variant="info"><Sparkles size={14} aria-hidden="true" /> Live on Monad Testnet</Badge>
          <h1>Hedge the rate.<br /><em>Keep the plan.</em></h1>
          <p className="hero__lead">
            Plan ahead for changes in the dollar-to-naira rate. Choose a date and explore protection for future dollar purchases or sales.
          </p>
          <div className="hero__actions">
            <Link to="/market"><Button size="lg">Explore the market <ArrowRight size={17} aria-hidden="true" /></Button></Link>
            <Link className="text-link" to="/learn">How it works</Link>
          </div>
          <p className="hero__footnote">This does not exchange dollars or naira or guarantee a conversion rate. Protection is limited to the funds set aside to back the hedge.</p>
        </div>

        <div className="hero-market" aria-label="Current onchain market snapshot" aria-busy={book.loading}>
          <div className="hero-market__topline">
            <span>USD / NGN</span>
            <Badge variant={book.data?.tradingOpen ? 'success' : 'warning'}>{book.loading ? 'Reading Monad' : book.data?.tradingOpen ? 'Trading open' : 'Trading closed'}</Badge>
          </div>
          <div className="hero-market__rate">
            <span className="hero-market__currency">₦</span>
            <strong>{book.data?.referenceRateRaw === undefined ? '—' : formatFixed(book.data.referenceRateRaw, 2, 6)}</strong>
            <span>/ USD</span>
          </div>
          <div className="hero-market__change">
            <span>Round {book.data?.roundId?.toString() ?? '—'}</span>
            <span>finalized oracle rate · block {book.data?.blockNumber.toString() ?? '—'}</span>
          </div>
          <div className="hero-market__divider" />
          <div className="hero-market__quote-grid">
            <div>
              <span>Best buyer rate</span>
              <strong>{bestBuyer ? `₦${formatFixed(bestBuyer.strikeRaw, 2, 6)}` : '—'}</strong>
              <small>{bestBuyer ? `$${formatUsdc(bestBuyer.buyerNotionalRaw)} resting` : 'No resting buyer orders'}</small>
            </div>
            <div>
              <span>Best seller rate</span>
              <strong>{bestSeller ? `₦${formatFixed(bestSeller.strikeRaw, 2, 6)}` : '—'}</strong>
              <small>{bestSeller ? `$${formatUsdc(bestSeller.sellerNotionalRaw)} resting` : 'No resting seller orders'}</small>
            </div>
          </div>
          <Link className="hero-market__cta" to="/market">
            Build a hedge <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <span className="hero-market__stamp" aria-hidden="true">ONCHAIN</span>
        </div>
      </section>

      <section className="signal-bar" aria-label="Product facts">
        <div><Clock3 aria-hidden="true" /><span><strong>Choose your end date</strong> Select an operator-listed onchain maturity</span></div>
        <div><LockKeyhole aria-hidden="true" /><span><strong>Separate funds for each hedge</strong> Each hedge has its own balance</span></div>
        <div><CircleDollarSign aria-hidden="true" /><span><strong>Test USDC</strong> Wallet balances and protocol accounting come from Monad</span></div>
      </section>

      <section className="page-shell section-block">
        <div className="section-heading">
          <span className="eyebrow">Built around your plans</span>
          <h2>Understand your hedge.<br />Know your risks.</h2>
          <p>See how rate changes could affect your balance before you decide.</p>
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
            <span className="eyebrow">How it works</span>
            <h2>Set up your hedge.<br />Follow its progress.</h2>
          </div>
          <ol className="process-list">
            <li><span>01</span><div><h3>Choose your goal</h3><p>Buying or selling dollars later? Choose the option that fits your plans.</p></div></li>
            <li><span>02</span><div><h3>Review the protection</h3><p>Review your rate, end date, required funds and fees. See what could happen if the rate moves against you.</p></div></li>
            <li><span>03</span><div><h3>Match and track</h3><p>Your order can match with someone taking the other side. Confirmed rate updates adjust the funds locked in your hedge.</p></div></li>
            <li><span>04</span><div><h3>Withdraw your remaining funds</h3><p>Once your hedge closes, your remaining funds become available to withdraw to your wallet.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="page-shell mm-home-callout" aria-labelledby="mm-home-title">
        <div><span className="eyebrow">For market makers</span><h2 id="mm-home-title">{marketMakerCopy.homeHeading}</h2><p>{marketMakerRelease.home.body}</p><p className="mm-status">{marketMakerRelease.home.note}</p></div>
        <Link className="hm-button hm-button--secondary hm-button--lg" to="/market-makers">{marketMakerCopy.homeLink}<ArrowRight size={17} aria-hidden="true" /></Link>
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

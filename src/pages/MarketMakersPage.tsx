import {ArrowRight, ArrowUpRight, Layers3, ShieldCheck, Waypoints} from 'lucide-react';
import {Link} from 'react-router-dom';
import {Badge, Card, CardContent} from '@/components/ui';
import {PageMetadata} from '@/components/PageMetadata';
import {marketMakerCopy as copy, marketMakerRelease as release} from '@/content/marketMakers';
import {marketMakerContact} from '@/integrations/marketMakers/contact';

const roleIcons = [Waypoints, Layers3, ShieldCheck];

export function MarketMakersPage() {
  return (
    <div className="mm-page">
      <PageMetadata title="Market makers — HedgeMaker" description={`${copy.lead} ${release.environment}.`} />
      <section className="page-shell mm-hero" aria-labelledby="mm-title">
        <div className="mm-hero__copy">
          <span className="eyebrow">For market makers and FX desks</span>
          <h1 id="mm-title">Make a market for the next <em>dollar–naira hedge.</em></h1>
          <p className="mm-lead">{copy.lead}</p>
          <div className="mm-actions">
            <a className="hm-button hm-button--primary hm-button--lg" href="#apply">{copy.apply}<ArrowRight size={17} aria-hidden="true" /></a>
            <Link className="text-link" to="/market-makers/guide">{copy.guide}</Link>
            <Link className="text-link" to="/market-makers/integration">Open integration console</Link>
          </div>
          <p className="mm-status">{release.status}</p>
        </div>
        <aside className="mm-market-map" aria-label="Market-maker participation model">
          <div className="mm-market-map__header"><span>USD / NGN</span><span>Participation model</span></div>
          <div className="mm-market-map__node"><span>Users planning</span><strong>Future dollar purchases</strong></div>
          <div className="mm-market-map__connection" aria-hidden="true"><span /><Waypoints size={22} /><span /></div>
          <div className="mm-market-map__center"><span>Market makers</span><strong>Price. Fund. Carry.</strong><p>Choose the exposure that fits your book.</p></div>
          <div className="mm-market-map__connection" aria-hidden="true"><span /><Waypoints size={22} /><span /></div>
          <div className="mm-market-map__node"><span>Users planning</span><strong>Future dollar sales</strong></div>
          <p className="mm-market-map__note">An opportunity to supply the other side. Fills depend on compatible funded orders.</p>
        </aside>
      </section>

      <section className="mm-introduction">
        <div className="page-shell mm-split">
          <div><span className="eyebrow">A focused market</span><h2>Help bridge the gap<br />between two plans.</h2></div>
          <div><p>{copy.introduction}</p><p>{release.recruitment} {release.trading}</p></div>
        </div>
      </section>

      <section className="page-shell mm-section" aria-labelledby="mm-roles-title">
        <div className="section-heading"><span className="eyebrow">Ways to participate</span><h2 id="mm-roles-title">Bring liquidity.<br />Build the next layer.</h2></div>
        <div className="mm-role-grid">
          {release.opportunities.map((role, index) => {
            const Icon = roleIcons[index] ?? Waypoints;
            return (
              <Card key={role.id} className="mm-role-card">
                <CardContent><div className="mm-role-card__top"><Icon size={25} aria-hidden="true" /><span>{role.number}</span></div><Badge variant={index === 0 ? 'info' : 'warning'}>{role.label}</Badge><h3>{role.title}</h3><p>{role.body}</p><Link className="text-link" to={`/market-makers/guide#${role.id}`}>Read the guide<ArrowUpRight size={15} aria-hidden="true" /></Link></CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mm-economics">
        <div className="page-shell mm-split">
          <div><span className="eyebrow">The earning opportunity</span><h2>How participation<br />can earn.</h2><Link className="text-link" to="/market-makers/guide#earnings">Understand the economics<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
          <div><p className="mm-lead">{release.earnings}</p><p>Your earning opportunity comes from how you price and manage the exposure. Fills, costs, funding, and collateral outcomes determine the result. A favorable entry mark stays locked in collateral and is already included in final contractual value.</p></div>
        </div>
      </section>

      <section className="page-shell mm-section mm-detail-grid">
        <article><Badge variant="warning">{release.takeovers.label}</Badge><h2>Help build a market<br />for position takeovers.</h2>{release.takeovers.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</article>
        <article><Badge variant="warning">{release.backstop.label}</Badge><h2>Discuss committed<br />replacement capacity.</h2>{release.backstop.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</article>
      </section>

      <section id="risks" className="mm-risk-band">
        <div className="page-shell mm-split">
          <div><span className="eyebrow">Capital and settlement</span><h2>Know the market<br />you are entering.</h2><Link className="text-link" to="/market-makers/guide#risks">Read market-maker risks<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
          <div>
            <p>HedgeMaker settles gains and losses in the configured settlement token against a reference exchange rate. It does not deliver dollars or naira. The reference may differ from the rate at which you convert or hedge elsewhere.</p>
            <p>Positions require ongoing collateral monitoring. Gains remain locked until closure. Different legs have independent margin requirements, and an opposite position does not release the first leg’s collateral. Counterparty shortfalls, oracle delays, token issues, and chain outages can affect outcomes.</p>
            <p className="mm-status">{release.riskStatus}</p>
          </div>
        </div>
      </section>

      <section id="apply" className="page-shell mm-section mm-application" aria-labelledby="mm-application-title">
        <div><span className="eyebrow">Build the integration with us</span><h2 id="mm-application-title">{copy.apply}</h2><p className="mm-lead">{copy.application}</p><p>{copy.integration}</p></div>
        <Card className="mm-application__card"><CardContent>
          <h3>Tell us about your desk.</h3>
          <ul className="mm-application__list"><li>Your name, organization, role, and operating regions.</li><li>Your USD/NGN experience, sizes, and maturities.</li><li>Your interest in quoting, planned takeovers, or replacement capacity.</li><li>The market data, collateral tools, and integration workflow you need.</li></ul>
          {marketMakerContact ? (
            <>
              <a className="hm-button hm-button--primary hm-button--lg" href={marketMakerContact.href} {...(marketMakerContact.kind === 'application' ? {target: '_blank', rel: 'noopener noreferrer'} : {})}>{marketMakerContact.label}<ArrowUpRight size={17} aria-hidden="true" /></a>
              <p className="mm-status">{marketMakerContact.kind === 'email' ? 'Opens your email app. Review and send your application there; opening a draft does not submit it.' : 'Opens the application service in a new tab. Review its privacy information and submit your details there.'}</p>
            </>
          ) : <p className="mm-application__pending" role="status">The application contact is being set up. You can explore the guide while we prepare to receive market-maker interest.</p>}
          <p className="mm-status">Applications do not commit capital or guarantee program access. Do not share private keys or wallet recovery details.</p>
        </CardContent></Card>
      </section>
    </div>
  );
}

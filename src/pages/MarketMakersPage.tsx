import {
  ArrowRight,
  ArrowUpRight,
  Layers3,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui";
import { PageMetadata } from "@/components/PageMetadata";
import {
  marketMakerCopy as copy,
  marketMakerRelease as release,
} from "@/content/marketMakers";
import { marketMakerContact } from "@/integrations/marketMakers/contact";
import { PriceChart } from "@/components/PriceChart";

const roleIcons = [Waypoints, Layers3, ShieldCheck];

export function MarketMakersPage() {
  return (
    <div className="maker-page brand-marketing">
      <PageMetadata
        title="Market makers — HedgeMaker"
        description={`${copy.lead} ${release.environment}.`}
      />
      <section className="page-shell maker-hero" aria-labelledby="mm-title">
        <div className="maker-hero__copy">
          <span className="brand-kicker">For market makers and FX desks</span>
          <h1 id="mm-title">
            Make a market for the next <span>dollar–naira hedge.</span>
          </h1>
          <p className="maker-lead">{copy.lead}</p>
          <div className="brand-actions">
            <a className="hm-button hm-button--lg" href="#apply">
              {copy.apply}
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <p className="maker-status">{release.status}</p>
        </div>
        <aside
          id="apply"
          className="maker-application"
          aria-labelledby="mm-application-title"
        >
          <span className="brand-label">Build the integration with us</span>
          <h2 id="mm-application-title">Tell us about your desk.</h2>
          <p>{copy.application}</p>
          <ul>
            <li>Your name, organization, role, and operating regions.</li>
            <li>Your USD/NGN experience, sizes, and maturities.</li>
            <li>
              Your interest in quoting, planned takeovers, or replacement
              capacity.
            </li>
            <li>
              The market data, collateral tools, and integration workflow you
              need.
            </li>
          </ul>
          {marketMakerContact ? (
            <>
              <a
                className="hm-button hm-button--lg"
                href={marketMakerContact.href}
                {...(marketMakerContact.kind === "application"
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {marketMakerContact.label}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
              <p className="maker-status">
                {marketMakerContact.kind === "email"
                  ? "Opens your email app. Review and send your application there; opening a draft does not submit it."
                  : "Opens the application service in a new tab. Review its privacy information and submit your details there."}
              </p>
            </>
          ) : (
            <p role="status">
              The application contact is being set up. You can explore the guide
              while we prepare to receive market-maker interest.
            </p>
          )}
          <p className="maker-status">
            Applications do not commit capital or guarantee program access. Do
            not share private keys or wallet recovery details.
          </p>
        </aside>
      </section>
      <nav
        className="page-shell maker-resource-bar"
        aria-label="Market-maker resources"
      >
        <Link to="/market-makers/guide">
          {copy.guide}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/market-makers/integration">
          Open integration console
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
        <a href="#risks">
          Capital & settlement risks
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </nav>
      <section
        className="page-shell brand-section maker-intro"
        aria-labelledby="maker-intro-title"
      >
        <div>
          <h2 id="maker-intro-title">
            Help bridge the gap
            <br />
            between two plans.
          </h2>
          <p>{copy.introduction}</p>
          <p>
            {release.recruitment} {release.trading}
          </p>
        </div>
        <figure className="maker-participation">
          <PriceChart compact />
          <figcaption>
            <span>Future dollar purchases</span>
            <strong>Price. Fund. Carry.</strong>
            <span>Future dollar sales</span>
          </figcaption>
          <p>
            Choose the exposure that fits your book. An opportunity to supply
            the other side. Fills depend on compatible funded orders.
          </p>
        </figure>
      </section>
      <section
        className="page-shell brand-section"
        aria-labelledby="mm-roles-title"
      >
        <div className="brand-section-heading">
          <h2 id="mm-roles-title">
            Bring liquidity.
            <br />
            Build the next layer.
          </h2>
        </div>
        <div className="maker-role-list">
          {release.opportunities.map((role, index) => {
            const Icon = roleIcons[index] ?? Waypoints;
            return (
              <article key={role.id}>
                <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <Badge variant={index === 0 ? "info" : "warning"}>
                    {role.label}
                  </Badge>
                  <h3>{role.title}</h3>
                  <p>{role.body}</p>
                </div>
                <Link
                  className="text-link"
                  to={`/market-makers/guide#${role.id}`}
                >
                  Read the guide
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
      <section
        className="page-shell maker-economics"
        aria-labelledby="earnings-title"
      >
        <span className="brand-label">The earning opportunity</span>
        <h2 id="earnings-title">How participation can earn.</h2>
        <p className="maker-lead">{release.earnings}</p>
        <p>
          Your earning opportunity comes from how you price and manage the
          exposure. Fills, costs, funding, and collateral outcomes determine the
          result. A favorable entry mark stays locked in collateral and is
          already included in final contractual value.
        </p>
        <Link className="text-link" to="/market-makers/guide#earnings">
          Understand the economics
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>
      <section
        className="page-shell brand-section maker-details"
        aria-label="Planned market-making capabilities"
      >
        <article>
          <Badge variant="warning">{release.takeovers.label}</Badge>
          <h2>
            Help build a market
            <br />
            for position takeovers.
          </h2>
          {release.takeovers.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
        <article>
          <Badge variant="warning">{release.backstop.label}</Badge>
          <h2>
            Discuss committed
            <br />
            replacement capacity.
          </h2>
          {release.backstop.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
      </section>
      <section
        id="risks"
        className="page-shell maker-risks"
        aria-labelledby="maker-risk-title"
      >
        <h2 id="maker-risk-title">Know the market you are entering.</h2>
        <div className="maker-risk-copy">
          <p>
            HedgeMaker settles gains and losses in the configured settlement
            token against a reference exchange rate. It does not deliver dollars
            or naira. The reference may differ from the rate at which you
            convert or hedge elsewhere.
          </p>
          <p>
            Positions require ongoing collateral monitoring. Gains remain locked
            until closure. Different legs have independent margin requirements,
            and an opposite position does not release the first leg’s
            collateral. Counterparty shortfalls, oracle delays, token issues,
            and chain outages can affect outcomes.
          </p>
        </div>
        <p className="maker-status">{release.riskStatus}</p>
        <Link className="text-link" to="/market-makers/guide#risks">
          Read market-maker risks
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>
      <section className="page-shell maker-integration">
        <h2>Build the integration with us.</h2>
        <p>{copy.integration}</p>
        <Link
          className="hm-button hm-button--secondary"
          to="/market-makers/integration"
        >
          Open integration console
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

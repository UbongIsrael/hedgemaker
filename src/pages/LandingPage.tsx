import {
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { Link } from "react-router-dom";
import { HedgeFlow } from "@/components/HedgeFlow";
import { HedgeJourney } from "@/components/HedgeJourney";
import { PageMetadata } from "@/components/PageMetadata";
import { marketMakerCopy, marketMakerRelease } from "@/content/marketMakers";
import importer from "@/assets/brand/images/importer.webp";
import earner from "@/assets/brand/images/dollar-earner.webp";
import sculpture from "@/assets/brand/images/currency-sculpture.webp";

const featureItems = [
  {
    image: importer,
    alt: "A Nigerian entrepreneur reviewing inventory in a workspace with woven textiles and packed goods",
    label: "For importers",
    title: "Plan for a higher dollar.",
    body: "Choose the buyer side if a more expensive dollar would put pressure on your budget.",
    to: "/market",
    link: "Explore the buyer side",
  },
  {
    image: earner,
    alt: "A Nigerian creative professional working at a sunlit desk with a blue notebook and woven wall textile",
    label: "For dollar earners",
    title: "Protect a naira target.",
    body: "Choose the seller side if a stronger naira would mean getting fewer naira for your dollar income.",
    to: "/market?side=seller",
    link: "Explore the seller side",
  },
  {
    image: sculpture,
    alt: "Etched paper ribbons interlocking around a lime diamond",
    label: "Know your limits",
    title: "Risk is visible before you sign.",
    body: "Review the funds you need to set aside, when you may need to add more, any starting adjustment, and the limits of protection.",
    to: "/terms",
    link: "Read the risk disclosures",
  },
];

export function LandingPage() {
  return (
    <div className="landing-page brand-marketing">
      <PageMetadata
        title="HedgeMaker | Hedge the rate. Keep the plan."
        description="Explore a new way to manage exchange-rate risk, starting with USD/NGN. HedgeMaker’s testnet demo uses sample rates and test tokens; protection is limited to the funds backing each hedge."
      />
      <section className="brand-hero page-shell" aria-labelledby="home-title">
        <div className="brand-hero__copy">
          <span className="brand-kicker">
            Currency risk. More control.
          </span>
          <h1 id="home-title">
            Hedge the rate.
            <br />
            <span>Keep the plan.</span>
          </h1>
          <p>
            Explore a new way to manage exchange-rate risk, starting with
            USD/NGN.
          </p>
          <div className="brand-actions">
            <Link className="hm-button hm-button--lg" to="/market">
              Explore the market
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="text-link" to="/learn">
              See an example
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <HedgeFlow />
      </section>
      <div className="brand-disclosure page-shell">
        <p>
          This does not exchange dollars or naira or guarantee a conversion
          rate. Protection is limited to the funds set aside to back the hedge.
        </p>
        <Link to="/terms">
          Understand the risks
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <section className="brand-facts page-shell" aria-label="Product facts">
        <div>
          <Clock3 size={23} aria-hidden="true" />
          <p>
            <strong>Choose your end date</strong>
            <span>7, 14 or 30 days in the demo</span>
          </p>
        </div>
        <div>
          <LockKeyhole size={23} aria-hidden="true" />
          <p>
            <strong>Separate funds for each hedge</strong>
            <span>Each hedge has its own balance</span>
          </p>
        </div>
        <div>
          <CircleDollarSign size={23} aria-hidden="true" />
          <p>
            <strong>Test USDC</strong>
            <span>Explore gains and losses in test USDC</span>
          </p>
        </div>
      </section>
      <section
        className="brand-section page-shell"
        aria-labelledby="problem-title"
      >
        <div className="problem-solution">
          <div className="problem-solution__problem">
            <span className="brand-label">The problem</span>
            <h2 id="problem-title">
              Your plans are fixed.
              <br />
              The rate isn’t.
            </h2>
            <p>
              A future dollar purchase can cost more naira. Dollar income can
              bring home fewer naira. The uncertainty sits between today’s plan
              and tomorrow’s payment.
            </p>
            <div className="rate-path" aria-hidden="true">
              <span>Today’s plan</span>
              <div className="rate-path__line" />
              <span>Tomorrow’s rate?</span>
            </div>
          </div>
          <div className="problem-solution__solution">
            <span className="brand-label">Our approach</span>
            <h2>
              Give that uncertainty
              <br />a defined position.
            </h2>
            <p>
              Choose a side, amount, and end date. A funded hedge gains or loses
              USDC as the confirmed reference rate changes.
            </p>
            <Link className="text-link" to="/learn">
              How the calculation works
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <p className="problem-solution__limit">
              A hedge can lose value. Gains stay locked until closure, and
              counterparty shortfalls are not insured.
            </p>
          </div>
        </div>
      </section>
      <section
        className="brand-section brand-section--images page-shell"
        aria-labelledby="features-title"
      >
        <div className="brand-section-heading">
          <h2 id="features-title">
            Understand your hedge.
            <br />
            Know your risks.
          </h2>
          <p>
            See how rate changes could affect your balance before you decide.
          </p>
        </div>
        <div className="image-features">
          {featureItems.map((item) => (
            <article className="image-feature" key={item.title}>
              <div className="image-feature__visual">
                <img
                  src={item.image}
                  alt={item.alt}
                  width="1536"
                  height="1024"
                  loading="lazy"
                />
              </div>
              <div className="image-feature__copy">
                <span className="brand-label">{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <Link className="text-link" to={item.to}>
                  {item.link}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section
        id="how-it-works"
        className="brand-section page-shell"
        aria-labelledby="journey-title"
      >
        <div className="brand-section-heading">
          <h2 id="journey-title">
            Set up your hedge.
            <br />
            Follow its progress.
          </h2>
          <p>
            From the plan you want to protect to the funds you can withdraw.
          </p>
        </div>
        <HedgeJourney />
      </section>
      <section
        className="page-shell brand-maker-callout"
        aria-labelledby="mm-home-title"
      >
        <div>
          <span className="brand-label">For market makers</span>
          <h2 id="mm-home-title">{marketMakerCopy.homeHeading}</h2>
          <p>{marketMakerRelease.home.body}</p>
          <p className="brand-maker-callout__status">
            {marketMakerRelease.home.note}
          </p>
          <Link className="text-link" to="/market-makers">
            {marketMakerCopy.homeLink}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="maker-art" aria-hidden="true">
          <span>Price.</span>
          <span>Fund.</span>
          <span>Carry.</span>
        </div>
      </section>
      <section className="page-shell brand-final-cta">
        <h2>
          See both sides
          <br />
          before you choose yours.
        </h2>
        <Link className="hm-button hm-button--lg" to="/market">
          Open the USD/NGN market
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <p>Try the testnet experience. Sample rates and test tokens only.</p>
      </section>
    </div>
  );
}

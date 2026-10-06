import { ArrowRight, Info } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { HedgeJourney } from "@/components/HedgeJourney";
import { PageMetadata } from "@/components/PageMetadata";
import { SegmentedControl } from "@/components/ui";
import { buyerPayoffRaw, formatFixed, parseUsdc, type Side } from "@/domain";
import { marketMakerRelease } from "@/content/marketMakers";
import buyerPhone from "@/assets/brand/images/buyer-price-phone.webp";

function HedgeExample() {
  const [side, setSide] = useState<Side>("USD_BUYER");
  const [rate, setRate] = useState(1700);
  const buyerValue = buyerPayoffRaw(parseUsdc("1000"), 1650n, BigInt(rate));
  const value = side === "USD_BUYER" ? buyerValue : -buyerValue;
  return (
    <section className="learn-example" aria-labelledby="example-title">
      <div>
        <span className="brand-label">Explore a sample hedge</span>
        <h2 id="example-title">
          Same rate move.
          <br />
          Two different outcomes.
        </h2>
        <p>
          A $1,000 hedge at an agreed rate of ₦1,650 / USD. Change the reference
          rate to see the calculated value.
        </p>
        <p className="learn-example__note">
          Illustrative calculation, before fees or defaults. This is not a live
          rate or an available withdrawal.
        </p>
      </div>
      <div className="learn-example__controls">
        <SegmentedControl
          label="Choose a side for the example"
          value={side}
          onChange={setSide}
          options={[
            { value: "USD_BUYER", label: "USD buyer" },
            { value: "USD_SELLER", label: "USD seller" },
          ]}
        />
        <label htmlFor="example-rate">
          Reference rate <strong>₦{rate.toLocaleString("en-NG")} / USD</strong>
        </label>
        <input
          id="example-rate"
          type="range"
          min="1550"
          max="1750"
          step="10"
          value={rate}
          onChange={(event) => setRate(Number(event.target.value))}
        />
        <div className="learn-example__range">
          <span>₦1,550</span>
          <span>₦1,750</span>
        </div>
        <div
          className="learn-example__result"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>
            {side === "USD_BUYER" ? "Buyer" : "Seller"} calculated gain / loss
          </span>
          <output className={value < 0n ? "negative" : "positive"}>
            {value > 0n ? "+" : ""}
            {formatFixed(value, 6)} <small>USDC</small>
          </output>
        </div>
        <p>Gains stay locked until your hedge closes.</p>
      </div>
    </section>
  );
}

export function LearnPage() {
  return (
    <div className="page-shell learn-page brand-marketing">
      <PageMetadata
        title="How it works | HedgeMaker"
        description="Understand buyer and seller outcomes, collateral limits, and the USDC calculation in HedgeMaker’s dollar–naira testnet demo."
      />
      <section className="learn-hero">
        <div>
          <span className="brand-kicker">A two-minute guide</span>
          <h1>
            How your hedge gains
            <br />
            or loses value.
          </h1>
          <p>
            Explore how a hedge can help you manage changes in the
            dollar-to-naira reference rate. Gains and losses are calculated in
            USDC, and protection is limited to the funds backing the hedge. This
            demo uses sample rates and test USDC. No dollars or naira are
            exchanged.
          </p>
        </div>
        <img
          src={buyerPhone}
          alt="A phone illustration with a rising blue price chart and woven line fill"
          width="1536"
          height="1024"
        />
      </section>
      <section
        className="learn-situations"
        aria-label="The problem and the hedge response"
      >
        <article>
          <span className="brand-label">USD buyer</span>
          <h2>Buying dollars later</h2>
          <p className="learn-situations__problem">
            The problem: a higher dollar can put pressure on your naira budget.
          </p>
          <p>
            If the dollar-to-naira rate rises above your agreed rate, your hedge
            gains USDC. If it falls below your agreed rate, your hedge loses
            USDC from the funds you set aside. Gains stay locked until your
            hedge closes.
          </p>
        </article>
        <article>
          <span className="brand-label">USD seller</span>
          <h2>Selling dollars later</h2>
          <p className="learn-situations__problem">
            The problem: a stronger naira can reduce the naira value of your
            dollar income.
          </p>
          <p>
            If the dollar-to-naira rate falls below your agreed rate, your hedge
            gains USDC. If it rises above your agreed rate, your hedge loses
            USDC from the funds you set aside. Gains stay locked until your
            hedge closes.
          </p>
        </article>
      </section>
      <div className="brand-section">
        <div className="brand-section-heading">
          <h2>
            Set up your hedge.
            <br />
            Follow its progress.
          </h2>
        </div>
        <HedgeJourney />
      </div>
      <HedgeExample />
      <section className="learn-formula" aria-labelledby="formula-title">
        <div>
          <h2 id="formula-title">
            How the buyer’s gain
            <br />
            or loss is calculated
          </h2>
          <strong>V = N × (R − K) ÷ R</strong>
        </div>
        <dl>
          <div>
            <dt>N</dt>
            <dd>Dollar amount your hedge covers</dd>
          </div>
          <div>
            <dt>K</dt>
            <dd>Your agreed rate in naira per dollar</dd>
          </div>
          <div>
            <dt>R</dt>
            <dd>Confirmed reference rate in naira per dollar</dd>
          </div>
        </dl>
      </section>
      <div className="example-ledger">
        <div>
          <span>Example hedge amount</span>
          <strong>$1,000</strong>
        </div>
        <div>
          <span>Agreed rate</span>
          <strong>₦1,650 / USD</strong>
        </div>
        <div className="positive">
          <span>If rate is ₦1,700</span>
          <strong>Buyer +29.411764 USDC</strong>
        </div>
        <div className="negative">
          <span>If rate is ₦1,600</span>
          <strong>Buyer −31.250000 USDC</strong>
        </div>
      </div>
      <div className="risk-note">
        <Info aria-hidden="true" />
        <p>
          Gains stay locked until your hedge closes. If either side runs out of
          funds, the hedge closes in default. You may receive less than the
          calculated amount, and any unpaid amount is not insured.
        </p>
      </div>
      <Link className="hm-button hm-button--lg" to="/market">
        Try an example hedge
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
      <section className="mm-context-callout">
        <span className="brand-label">For market makers</span>
        <p>{marketMakerRelease.placements.learn}</p>
        <Link className="text-link" to="/market-makers">
          Explore market making
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

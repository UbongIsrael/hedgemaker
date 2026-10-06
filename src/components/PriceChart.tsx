import { useId, useState } from "react";
import { buyerPayoffRaw, formatFixed, parseUsdc } from "@/domain";
import rosette from "@/assets/brand/engraved-rosette.svg";

const notional = parseUsdc("1000");
const strike = 1650n;
const rates = Array.from({ length: 21 }, (_, index) => 1550 + index * 10);
const x = (rate: number) => 56 + (rate - 1550) * 2.02;
const y = (value: bigint) => 146 - (Number(value) / 1e6) * 1.5;
const points = rates.map((rate) => ({
  rate,
  value: buyerPayoffRaw(notional, strike, BigInt(rate)),
}));
const line = (seller: boolean) =>
  points
    .map(
      ({ rate, value }, index) =>
        `${index === 0 ? "M" : "L"} ${x(rate)} ${y(seller ? -value : value)}`,
    )
    .join(" ");

/** Real domain-math visualization: calculated value, never a live rate or payout promise. */
export function PriceChart({ compact = false }: { compact?: boolean }) {
  const id = useId().replace(/:/g, "");
  const [rate, setRate] = useState(1700);
  const buyer = buyerPayoffRaw(notional, strike, BigInt(rate));
  const signed = (value: bigint) =>
    `${value > 0n ? "+" : ""}${formatFixed(value, 2, 6)}`;
  const patternId = `chart-pattern-${id}`;
  return (
    <div className={`price-chart${compact ? " price-chart--compact" : ""}`}>
      <div className="price-chart__heading">
        <strong>One rate. Two sides.</strong>
        <span>$1,000 example · agreed rate ₦1,650</span>
      </div>
      <svg
        viewBox="0 0 520 300"
        role="img"
        aria-labelledby={`chart-title-${id} chart-desc-${id}`}
      >
        <title id={`chart-title-${id}`}>
          Buyer and seller calculated value as the reference rate changes
        </title>
        <desc id={`chart-desc-${id}`}>
          For a $1,000 hedge agreed at ₦1,650 per dollar, the buyer gains as the
          reference rate rises and the seller gains as it falls. At ₦{rate}, the
          calculated buyer value is {signed(buyer)} USDC and seller value is{" "}
          {signed(-buyer)} USDC, before fees or default.
        </desc>
        <defs>
          <pattern
            id={patternId}
            width="95"
            height="95"
            patternUnits="userSpaceOnUse"
          >
            <image href={rosette} width="95" height="95" opacity="0.28" />
          </pattern>
        </defs>
        {[56, 157, 258, 359, 460].map((value) => (
          <line
            key={value}
            x1={value}
            x2={value}
            y1="40"
            y2="250"
            className="price-chart__grid"
          />
        ))}
        {[56, 101, 146, 191, 236].map((value) => (
          <line
            key={value}
            x1="56"
            x2="460"
            y1={value}
            y2={value}
            className="price-chart__grid"
          />
        ))}
        <path
          d={`${line(false)} L 460 146 L 56 146 Z`}
          fill="#2563EB"
          opacity="0.06"
        />
        <path
          d={`${line(false)} L 460 146 L 56 146 Z`}
          fill={`url(#${patternId})`}
        />
        <path
          d={`${line(true)} L 460 146 L 56 146 Z`}
          fill="#0B493A"
          opacity="0.05"
        />
        <path
          d={`${line(true)} L 460 146 L 56 146 Z`}
          fill={`url(#${patternId})`}
        />
        <line
          x1="56"
          x2="460"
          y1="146"
          y2="146"
          className="price-chart__zero"
        />
        <line
          x1="258"
          x2="258"
          y1="40"
          y2="250"
          className="price-chart__agreed"
        />
        <path
          d={line(false)}
          className="price-chart__line price-chart__line--buyer"
        />
        <path
          d={line(true)}
          className="price-chart__line price-chart__line--seller"
        />
        <g
          className="price-chart__point"
          style={{ transform: `translate(${x(rate)}px, ${y(buyer)}px)` }}
        >
          <circle r="7" fill="#2563EB" />
        </g>
        <g
          className="price-chart__point"
          style={{ transform: `translate(${x(rate)}px, ${y(-buyer)}px)` }}
        >
          <circle r="7" fill="#0B493A" />
        </g>
        <text x="45" y="60" textAnchor="end">
          +60
        </text>
        <text x="45" y="151" textAnchor="end">
          0
        </text>
        <text x="45" y="240" textAnchor="end">
          −60
        </text>
        <text x="56" y="272" textAnchor="middle">
          ₦1,550
        </text>
        <text x="258" y="272" textAnchor="middle">
          ₦1,650
        </text>
        <text x="460" y="272" textAnchor="middle">
          ₦1,750
        </text>
        <text x="56" y="22">
          Calculated value (USDC)
        </text>
        <text x="258" y="297" textAnchor="middle">
          Reference rate · naira per USD
        </text>
      </svg>
      <div className="price-chart__legend">
        <span>
          <i className="price-chart__key--buyer" />
          USD buyer
        </span>
        <span>
          <i className="price-chart__key--seller" />
          USD seller
        </span>
      </div>
      {!compact && (
        <>
          <div
            className="price-chart__choices"
            role="group"
            aria-label="Choose an illustrative reference rate"
          >
            {[1600, 1650, 1700].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={rate === value}
                onClick={() => setRate(value)}
              >
                ₦{value.toLocaleString("en-NG")}
              </button>
            ))}
          </div>
          <div
            className="price-chart__values"
            aria-live="polite"
            aria-atomic="true"
          >
            <span>
              Buyer <strong>{signed(buyer)} USDC</strong>
            </span>
            <span>
              Seller <strong>{signed(-buyer)} USDC</strong>
            </span>
          </div>
        </>
      )}
      <p className="price-chart__note">
        Illustrative calculation, before fees or defaults. Gains stay locked
        until closure.
      </p>
    </div>
  );
}

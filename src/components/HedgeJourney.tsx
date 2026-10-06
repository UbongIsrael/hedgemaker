import {
  ArrowRight,
  CalendarDays,
  Check,
  LockKeyhole,
  Wallet,
} from "lucide-react";
import { useState } from "react";

const steps = [
  {
    title: "Choose your goal",
    body: "Buying or selling dollars later? Choose the option that fits your plans.",
    detail: "Buyer or seller",
    icon: ArrowRight,
  },
  {
    title: "Review the protection",
    body: "Review your rate, end date, required funds and fees. See what could happen if the rate moves against you.",
    detail: "Rate, date, funds & fees",
    icon: CalendarDays,
  },
  {
    title: "Match and track",
    body: "Your order can match with someone taking the other side. Confirmed rate updates adjust the funds locked in your hedge.",
    detail: "Separate funds. Confirmed updates.",
    icon: LockKeyhole,
  },
  {
    title: "Withdraw your remaining funds",
    body: "Once your hedge closes, your remaining funds become available to withdraw to your wallet.",
    detail: "Available after closure",
    icon: Wallet,
  },
] as const;

export function HedgeJourney() {
  const [active, setActive] = useState(0);
  const step = steps[active] ?? steps[0];
  const Icon = step.icon;
  return (
    <div className={`hedge-journey hedge-journey--${active}`}>
      <ol
        className="hedge-journey__steps"
        aria-label="Explore the four stages of a hedge"
      >
        {steps.map((step, index) => (
          <li key={step.title}>
            <button
              type="button"
              aria-pressed={index === active}
              onClick={() => setActive(index)}
            >
              <span className="hedge-journey__number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{step.title}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <div className="hedge-journey__explanation">
        <div className="journey-track" aria-hidden="true">
          {steps.map((step, index) => (
            <span
              key={step.title}
              className={index <= active ? "journey-track__complete" : ""}
            >
              {index < active ? <Check size={20} /> : index + 1}
            </span>
          ))}
          <i className="journey-track__marker" />
        </div>
        <div className="journey-illustration" aria-hidden="true">
          <div className="journey-illustration__tile">
            <Icon size={42} strokeWidth={1.3} />
          </div>
          <span>{step.detail}</span>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </div>
        <p className="journey-limit">
          Gains stay locked until closure. Protection is limited to the funds
          backing the hedge.
        </p>
      </div>
    </div>
  );
}

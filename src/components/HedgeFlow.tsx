import { Pause, Play } from "lucide-react";
import { useState } from "react";
import sculpture from "@/assets/brand/images/currency-sculpture.webp";

/** A conceptual participation diagram, not a market quote or product screenshot. */
export function HedgeFlow() {
  const [paused, setPaused] = useState(false);
  return (
    <figure
      className={`hedge-flow${paused ? " hedge-flow--paused" : ""}`}
      aria-label="A future dollar buyer and seller can match in a funded hedge"
    >
      <div className="hedge-flow__nodes">
        <div className="hedge-flow__node">
          <span>Buying dollars later</span>
          <strong>Your future purchase</strong>
        </div>
        <span className="hedge-flow__connection" aria-hidden="true">
          <i />
        </span>
        <div className="hedge-flow__join" aria-hidden="true">
          ₦
        </div>
        <span
          className="hedge-flow__connection hedge-flow__connection--reverse"
          aria-hidden="true"
        >
          <i />
        </span>
        <div className="hedge-flow__node">
          <span>Selling dollars later</span>
          <strong>Your future income</strong>
        </div>
      </div>
      <img
        className="hedge-flow__image"
        src={sculpture}
        alt="Interlocking forest-green paper ribbons etched with woven and banknote-inspired patterns, a lime diamond and blue sphere"
        width="1536"
        height="1024"
        fetchPriority="high"
      />
      <figcaption>
        <span>Two plans. One matched hedge.</span>
        <small>Compatible orders and separate backing funds required.</small>
      </figcaption>
      <button
        className="motion-control"
        type="button"
        onClick={() => setPaused(!paused)}
        aria-label={
          paused ? "Play diagram animation" : "Pause diagram animation"
        }
        aria-pressed={paused}
      >
        {paused ? (
          <Play size={14} aria-hidden="true" />
        ) : (
          <Pause size={14} aria-hidden="true" />
        )}
      </button>
    </figure>
  );
}

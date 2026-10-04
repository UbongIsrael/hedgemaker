import type { ReactNode } from "react";

export type StatProps = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
};

export function Stat({ label, value, detail, trend = "neutral", className = "" }: StatProps) {
  return (
    <dl className={["hm-stat", className].filter(Boolean).join(" ")}>
      <dt className="hm-stat__label">{label}</dt>
      <dd className="hm-stat__value">{value}</dd>
      {detail != null && <dd className={["hm-stat__detail", `hm-stat__detail--${trend}`].join(" ")}>{detail}</dd>}
    </dl>
  );
}

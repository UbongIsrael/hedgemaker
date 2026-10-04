import type { HTMLAttributes, ReactNode } from "react";

export type ProgressProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  value: number;
  max?: number;
  label: string;
  valueLabel?: ReactNode;
  showValue?: boolean;
};

export function Progress({ value, max = 100, label, valueLabel, showValue = true, className = "", ...props }: ProgressProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const percent = (safeValue / safeMax) * 100;
  return (
    <div className={["hm-progress", className].filter(Boolean).join(" ")} {...props}>
      <div className="hm-progress__heading">
        <span className="hm-progress__label">{label}</span>
        {showValue && <span className="hm-progress__value">{valueLabel ?? `${Math.round(percent)}%`}</span>}
      </div>
      <div className="hm-progress__track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={safeValue}>
        <div className="hm-progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export type MarginBarProps = Omit<ProgressProps, "value" | "max" | "label" | "valueLabel" | "showValue"> & {
  used: number;
  total: number;
  label?: string;
  formatAmount?: (amount: number) => ReactNode;
  tone?: "default" | "warning" | "danger";
};

export function MarginBar({ used, total, label = "Margin used", formatAmount = (amount) => amount.toLocaleString(), tone = "default", className = "", ...props }: MarginBarProps) {
  const totalSafe = Number.isFinite(total) && total > 0 ? total : 0;
  const usedSafe = Number.isFinite(used) ? Math.max(used, 0) : 0;
  const percent = totalSafe ? Math.min((usedSafe / totalSafe) * 100, 100) : 0;
  const remaining = Math.max(totalSafe - usedSafe, 0);
  return (
    <div className={["hm-margin-bar", `hm-margin-bar--${tone}`, className].filter(Boolean).join(" ")} {...props}>
      <div className="hm-margin-bar__heading">
        <span>{label}</span>
        <span>{formatAmount(usedSafe)} / {formatAmount(totalSafe)}</span>
      </div>
      <div className="hm-margin-bar__track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={totalSafe} aria-valuenow={Math.min(usedSafe, totalSafe)} aria-valuetext={`${formatAmount(usedSafe)} of ${formatAmount(totalSafe)} used`}>
        <div className="hm-margin-bar__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="hm-margin-bar__remaining">{formatAmount(remaining)} remaining</div>
    </div>
  );
}

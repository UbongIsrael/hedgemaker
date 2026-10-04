import type { HTMLAttributes } from "react";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "info";
};

export function Badge({ variant = "default", className = "", ...props }: BadgeProps) {
  return <span className={["hm-badge", `hm-badge--${variant}`, className].filter(Boolean).join(" ")} {...props} />;
}

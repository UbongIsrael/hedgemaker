import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  fullWidth = false,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = ["hm-button", `hm-button--${variant}`, `hm-button--${size}`, fullWidth && "hm-button--full", className]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} type={type} {...props}>{children}</button>;
}

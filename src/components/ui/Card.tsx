import type { HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLElement> & { as?: "article" | "section" | "div" };
export type CardPartProps = HTMLAttributes<HTMLDivElement>;

export function Card({ as: Component = "section", className = "", ...props }: CardProps) {
  return <Component className={["hm-card", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardHeader({ className = "", ...props }: CardPartProps) {
  return <div className={["hm-card__header", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={["hm-card__title", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={["hm-card__description", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardContent({ className = "", ...props }: CardPartProps) {
  return <div className={["hm-card__content", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardFooter({ className = "", ...props }: CardPartProps) {
  return <div className={["hm-card__footer", className].filter(Boolean).join(" ")} {...props} />;
}

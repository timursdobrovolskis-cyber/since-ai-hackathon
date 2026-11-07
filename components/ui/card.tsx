import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLElement>;

export function Card({ className = "", ...props }: Props) {
  return <section className={`rounded-md border border-line bg-panel ${className}`} {...props} />;
}

export function CardHeader({ className = "", ...props }: Props) {
  return <header className={`px-4 pt-3 pb-2 ${className}`} {...props} />;
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`font-cond text-lg leading-tight font-semibold ${className}`} {...props} />;
}

export function CardDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-[13px] text-ink-2 ${className}`} {...props} />;
}

export function CardContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-4 pb-4 ${className}`} {...props} />;
}

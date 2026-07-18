import type { HTMLAttributes } from "react";

export default function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-card border border-border/10 rounded-card p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

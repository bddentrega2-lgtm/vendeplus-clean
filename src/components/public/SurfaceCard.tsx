import type { ReactNode } from "react";

export function SurfaceCard({
  children,
  className = "",
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div className={`${dark ? "somos-card-dark" : "somos-card"} ${className}`.trim()}>
      {children}
    </div>
  );
}

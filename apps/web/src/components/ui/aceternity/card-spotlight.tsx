import { cn } from "@/lib/cn";

/**
 * CardSpotlight — Aceternity-style (§1.3).
 *
 * A plain card container (rounded tile, hairline border, surface fill).
 * The cursor-following glow layer was removed — hover is communicated
 * through borders and elevation instead.
 *
 * Usage: wrap any card content to get the shared card shell.
 */
export function CardSpotlight({
  className,
  children,
  ...props
}: {
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("surface-card relative overflow-hidden", className)} {...props}>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

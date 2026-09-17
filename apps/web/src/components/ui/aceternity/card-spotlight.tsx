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
  radius: _radius = 250,
  ...props
}: {
  className?: string;
  children: React.ReactNode;
  /** @deprecated — kept so existing call sites don't change; no longer used. */
  radius?: number;
} & React.HTMLAttributes<HTMLDivElement>) {
  void _radius;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border border-line bg-surface-2",
        className,
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

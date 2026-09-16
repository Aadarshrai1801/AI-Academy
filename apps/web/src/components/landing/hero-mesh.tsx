import { cn } from "@/lib/cn";

/**
 * Hero backdrop (§2.1).
 *
 * A slow-drifting gradient mesh over a faint engineering grid, done entirely in
 * CSS transforms on two absolutely-positioned layers. No canvas, no rAF loop,
 * no per-frame JS: the drift is one `transform` keyframe on the compositor, and
 * the grid is a repeating-linear-gradient, so it costs nothing on a low-end
 * device (§5). `aria-hidden` because it is pure decoration, and it is dropped
 * for reduced-motion users by the global guard.
 */
export function HeroMesh({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      {/* Engineering grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--line-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--line-strong) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 90% 60% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 60% at 50% 0%, black 40%, transparent 100%)",
        }}
      />

      {/* Drifting colour mesh */}
      <div
        className="absolute -top-[45%] left-1/2 h-[70rem] w-[70rem] -translate-x-1/2 animate-mesh-drift rounded-full blur-[130px]"
        style={{
          backgroundImage:
            "radial-gradient(closest-side, rgba(249,115,22,0.30), transparent 70%), radial-gradient(closest-side at 70% 40%, rgba(139,92,246,0.22), transparent 70%), radial-gradient(closest-side at 30% 70%, rgba(34,211,238,0.14), transparent 70%)",
        }}
      />

      {/* Fade the whole thing into the page so it never ends in a hard edge. */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-surface-0" />
    </div>
  );
}

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
 *
 * Alphas are tuned for the white canvas: the values that glowed on near-black
 * wash the page out and fight the headline here, so they are roughly halved.
 */
import { Spotlight } from "@/components/ui/aceternity/spotlight";

export function HeroMesh({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      {/* High-end Aceternity Spotlight effect in pure white */}
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20 opacity-40"
        fill="white"
      />

      {/* Engineering technical grid */}
      <div
        className="absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 90%)",
        }}
      />

      {/* Subtle silver/white ambient glow centered above the headline */}
      <div
        className="absolute -top-[30%] left-1/2 h-[50rem] w-[50rem] -translate-x-1/2 rounded-full blur-[140px] opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.08) 50%, transparent 75%)",
        }}
      />

      {/* Smooth bottom fade into page background */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-surface-0" />
    </div>
  );
}

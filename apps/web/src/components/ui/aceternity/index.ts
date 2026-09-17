/**
 * Aceternity UI primitives — ported and recolored to the SaaS token system
 * (§1.3, §3).
 *
 * These are the effect vocabulary for the whole product. Every effect uses the
 * neutral surface ramp and the single indigo accent — the colorful Aceternity
 * defaults have been deprecated in favor of the token system.
 */

// Backgrounds & textures
export { Spotlight } from "./spotlight";
export { GridBackground } from "./grid-background";
export { BackgroundBeams, AuroraBackground } from "./background-beams";
export { BackgroundGradient } from "./background-gradient";

// Text effects
export { TextGenerateEffect } from "./text-generate-effect";
export { TypewriterEffect } from "./typewriter-effect";

// Card effects
export { CardSpotlight } from "./card-spotlight";
export { ThreeDCard } from "./3d-card";
export { BentoGrid, BentoGridItem } from "./bento-grid";

// Border effects
export { MovingBorder } from "./moving-border";
export { HoverBorderGradient } from "./hover-border-gradient";

// Motion effects
export { InfiniteMovingCards } from "./infinite-moving-cards";
export { Meteors, MeteorBurst } from "./meteors";

// Interactive
export { AnimatedTooltip } from "./animated-tooltip";
export { PlaceholdersAndVanishInput } from "./placeholders-vanish-input";
export { AnimatedTabs } from "./tabs";

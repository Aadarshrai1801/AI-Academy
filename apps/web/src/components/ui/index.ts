/**
 * AI Academy UI kit — shared primitives (§3).
 *
 * Build order note: pages consume these instead of hand-rolling motion or
 * color, which is what keeps animations consistent instead of per-page.
 */
export { buttonStyles, type ButtonVariant, type ButtonSize } from "./button-styles";
export { Button } from "./button";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardEyebrow,
} from "./card";
export { Badge, DifficultyBadge } from "./badge";
export { Skeleton, SkeletonText, SkeletonRow, SkeletonChart } from "./skeleton";
export { AnimatedNumber } from "./animated-number";
export { ProgressBar, ProgressRing, accuracyTone, quotaTone } from "./progress";
export { EmptyState } from "./empty-state";
export { LogoMark } from "./logo";
export { PageTransition } from "./page-transition";
export { ToastProvider, useToast } from "./toast";

// Aceternity UI primitives (§1.3)
export {
  Spotlight,
  GridBackground,
  BackgroundBeams,
  CardSpotlight,
  ThreeDCard,
  MovingBorder,
} from "./aceternity";

export { ThemeToggle } from "./theme-toggle";


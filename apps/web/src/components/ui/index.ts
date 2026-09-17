/**
 * AI Academy UI kit — shared primitives (§3).
 *
 * Build order note: pages consume these instead of hand-rolling motion or
 * color, which is what keeps animations consistent instead of per-page.
 */
export { buttonStyles, type ButtonVariant, type ButtonSize } from "./button-styles";
export { Button, IconButton, type ButtonProps } from "./button";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardEyebrow,
  type CardProps,
} from "./card";
export {
  Badge,
  DifficultyBadge,
  type BadgeProps,
  type BadgeVariant,
  type BadgeSize,
  type Difficulty,
} from "./badge";
export { Skeleton, SkeletonText, SkeletonRow, SkeletonChart } from "./skeleton";
export { AnimatedNumber, type AnimatedNumberProps } from "./animated-number";
export {
  ProgressBar,
  ProgressRing,
  accuracyTone,
  quotaTone,
  type ProgressBarProps,
  type ProgressRingProps,
  type ProgressTone,
} from "./progress";
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { LogoMark, type LogoMarkProps } from "./logo";
export { PageTransition } from "./page-transition";
export { ToastProvider, useToast, type ToastOptions, type ToastVariant } from "./toast";

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


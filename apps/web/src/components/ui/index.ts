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
  CardFooter,
  CardEyebrow,
  StatCard,
  type CardProps,
  type StatCardProps,
} from "./card";
export {
  Badge,
  StatusBadge,
  DifficultyBadge,
  type BadgeProps,
  type BadgeVariant,
  type BadgeSize,
  type StatusBadgeProps,
  type Difficulty,
} from "./badge";
export { Skeleton, SkeletonText, SkeletonStat, SkeletonRow, SkeletonChart } from "./skeleton";
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
export { EmptyState, EmptyStateDashed, type EmptyStateProps } from "./empty-state";
export { PageTransition } from "./page-transition";
export { ToastProvider, useToast, type ToastOptions, type ToastVariant } from "./toast";

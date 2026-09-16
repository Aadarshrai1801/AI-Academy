import { PageTransition } from "@/components/ui";

/**
 * Route-level transition boundary (§3, §5).
 *
 * Next remounts a `template.tsx` subtree on every navigation, which is exactly
 * the trigger `PageTransition` needs — no pathname bookkeeping, no
 * `AnimatePresence` over server components.
 *
 * The wrapper must keep the flex chain intact: layouts render
 * `<main class="flex flex-1 flex-col">` and pages put `flex-1` on their own
 * root, so an intermediate `div` has to be a flex column too, otherwise pages
 * would stop filling the viewport height.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition className="flex min-h-0 flex-1 flex-col">{children}</PageTransition>;
}

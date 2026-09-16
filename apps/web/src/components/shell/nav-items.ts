import {
  LayoutDashboard,
  Sparkles,
  Trophy,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for workbench navigation.
 *
 * The desktop rail, the mobile drawer, and breadcrumbs all read from here, so
 * a route can never drift between the three (§2.8).
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Used as the item's tooltip / secondary line. */
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/practice", label: "Practice", icon: Zap, description: "Solve today's questions" },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, description: "Daily epoch rankings" },
  { href: "/ask", label: "AI Tutor", icon: Sparkles, description: "Ask a technical question" },
  { href: "/groups", label: "Study Groups", icon: Users, description: "Cohorts and shared problems" },
  { href: "/calls", label: "Live Calls", icon: Video, description: "1:1 and group sessions" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Streaks, points, analytics" },
];

/** `/groups` stays active on `/groups/<id>`, but `/practice` never matches `/practice-old`. */
export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SEGMENT_LABELS: Record<string, string> = {
  practice: "Practice",
  leaderboard: "Leaderboard",
  ask: "AI Tutor",
  groups: "Study Groups",
  calls: "Live Calls",
  dashboard: "Dashboard",
  admin: "Admin",
  pricing: "Pricing",
  watch: "Video",
  privacy: "Privacy",
  terms: "Terms",
};

/** Human label for the detail segment of a dynamic route. */
const DETAIL_LABELS: Record<string, string> = {
  groups: "Room",
  calls: "Call",
  watch: "Player",
  admin: "Panel",
};

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Path → breadcrumb trail. Raw ids (Mongo ObjectIds, Clerk ids) are replaced
 * with a human label ("Room", "Call") rather than being rendered verbatim.
 */
export function buildBreadcrumb(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Workbench" }];

  const looksLikeId = (segment: string) => /^[0-9a-f]{12,}$/i.test(segment) || segment.length > 24;

  return segments.map((segment, index) => {
    const isLast = index === segments.length - 1;
    const label = looksLikeId(segment)
      ? (DETAIL_LABELS[segments[index - 1]] ?? "Detail")
      : (SEGMENT_LABELS[segment] ?? decodeURIComponent(segment));
    return isLast ? { label } : { label, href: `/${segments.slice(0, index + 1).join("/")}` };
  });
}

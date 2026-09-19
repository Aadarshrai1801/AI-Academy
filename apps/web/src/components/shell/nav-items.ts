import {
  MessageSquare,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for workbench navigation.
 *
 * The desktop rail, the mobile drawer, and breadcrumbs all read from here, so
 * a route can never drift between the three (§2.8).
 *
 * Dashboard is deliberately NOT a workbench item: it now lives in the profile
 * menu (avatar → Dashboard), keeping the rail focused on the practice loop.
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
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, description: "Daily rankings & scores" },
  { href: "/ask", label: "AI Tutor", icon: Sparkles, description: "Ask any learning question" },
  { href: "/groups", label: "Study Groups", icon: Users, description: "Learn with friends" },
  { href: "/messages", label: "Messages", icon: MessageSquare, description: "Personalized 1:1 study chats" },
  { href: "/progress", label: "Progress", icon: TrendingUp, description: "Topic mastery & placement" },
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
  messages: "Direct Messages",
  calls: "Live Calls",
  dashboard: "Dashboard",
  progress: "Progress",
  admin: "Admin",
  pricing: "Pricing",
  watch: "Video",
  privacy: "Privacy",
  terms: "Terms",
};

/** Human label for the detail segment of a dynamic route. */
const DETAIL_LABELS: Record<string, string> = {
  groups: "Room",
  messages: "Chat",
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
  if (segments.length === 0) return [{ label: "Home" }];

  const looksLikeId = (segment: string) => /^[0-9a-f]{12,}$/i.test(segment) || segment.length > 24;

  return segments.map((segment, index) => {
    const isLast = index === segments.length - 1;
    const label = looksLikeId(segment)
      ? (DETAIL_LABELS[segments[index - 1]] ?? "Detail")
      : (SEGMENT_LABELS[segment] ?? decodeURIComponent(segment));
    return isLast ? { label } : { label, href: `/${segments.slice(0, index + 1).join("/")}` };
  });
}

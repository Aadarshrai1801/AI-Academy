"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LandingChrome } from "@/components/landing/landing-chrome";
import { DisplayNameSync } from "@/components/shell/display-name-sync";
import { MobileBottomNav } from "@/components/shell/mobile-bottom-nav";
import { MobileDrawer } from "@/components/shell/mobile-drawer";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { GridBackground } from "@/components/ui";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/cn";

/**
 * Application shell (§2.8).
 *
 * Marketing routes render the landing chrome; everything else renders the
 * workbench frame (rail + top bar + content). Telemetry is fetched once here
 * and handed to the rail, top bar, and drawer so the three never disagree.
 *
 * Features:
 * - Subtle Aceternity dot-grid background overlay
 * - Collapsible rail (w-60 <-> w-16) with coordinated content padding transition
 * - Mobile drawer parity with desktop workbench rail
 * - Floating mobile bottom navigation dock (<768px)
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const telemetry = useTelemetry();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (pathname === "/") {
    return <LandingChrome>{children}</LandingChrome>;
  }

  return (
    <div className="relative flex min-h-screen bg-surface-0 font-sans text-fg">
      {/* Background dot grid texture */}
      <GridBackground
        variant="dot-faint"
        className="pointer-events-none fixed inset-0 z-0 opacity-30"
      />

      <DisplayNameSync summary={telemetry.summary} />
      <Sidebar
        telemetry={telemetry}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />

      <div
        className={cn(
          "relative z-10 flex min-w-0 flex-1 flex-col pb-20 transition-[padding] duration-200 ease-out md:pb-0",
          collapsed ? "md:pl-16" : "md:pl-60",
        )}
      >
        <Topbar telemetry={telemetry} onOpenDrawer={() => setDrawerOpen(true)} />
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          telemetry={telemetry}
        />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        <MobileBottomNav />
      </div>
    </div>
  );
}

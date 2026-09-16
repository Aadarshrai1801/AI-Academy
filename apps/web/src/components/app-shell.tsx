"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LandingChrome } from "@/components/landing/landing-chrome";
import { MobileDrawer } from "@/components/shell/mobile-drawer";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { useTelemetry } from "@/lib/telemetry";

/**
 * Application shell (§2.8).
 *
 * Marketing routes render the landing chrome; everything else renders the
 * workbench frame (rail + top bar + content). Telemetry is fetched once here
 * and handed to the rail, top bar, and drawer so the three never disagree.
 *
 * `pb-*` on mobile clears the iOS home indicator; the rail is hidden below
 * `md` in favour of the drawer.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const telemetry = useTelemetry();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (pathname === "/") {
    return <LandingChrome>{children}</LandingChrome>;
  }

  return (
    <div className="flex min-h-screen bg-surface-0 font-sans text-fg">
      <Sidebar telemetry={telemetry} />

      <div className="flex min-w-0 flex-1 flex-col pb-4 md:pb-0 md:pl-60">
        <Topbar telemetry={telemetry} onOpenDrawer={() => setDrawerOpen(true)} />
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          telemetry={telemetry}
        />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

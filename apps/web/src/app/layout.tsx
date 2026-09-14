import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com",
  ),
  title: {
    default: "AI Academy",
    template: "%s | AI Academy",
  },
  description:
    "Deliberate practice across backpropagation, transformers, GPU kernels, and distributed training. Compete on the daily leaderboard and master ML engineering.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    type: "website",
    siteName: "AI Academy",
    title: "AI Academy",
    description:
      "Gamified AI/ML practice: infinite questions, rankings, streaks, and tutoring.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Academy",
    description:
      "Gamified AI/ML practice: infinite questions, rankings, streaks, and tutoring.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      >
        <body className="min-h-full bg-[var(--substrate)] text-[var(--ink-chalk)] font-sans antialiased">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black"
          >
            Skip to content
          </a>
          <AppShell>
            <div id="main-content">{children}</div>
          </AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}

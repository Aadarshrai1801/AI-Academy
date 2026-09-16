import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { AppProviders } from "@/components/app-providers";

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
  // No explicit `icons` entry: `src/app/favicon.ico` is a Next.js file
  // convention and is served at /favicon.ico automatically. Duplicating it as
  // "/favicon.ico" emitted a conflicting <link rel="icon"> that 404'd.
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
  themeColor: "#fcfcfd",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full bg-surface-0 font-sans text-fg antialiased">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-btn focus:border focus:border-line-strong focus:bg-surface-2 focus:px-3 focus:py-2 focus:text-fg"
          >
            Skip to content
          </a>
          <AppProviders>
            <AppShell>
              <div id="main-content">{children}</div>
            </AppShell>
          </AppProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}

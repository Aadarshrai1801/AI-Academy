import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Link from "next/link";
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
  title: "Hoopr",
  description:
    "Deliberate practice across backpropagation, transformers, GPU kernels, and distributed training. Compete on the daily leaderboard and master ML engineering.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      >
        <body className="min-h-full bg-[var(--substrate)] text-[var(--ink-chalk)] font-sans antialiased">
          <AppShell>{children}</AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}

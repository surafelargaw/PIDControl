import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegistration } from "@/components/platform/service-worker-registration";
import { THEME_COLORS } from "@/lib/platform/theme";

export const metadata: Metadata = {
  title: "PID Trainer Platform",
  description: "Operator-focused PID training platform with simulator lab, stability coaching, scenarios, and instructor workflows."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: THEME_COLORS.light
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" data-theme-preference="system" suppressHydrationWarning>
      <head>
        <Script src="/theme-boot.js" strategy="beforeInteractive" />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

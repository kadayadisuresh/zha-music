import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppBackground } from "@/components/layout/AppBackground";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { FullPlayer } from "@/components/player/FullPlayer";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { ClientBootstrapper } from "@/components/layout/ClientBootstrapper";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import PWAUpdateToast from "@/components/pwa/PWAUpdateToast";
import { PlaybackAnnouncer } from "@/components/player/PlaybackAnnouncer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zha",
  description: "Zha — a better music experience",
  icons: {
    icon: "/logo.jpeg",
    shortcut: "/logo.jpeg",
    apple: "/logo.jpeg",
  },
};

import { MainLayout } from "@/components/layout/MainLayout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col antialiased bg-black text-white`}
      >
        <ClientBootstrapper />
        <PlaybackAnnouncer />
        <AppBackground />
        <OfflineBanner />
        <PWAUpdateToast />
        <InstallPrompt />
        <MainLayout>
          {children}
        </MainLayout>
        <MiniPlayer />
        <FullPlayer />
        <MobileBottomNav />
      </body>
    </html>
  );
}

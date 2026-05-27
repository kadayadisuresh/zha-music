import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppBackground } from "@/components/layout/AppBackground";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { FullPlayer } from "@/components/player/FullPlayer";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
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
  title: "YouTube Music Clone",
  description: "ZHA Better - YouTube Music Clone",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col antialiased bg-black text-[#fffff0]`}
      >
        <AppBackground />
        <OfflineBanner />
        <main className="flex-1 pb-[72px]">
          {children}
        </main>
        <MiniPlayer />
        <FullPlayer />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "Vault — a video vault for the discerning",
  description:
    "Vault is an editorial downloader for YouTube, Instagram, and TikTok. Save videos or extract audio with frame-accurate trim and zero noise.",
  keywords: [
    "Vault",
    "video downloader",
    "YouTube downloader",
    "Instagram downloader",
    "TikTok downloader",
    "audio extractor",
    "trim video",
  ],
  authors: [{ name: "Vault" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vault",
  },
  openGraph: {
    title: "Vault",
    description: "An editorial video & audio downloader with frame-accurate trim.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vault",
    description: "An editorial video & audio downloader with frame-accurate trim.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0d0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${interTight.variable} ${jetbrainsMono.variable} ${fraunces.variable} antialiased bg-background text-foreground min-h-screen overflow-x-hidden`}
      >
        {children}
        <Toaster />
        <SonnerToaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast:
                "!bg-[#16140f] !text-[#f5efe0] !border-[rgba(245,239,224,0.08)] !rounded-xl",
              description: "!text-[#8a8474]",
            },
          }}
        />
      </body>
    </html>
  );
}

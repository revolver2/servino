import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AttributionCapture } from "@/components/analytics/AttributionCapture";
import { getSiteUrl } from "@/lib/server/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Servino — A better home starts with the right pro",
    template: "%s | Servino",
  },
  description:
    "Choose your project, get a clear price, and connect with a trusted local professional. Now serving Toronto, Ontario.",
  openGraph: {
    title: "Servino — A better home starts with the right pro",
    description:
      "Choose your project, get a clear price, and connect with a trusted local professional. Now serving Toronto, Ontario.",
    url: siteUrl,
    siteName: "Servino",
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Servino — A better home starts with the right pro",
    description:
      "Choose your project, get a clear price, and connect with a trusted local professional.",
  },
};

export const viewport = {
  themeColor: "#FAF9F6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-CA"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-offwhite text-ink">
        <AttributionCapture />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}

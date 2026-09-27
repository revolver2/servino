import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/server/env";

const siteUrl = getSiteUrl();

// Session H — lists every real, currently-live public page (spec
// section 56). Deliberately NOT mass-generating location/service pages
// that don't exist yet (spec section 56's own instruction) — just the
// actual routes a visitor or crawler can reach today.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/toronto/wall-makeover`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/quote`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.1 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.1 },
  ];
}

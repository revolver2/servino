import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/server/env";

const siteUrl = getSiteUrl();

// Session H — private/authenticated surfaces were never previously
// excluded (spec section 56 SEO audit). None of these need to appear in
// search results, and /admin and /pro are already auth-gated server-side
// regardless — this is defense-in-depth against accidental indexing, not
// the actual access control.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/pro", "/api", "/confirm", "/quote/confirmation"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

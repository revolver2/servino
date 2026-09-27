import { redirect } from "next/navigation";

/**
 * `/quote` always enters at the first step. A returning visitor with
 * in-progress state (see QuoteProvider) sees their prior selections
 * pre-filled on that step rather than being force-redirected forward —
 * simpler and safer than a resume-to-furthest-step redirect.
 */
export default function QuoteIndexPage() {
  redirect("/quote/project");
}

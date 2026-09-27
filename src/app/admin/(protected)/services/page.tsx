import { services, serviceCategories } from "@/lib/services-data";
import { Card, PageHeader, StatusChip, EmptyState } from "@/components/admin/ui";

export const metadata = { title: "Services" };

const PRICING_MODE_LABEL: Record<string, string> = {
  EXACT_PRICE: "Exact price",
  STARTING_FROM: "Starting from",
  RANGE: "Range",
  QUOTE_ONLY: "Quote only",
  NO_PUBLIC_PRICE: "No public price",
};

export default function AdminServicesPage() {
  return (
    <div>
      <PageHeader
        title="Services"
        description="Configured services from src/lib/services-data.ts. Not the Pricing Lab — pricing/economics arrive in a later phase."
      />

      {services.length === 0 ? (
        <EmptyState title="No services configured" description="Add services in src/lib/services-data.ts." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-4 py-3">Service</th>
                <th scope="col" className="px-4 py-3">Slug</th>
                <th scope="col" className="px-4 py-3">Category</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Public pricing mode</th>
                <th scope="col" className="px-4 py-3">Location availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((s) => {
                const category = serviceCategories.find((c) => c.slug === s.categorySlug);
                return (
                  <tr key={s.slug} className="hover:bg-offwhite">
                    <td className="px-4 py-3 text-ink">
                      {s.name}
                      <span className="block text-xs text-ink-muted">{s.shortDescription}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{s.slug}</td>
                    <td className="px-4 py-3 text-ink-muted">{category?.name ?? s.categorySlug}</td>
                    <td className="px-4 py-3">
                      <StatusChip tone={s.enabled ? "teal" : "neutral"}>{s.enabled ? "Enabled" : "Disabled"}</StatusChip>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{PRICING_MODE_LABEL[s.publicPricingMode] ?? s.publicPricingMode}</td>
                    <td className="px-4 py-3 text-ink-muted">Toronto, ON (current launch city)</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

import { listPricingVersions } from "@/lib/admin/pricing";
import { getEnabledServices } from "@/lib/services-data";
import { Card, PageHeader } from "@/components/admin/ui";
import { PricingSimulator } from "@/components/admin/PricingSimulator";

export const metadata = { title: "Pricing simulator" };

export default async function AdminPricingSimulatorPage() {
  const versions = await listPricingVersions("toronto");
  const services = getEnabledServices().map((s) => ({ slug: s.slug, name: s.name }));

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Pricing simulator"
        description="Uses the exact same calculation engine as production — not a separate approximation. Works against any version, including drafts."
      />
      {versions.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-ink-muted">No pricing versions exist yet — create one first.</p>
        </Card>
      ) : (
        <PricingSimulator
          versions={versions.map((v) => ({ id: v.id, label: v.label, status: v.status }))}
          services={services}
        />
      )}
    </div>
  );
}

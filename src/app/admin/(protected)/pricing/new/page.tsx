import { getEnabledServices } from "@/lib/services-data";
import { Card, PageHeader } from "@/components/admin/ui";
import { PricingVersionForm } from "@/components/admin/PricingVersionForm";

export const metadata = { title: "New pricing version" };

export default function NewPricingVersionPage() {
  const services = getEnabledServices().map((s) => ({ slug: s.slug, name: s.name }));

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New draft pricing version"
        description="Created as a draft — nothing here takes effect until you activate it from the version detail page."
      />
      <Card className="p-6">
        <PricingVersionForm services={services} />
      </Card>
    </div>
  );
}

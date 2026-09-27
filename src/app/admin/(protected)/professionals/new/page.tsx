import { getEnabledServices } from "@/lib/services-data";
import { PageHeader, Card } from "@/components/admin/ui";
import { ProfessionalForm } from "@/components/admin/ProfessionalForm";

export const metadata = { title: "Add professional" };

export default function NewProfessionalPage() {
  const services = getEnabledServices().map((s) => ({ slug: s.slug, name: s.name }));

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add professional" description="Manually add a trusted professional for assignment." />
      <Card className="p-6">
        <ProfessionalForm
          mode="create"
          services={services}
          initial={{
            displayName: "",
            businessName: "",
            email: "",
            phone: "",
            serviceAreaNote: "",
            notes: "",
            verificationStatus: "MISSING",
            active: true,
            serviceSlugs: [],
          }}
        />
      </Card>
    </div>
  );
}

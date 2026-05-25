import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobIntakeForm } from "@/components/jobs/job-intake-form";

export default async function NewJobPage() {
  const { profile } = await requireProfile();

  return (
    <div className="max-w-[720px] mx-auto">
      <PageHeader
        back={{ href: "/dashboard/jobs", label: "Jobs" }}
        title="Post a new role"
        subtitle="Tell us what you're hiring for; we'll generate the candidate-facing posting."
      />
      <JobIntakeForm schoolId={profile.schoolId} />
    </div>
  );
}

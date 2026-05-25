import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PipelineList } from "./pipeline-list";

export default async function PipelinePage() {
  const { profile } = await requireProfile();
  return (
    <div>
      <PageHeader title="Pipeline" subtitle="All applications across roles" />
      <PipelineList schoolId={profile.schoolId} />
    </div>
  );
}

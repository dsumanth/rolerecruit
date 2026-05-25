import { requireProfile } from "@/lib/auth";
import { PipelineStageEditor } from "@/components/settings/pipeline-stage-editor";

export default async function PipelineSettingsPage() {
  const { profile } = await requireProfile();
  return <PipelineStageEditor schoolId={profile.schoolId} />;
}

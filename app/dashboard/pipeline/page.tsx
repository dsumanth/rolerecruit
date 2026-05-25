import { requireProfile } from "@/lib/auth";
import { PipelineList } from "./pipeline-list";

export default async function PipelinePage() {
  const { profile } = await requireProfile();

  return <PipelineList schoolId={profile.schoolId} />;
}

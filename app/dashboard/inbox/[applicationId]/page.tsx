import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { InboxThreadPanel } from "@/components/dashboard/inbox-thread-panel";

export default async function InboxThreadPage({
  params,
}: {
  params: { applicationId: string };
}) {
  await requireProfile();
  return (
    <div>
      <PageHeader title="Thread" subtitle="Reply directly or update the candidate's stage" />
      <InboxThreadPanel applicationId={params.applicationId} />
    </div>
  );
}

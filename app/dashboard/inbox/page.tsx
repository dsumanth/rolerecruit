import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { InboxList } from "@/components/dashboard/inbox-list";

export default async function InboxPage() {
  const { profile } = await requireProfile();
  return (
    <div>
      <PageHeader
        title="Inbox"
        subtitle="Conversations the agent escalated for your reply"
      />
      <InboxList schoolId={profile.schoolId} />
    </div>
  );
}

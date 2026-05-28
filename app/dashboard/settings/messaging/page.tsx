import { requireProfile } from "@/lib/auth";
import { ChannelRoutingTable } from "@/components/settings/channel-routing-table";
import { FaqEditor } from "@/components/settings/faq-editor";

export default async function MessagingSettingsPage() {
  const { profile } = await requireProfile();
  return (
    <div className="space-y-8">
      <ChannelRoutingTable schoolId={profile.schoolId} />
      <div className="pt-2 border-t border-hairline">
        <FaqEditor schoolId={profile.schoolId} />
      </div>
    </div>
  );
}

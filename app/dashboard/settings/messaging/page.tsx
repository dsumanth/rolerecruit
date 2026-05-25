import { requireProfile } from "@/lib/auth";
import { ChannelRoutingTable } from "@/components/settings/channel-routing-table";

export default async function MessagingSettingsPage() {
  const { profile } = await requireProfile();
  return <ChannelRoutingTable schoolId={profile.schoolId} />;
}

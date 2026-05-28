import { requireProfile } from "@/lib/auth";
import { ConversationAgentForm } from "@/components/settings/conversation-agent-form";

export default async function ConversationSettingsPage() {
  const { profile } = await requireProfile();
  return <ConversationAgentForm schoolId={profile.schoolId} />;
}

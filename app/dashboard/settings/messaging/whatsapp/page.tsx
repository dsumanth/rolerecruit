import { requireProfile } from "@/lib/auth";
import { WhatsAppSettings } from "./_components/whatsapp-settings";

export default async function WhatsAppSettingsPage() {
  const { profile } = await requireProfile();
  return <WhatsAppSettings schoolId={profile.schoolId} />;
}

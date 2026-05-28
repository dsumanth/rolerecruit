import { requireProfile } from "@/lib/auth";
import { NotificationsForm } from "@/components/settings/notifications-form";

export default async function NotificationsSettingsPage() {
  const { profile } = await requireProfile();
  return <NotificationsForm schoolId={profile.schoolId} />;
}

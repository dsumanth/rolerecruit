import { requireProfile } from "@/lib/auth";
import { CalendarConfigForm } from "@/components/settings/calendar-config-form";

export default async function CalendarSettingsPage() {
  const { profile } = await requireProfile();
  return <CalendarConfigForm schoolId={profile.schoolId} />;
}

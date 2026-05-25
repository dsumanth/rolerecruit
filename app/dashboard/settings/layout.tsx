import { requireProfile } from "@/lib/auth";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireProfile();
  return (
    <div className="flex min-h-full">
      <SettingsNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}

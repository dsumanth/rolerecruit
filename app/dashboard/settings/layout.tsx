import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireProfile();
  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure how RoleRecruit works for your school" />
      <div className="grid grid-cols-[200px_1fr] gap-7 items-start">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

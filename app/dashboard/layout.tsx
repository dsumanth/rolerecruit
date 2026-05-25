import { requireProfile } from "@/lib/auth";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();

  return (
    <ConvexClientProvider>
      <div className="flex min-h-screen">
        <Sidebar
          userName={profile.name ?? profile.email ?? "User"}
          userRole={profile.role}
        />
        <main className="flex-1 p-8 min-w-0">{children}</main>
      </div>
    </ConvexClientProvider>
  );
}

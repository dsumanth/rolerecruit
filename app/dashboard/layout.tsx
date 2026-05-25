import { requireProfile } from "@/lib/auth";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireProfile();

  return (
    <ConvexClientProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 bg-surface-secondary">{children}</main>
      </div>
    </ConvexClientProvider>
  );
}

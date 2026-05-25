import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "@/app/globals.css";

export default function CareersPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return (
    <ConvexClientProvider>
      <div className="min-h-screen bg-surface-secondary">
        {children}
      </div>
    </ConvexClientProvider>
  );
}

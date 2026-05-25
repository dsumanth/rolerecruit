import { ConvexClientProvider } from "@/components/ConvexClientProvider";

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <div className="min-h-screen bg-surface-secondary">
        {children}
      </div>
    </ConvexClientProvider>
  );
}

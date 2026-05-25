import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { BrandMark } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <div className="min-h-screen">
        <header className="flex items-center gap-2.5 px-9 py-5 border-b border-hairline">
          <BrandMark />
          <span className="text-title-m text-ink">RoleRecruit</span>
        </header>
        <main className="max-w-[560px] mx-auto px-6 py-12">{children}</main>
      </div>
    </ConvexClientProvider>
  );
}

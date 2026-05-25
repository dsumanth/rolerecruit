import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { BrandMark } from "@/components/ui/brand-mark";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-2.5 px-9 py-5">
        <BrandMark />
        <span className="text-title-m text-ink">RoleRecruit</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <SignIn appearance={clerkAppearance} />
      </div>
    </div>
  );
}

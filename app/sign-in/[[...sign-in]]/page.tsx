import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-2.5 px-9 py-5">
        <div className="h-[26px] w-[26px] rounded-[7px] bg-accent-grad text-white text-[14px] font-bold flex items-center justify-center tracking-tight">
          R
        </div>
        <span className="text-title-m text-ink">RoleRecruit</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <SignIn appearance={clerkAppearance} />
      </div>
    </div>
  );
}

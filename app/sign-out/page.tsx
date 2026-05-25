import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default function SignOutPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary">
      <SignOutButton redirectUrl="/" />
    </div>
  );
}

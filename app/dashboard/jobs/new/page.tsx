import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { JobIntakeForm } from "@/components/jobs/job-intake-form";

export default async function NewJobPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const profile = await fetchQuery(api.users.getProfile, { userId });

  if (!profile) {
    redirect("/dashboard/onboarding");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Post a new role
        </h1>
        <p className="text-ink-secondary mt-1">
          Describe the teaching position and our AI will structure it.
        </p>
      </div>

      <div className="max-w-2xl">
        <JobIntakeForm schoolId={profile.schoolId} />
      </div>
    </div>
  );
}

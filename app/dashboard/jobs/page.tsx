import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { PageHeader, Button } from "@/components/ui";
import { JobsList } from "@/components/jobs/jobs-list";

export default async function JobsPage() {
  const { profile } = await requireProfile();

  return (
    <div>
      <PageHeader
        title="Jobs"
        actions={
          <Link href="/dashboard/jobs/new">
            <Button variant="ink" iconLeft="Plus">Post role</Button>
          </Link>
        }
      />
      <JobsList schoolId={profile.schoolId} />
    </div>
  );
}

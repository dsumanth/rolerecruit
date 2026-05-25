import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { requireProfile } from "@/lib/auth";

export default async function JobsPage() {
  const { profile } = await requireProfile();
  const jobs = await fetchQuery(api.jobs.listBySchool, { schoolId: profile.schoolId });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Jobs
          </h1>
          <p className="text-ink-secondary mt-1">Manage your open positions.</p>
        </div>
        <Link
          href="/dashboard/jobs/new"
          className="py-2.5 px-5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] active:bg-[#004999] transition-colors"
        >
          Post New Role
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-apple bg-surface border border-surface-tertiary p-8 text-center">
          <p className="text-ink-secondary text-sm">No jobs posted yet.</p>
          <Link
            href="/dashboard/jobs/new"
            className="inline-block mt-3 text-sm text-accent hover:text-[#0077ed]"
          >
            Create your first job posting
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link
              key={job._id}
              href={`/dashboard/jobs/${job._id}`}
              className="block rounded-apple bg-surface border border-surface-tertiary p-5 hover:border-[#0071e3] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{job.title}</h3>
                  <p className="text-[13px] text-ink-secondary mt-0.5">
                    {job.subject} · {job.level} · {job.board}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${
                  job.status === "active"
                    ? "bg-[#e8f5e9] text-[#34c759]"
                    : job.status === "draft"
                    ? "bg-surface-secondary text-ink-secondary"
                    : "bg-[#fff2f0] text-[#ff3b30]"
                }`}>
                  {job.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

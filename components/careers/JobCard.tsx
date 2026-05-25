import Link from "next/link";

interface Props {
  jobId: string;
  title: string;
  subject: string;
  level: string;
  qualifications: string[];
  minExperience?: number;
  slug: string;
}

export function JobCard({ jobId, title, subject, level, qualifications, minExperience, slug }: Props) {
  return (
    <Link
      href={`/careers/${slug}/jobs/${jobId}`}
      className="block rounded-apple bg-surface border border-hairline p-5 hover:shadow-md transition-shadow"
    >
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="flex flex-wrap gap-2 mt-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{subject}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-canvas text-ink-secondary">{level}</span>
      </div>
      <div className="mt-3 text-sm text-ink-secondary">
        <span>Qualifications: {qualifications.join(", ")}</span>
        {minExperience != null && <span className="ml-4">Exp: {minExperience}+ years</span>}
      </div>
    </Link>
  );
}

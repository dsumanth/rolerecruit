import Link from "next/link";

interface Props {
  jobId: string;
  title: string;
  subject: string;
  level: string;
  qualifications: string[];
  minExperience?: number;
  maxExperience?: number;
  salaryRange?: string;
  slug: string;
}

export function JobCard({
  jobId,
  title,
  subject,
  level,
  qualifications,
  minExperience,
  maxExperience,
  salaryRange,
  slug,
}: Props) {
  const expBand =
    minExperience != null && maxExperience != null
      ? `${minExperience}–${maxExperience} yrs`
      : minExperience != null
        ? `${minExperience}+ yrs`
        : null;

  const footParts = [qualifications.join(", "), expBand].filter(Boolean);

  return (
    <Link
      href={`/careers/${slug}/jobs/${jobId}`}
      className="block rounded-lg bg-surface border border-hairline px-7 py-6 shadow-elev-1 transition-shadow duration-base ease-apple-out hover:shadow-elev-2"
    >
      <div className="flex items-center gap-2.5 text-caption text-ink-secondary mb-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        <span>
          {subject} · {level}
        </span>
      </div>
      <h3 className="text-display-s text-ink mb-3.5 tracking-tight">{title}</h3>
      <p className="text-body-s text-ink-secondary">
        {footParts.join(" · ")}
        {salaryRange && (
          <>
            {footParts.length > 0 && <span> &middot; </span>}
            <strong className="text-ink font-medium">{salaryRange}</strong>
          </>
        )}
      </p>
    </Link>
  );
}

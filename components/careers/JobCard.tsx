import Link from "next/link";
import { Card, Badge, Icon } from "@/components/ui";

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
    <Link href={`/careers/${slug}/jobs/${jobId}`} className="block">
      <Card padding="md" elevation={1} interactive>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-title-m text-ink truncate">{title}</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="info">{subject}</Badge>
              <Badge variant="neutral">{level}</Badge>
            </div>
            <p className="text-body-s text-ink-secondary mt-3">
              {qualifications.join(", ")}
              {minExperience != null && <span className="text-ink-tertiary"> · {minExperience}+ years</span>}
            </p>
          </div>
          <Icon name="ArrowRight" size={16} color="var(--ink-3)" className="mt-1 flex-shrink-0" />
        </div>
      </Card>
    </Link>
  );
}

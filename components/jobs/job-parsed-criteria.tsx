import { Card, Badge } from "@/components/ui";

interface ParsedCriteria {
  subjects: string[];
  board: string;
  level: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  minExperience?: number | null;
  skills: string[];
}

interface Props {
  criteria?: ParsedCriteria | null;
}

export function JobParsedCriteria({ criteria }: Props) {
  if (!criteria) {
    return (
      <Card padding="lg" elevation={1}>
        <p className="text-body-s text-ink-secondary">
          No parsed criteria yet. Once the role description is processed, requirements and skills will appear here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {criteria.subjects.length > 0 && (
        <Card padding="md" elevation={1}>
          <div className="text-micro text-ink-secondary mb-2">Subjects</div>
          <div className="flex flex-wrap gap-2">
            {criteria.subjects.map((s) => (
              <Badge key={s} variant="neutral">{s}</Badge>
            ))}
          </div>
        </Card>
      )}
      {criteria.requiredQualifications.length > 0 && (
        <Card padding="md" elevation={1}>
          <div className="text-micro text-ink-secondary mb-2">Required qualifications</div>
          <div className="flex flex-wrap gap-2">
            {criteria.requiredQualifications.map((q) => (
              <Badge key={q} variant="info">{q}</Badge>
            ))}
          </div>
        </Card>
      )}
      {criteria.preferredQualifications.length > 0 && (
        <Card padding="md" elevation={1}>
          <div className="text-micro text-ink-secondary mb-2">Preferred qualifications</div>
          <div className="flex flex-wrap gap-2">
            {criteria.preferredQualifications.map((q) => (
              <Badge key={q} variant="success">{q}</Badge>
            ))}
          </div>
        </Card>
      )}
      {criteria.skills.length > 0 && (
        <Card padding="md" elevation={1}>
          <div className="text-micro text-ink-secondary mb-2">Skills</div>
          <div className="flex flex-wrap gap-2">
            {criteria.skills.map((s) => (
              <Badge key={s} variant="neutral">{s}</Badge>
            ))}
          </div>
        </Card>
      )}
      {criteria.minExperience != null && (
        <Card padding="md" elevation={1}>
          <div className="text-micro text-ink-secondary mb-2">Minimum experience</div>
          <div className="text-body-s text-ink">{criteria.minExperience} years</div>
        </Card>
      )}
    </div>
  );
}

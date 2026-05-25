interface Props {
  criteria: {
    subjects: string[];
    board: string;
    level: string;
    requiredQualifications: string[];
    preferredQualifications: string[];
    minExperience?: number | null;
    skills: string[];
  };
}

export function JobParsedCriteria({ criteria }: Props) {
  return (
    <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
      <h2 className="text-sm font-semibold text-ink mb-3">
        AI-Parsed Criteria
      </h2>
      <div className="space-y-4">
        {criteria.subjects.length > 0 && (
          <div>
            <p className="text-xs text-ink-tertiary mb-1">Subjects</p>
            <div className="flex flex-wrap gap-1.5">
              {criteria.subjects.map((s) => (
                <span
                  key={s}
                  className="text-xs px-2 py-0.5 rounded-full bg-surface-secondary text-ink"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {criteria.requiredQualifications.length > 0 && (
          <div>
            <p className="text-xs text-ink-tertiary mb-1">Required Qualifications</p>
            <div className="flex flex-wrap gap-1.5">
              {criteria.requiredQualifications.map((q) => (
                <span
                  key={q}
                  className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-danger"
                >
                  {q}
                </span>
              ))}
            </div>
          </div>
        )}

        {criteria.preferredQualifications.length > 0 && (
          <div>
            <p className="text-xs text-ink-tertiary mb-1">Preferred Qualifications</p>
            <div className="flex flex-wrap gap-1.5">
              {criteria.preferredQualifications.map((q) => (
                <span
                  key={q}
                  className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-success"
                >
                  {q}
                </span>
              ))}
            </div>
          </div>
        )}

        {criteria.skills.length > 0 && (
          <div>
            <p className="text-xs text-ink-tertiary mb-1">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {criteria.skills.map((s) => (
                <span
                  key={s}
                  className="text-xs px-2 py-0.5 rounded-full bg-surface-secondary text-ink"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {criteria.minExperience != null && (
          <div>
            <p className="text-xs text-ink-tertiary mb-0.5">Minimum Experience</p>
            <p className="text-sm text-ink">{criteria.minExperience} years</p>
          </div>
        )}
      </div>
    </div>
  );
}

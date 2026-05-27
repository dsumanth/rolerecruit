interface Props {
  about: string;
  title?: string;
}

export function SchoolAbout({ about, title = "Built around the teacher." }: Props) {
  const paragraphs = about.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;

  return (
    <section
      id="about"
      className="max-w-[1100px] mx-auto px-6 md:px-12 py-14 border-t border-hairline scroll-mt-20"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-8 md:gap-14 items-start">
        <div>
          <p className="text-micro text-ink-tertiary mb-2.5">About us</p>
          <h2 className="text-display-m text-ink tracking-tight">{title}</h2>
        </div>
        <div className="space-y-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-body-l text-ink-secondary leading-[1.75]">
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

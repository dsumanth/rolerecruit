interface Perk {
  label: string;
  description: string;
}

interface Props {
  perks: Perk[];
  title?: string;
}

export function SchoolPerks({ perks, title = "Real support, not just a salary." }: Props) {
  if (perks.length === 0) return null;

  return (
    <section className="max-w-[1100px] mx-auto px-6 md:px-12 py-14 border-t border-hairline">
      <div className="mb-8">
        <p className="text-micro text-ink-tertiary mb-2.5">What we offer</p>
        <h2 className="text-display-m text-ink tracking-tight">{title}</h2>
      </div>
      <ul className="divide-y divide-hairline">
        {perks.map((perk, i) => (
          <li
            key={i}
            className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-1 md:gap-6 py-5 items-baseline"
          >
            <span className="text-body text-ink-tertiary font-medium">{perk.label}</span>
            <span className="text-body-l text-ink leading-relaxed">{perk.description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

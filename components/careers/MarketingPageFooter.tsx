interface Props {
  schoolName: string;
  board: string;
  city: string;
}

export function MarketingPageFooter({ schoolName, board, city }: Props) {
  return (
    <footer className="max-w-[1100px] mx-auto px-6 md:px-12 py-7 border-t border-hairline flex flex-wrap items-center justify-between gap-3 text-caption text-ink-tertiary">
      <span>
        {schoolName} · {board} · {city}
      </span>
      <span>Careers powered by RoleRecruit</span>
    </footer>
  );
}

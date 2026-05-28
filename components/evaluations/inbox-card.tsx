import Link from "next/link";
import { Badge, Card } from "@/components/ui";

type Mode = "live" | "post" | "async";

type ModeBadgeVariant = "danger" | "warning" | "info";

const MODE_LABEL: Record<Mode, string> = {
  live: "LIVE",
  post: "POST",
  async: "ASYNC",
};

const MODE_VARIANT: Record<Mode, ModeBadgeVariant> = {
  live: "danger",
  post: "warning",
  async: "info",
};

function formatScheduledAt(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatOpensAt(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface InboxCardProps {
  invite: {
    _id: string;
    status: string;
    evaluatorRole: string;
  };
  demo: {
    _id: string;
    scheduledAt: number;
    mode: Mode;
    durationMinutes: number;
    location?: string;
  };
  candidateName: string;
  formOpensAt: number;
  formClosesAt: number;
}

export function InboxCard({
  invite,
  demo,
  candidateName,
  formOpensAt,
  formClosesAt,
}: InboxCardProps) {
  const now = Date.now();
  const isOpen = now >= formOpensAt && now <= formClosesAt;

  return (
    <Link
      href={`/evaluations/${invite._id}`}
      className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Card
        surface="card"
        elevation={1}
        interactive
        padding="md"
        className="hover:border-accent"
      >
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="text-body-m font-semibold text-ink truncate">
            {candidateName}
          </h3>
          <Badge variant={MODE_VARIANT[demo.mode]}>{MODE_LABEL[demo.mode]}</Badge>
        </div>
        <p className="text-body-s text-ink-secondary">
          {formatScheduledAt(demo.scheduledAt)}
          {demo.location ? ` · ${demo.location}` : ""}
        </p>
        <p
          className={`mt-2 text-caption font-semibold ${
            isOpen ? "text-success" : "text-ink-tertiary"
          }`}
        >
          {isOpen ? "Open now" : `Form opens ${formatOpensAt(formOpensAt)}`}
        </p>
      </Card>
    </Link>
  );
}

import { OutreachHistory } from "@/components/outreach/outreach-history";

export default function OutreachPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Outreach</h1>
      </div>
      <OutreachHistory jobId={params.id} />
    </div>
  );
}

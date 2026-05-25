import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { FeedbackForm } from "@/components/feedback/feedback-form";

export default function FeedbackPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
      <ConvexClientProvider>
        <FeedbackForm token={params.token} />
      </ConvexClientProvider>
    </div>
  );
}

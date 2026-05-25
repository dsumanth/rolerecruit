import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { BookingPageContent } from "@/components/booking/booking-page-content";

export default function BookingPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center p-6">
      <ConvexClientProvider>
        <BookingPageContent token={params.token} />
      </ConvexClientProvider>
    </div>
  );
}

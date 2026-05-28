"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Card } from "@/components/ui";

export default function FromTokenPage() {
  return (
    <ConvexClientProvider>
      <FromTokenLanding />
    </ConvexClientProvider>
  );
}

function FromTokenLanding() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const data = useQuery(
    api.evaluationInvites.getByToken,
    token ? { token } : "skip",
  );

  useEffect(() => {
    if (data?.invite?._id) {
      router.replace(
        `/evaluations/${data.invite._id}?token=${encodeURIComponent(token)}`,
      );
    }
  }, [data?.invite?._id, router, token]);

  return (
    <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
      <Card surface="card" elevation={1} padding="lg" className="max-w-[420px] text-center">
        {!token && (
          <p className="text-body-s text-ink-secondary">Missing token.</p>
        )}
        {token && data === undefined && (
          <p className="text-body-s text-ink-secondary">Loading...</p>
        )}
        {token && data === null && (
          <p className="text-body-s text-ink-secondary">
            Invitation not found or expired.
          </p>
        )}
        {token && data && data.invite && (
          <p className="text-body-s text-ink-secondary">Redirecting...</p>
        )}
      </Card>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark, Card, Button } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setError("");
    setLoading(true);

    const { error: resendError } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/sign-in",
    });

    if (resendError) {
      setError(resendError.message ?? "Could not resend verification email.");
      setLoading(false);
      return;
    }

    setResent(true);
    setLoading(false);
  };

  return (
    <Card padding="lg" elevation={1} className="w-full max-w-[420px] text-center">
      <h1 className="text-display-s text-ink mb-2">Check your email</h1>
      <p className="text-body-s text-ink-secondary mb-6">
        {email ? (
          <>We sent a verification link to <span className="text-ink font-medium">{email}</span>.</>
        ) : (
          <>We sent you a verification link. Open the email and click the link to activate your account.</>
        )}
      </p>

      {resent && (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--success)_8%,transparent)] border border-[color-mix(in_srgb,var(--success)_25%,transparent)] px-4 py-3 text-body-s text-success mb-4">
          Verification email resent.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger mb-4">
          {error}
        </div>
      )}

      {email && (
        <Button
          onClick={handleResend}
          variant="secondary"
          size="lg"
          loading={loading}
          className="w-full mb-3"
        >
          Resend verification email
        </Button>
      )}

      <Link href="/sign-in">
        <Button variant="ghost" size="lg" className="w-full">
          Back to sign in
        </Button>
      </Link>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      <div className="flex items-center gap-2.5 px-9 py-5">
        <BrandMark />
        <span className="text-title-m text-ink">RoleRecruit</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <Suspense fallback={<div className="text-body-s text-ink-secondary">Loading…</div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}

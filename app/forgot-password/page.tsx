"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark, Card, Button, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    if (resetError) {
      setError(resetError.message ?? "Could not send reset email. Try again.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      <div className="flex items-center gap-2.5 px-9 py-5">
        <BrandMark />
        <span className="text-title-m text-ink">RoleRecruit</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <Card padding="lg" elevation={1} className="w-full max-w-[420px]">
          {sent ? (
            <>
              <h1 className="text-display-s text-ink mb-1">Check your email</h1>
              <p className="text-body-s text-ink-secondary mb-6">
                If an account exists for <span className="text-ink font-medium">{email}</span>,
                you&apos;ll get a password reset link shortly.
              </p>
              <Link href="/sign-in">
                <Button variant="secondary" size="lg" className="w-full">
                  Back to sign in
                </Button>
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-display-s text-ink mb-1">Reset your password</h1>
              <p className="text-body-s text-ink-secondary mb-6">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-caption text-ink-secondary">Email</span>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    size="lg"
                  />
                </label>

                <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
                  Send reset link
                </Button>
              </form>

              <p className="text-caption text-ink-secondary text-center mt-6">
                Remember your password?{" "}
                <Link href="/sign-in" className="text-accent hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

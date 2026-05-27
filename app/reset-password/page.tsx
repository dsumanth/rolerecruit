"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark, Card, Button, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <Card padding="lg" elevation={1} className="w-full max-w-[420px]">
        <h1 className="text-display-s text-ink mb-1">Invalid reset link</h1>
        <p className="text-body-s text-ink-secondary mb-6">
          This password reset link is missing or invalid. Request a new one.
        </p>
        <Link href="/forgot-password">
          <Button variant="primary" size="lg" className="w-full">
            Request new link
          </Button>
        </Link>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    if (resetError) {
      setError(resetError.message ?? "Could not reset password. Try again or request a new link.");
      setLoading(false);
      return;
    }

    router.push("/sign-in");
  };

  return (
    <Card padding="lg" elevation={1} className="w-full max-w-[420px]">
      <h1 className="text-display-s text-ink mb-1">Set new password</h1>
      <p className="text-body-s text-ink-secondary mb-6">
        Choose a new password for your account.
      </p>

      {error && (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-secondary">New password</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            size="lg"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-secondary">Confirm password</span>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            size="lg"
          />
        </label>

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          Reset password
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      <div className="flex items-center gap-2.5 px-9 py-5">
        <BrandMark />
        <span className="text-title-m text-ink">RoleRecruit</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <Suspense fallback={<div className="text-body-s text-ink-secondary">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark, Card, Button, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: redirectUrl,
    });

    if (signInError) {
      setError(signInError.message ?? "Sign-in failed. Check your email and password.");
      setLoading(false);
      return;
    }

    router.push(redirectUrl);
  };

  return (
    <Card padding="lg" elevation={1} className="w-full max-w-[420px]">
      <h1 className="text-display-s text-ink mb-1">Sign in</h1>
      <p className="text-body-s text-ink-secondary mb-6">
        Welcome back to RoleRecruit.
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
            placeholder="you@school.edu"
            autoComplete="email"
            required
            size="lg"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-secondary">Password</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            size="lg"
          />
        </label>

        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="text-caption text-accent hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="text-caption text-ink-secondary text-center mt-6">
        Don&apos;t have an account?{" "}
        <Link
          href={`/sign-up${redirectUrl !== "/dashboard" ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
          className="text-accent hover:underline"
        >
          Sign up
        </Link>
      </p>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      <div className="flex items-center gap-2.5 px-9 py-5">
        <BrandMark />
        <span className="text-title-m text-ink">RoleRecruit</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <Suspense fallback={<div className="text-body-s text-ink-secondary">Loading…</div>}>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}

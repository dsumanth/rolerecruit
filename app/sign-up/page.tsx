"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark, Card, Button, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");
  const inviteEmail = searchParams.get("invite_email");

  const isInviteFlow = Boolean(inviteEmail);
  const callbackURL = redirectUrl ?? "/onboarding";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Hard-block: if signing up via an invite link, the email must match.
    if (isInviteFlow && email.toLowerCase() !== inviteEmail!.toLowerCase()) {
      setError("Please sign up with the email address the invitation was sent to.");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL,
    });

    if (signUpError) {
      setError(signUpError.message ?? "Sign-up failed. Try again.");
      setLoading(false);
      return;
    }

    // After sign-up, user must verify email before they can sign in.
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  };

  return (
    <Card padding="lg" elevation={1} className="w-full max-w-[420px]">
      <h1 className="text-display-s text-ink mb-1">Create your account</h1>
      <p className="text-body-s text-ink-secondary mb-6">
        {isInviteFlow ? "Finish accepting your invitation." : "Get started with RoleRecruit."}
      </p>

      {error && (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-secondary">Full name</span>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            size="lg"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-secondary">
            Email{isInviteFlow ? " (locked to invitation)" : ""}
          </span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            autoComplete="email"
            required
            size="lg"
            readOnly={isInviteFlow}
            className={isInviteFlow ? "opacity-70 cursor-not-allowed" : ""}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-secondary">Password</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            size="lg"
          />
          <span className="text-caption text-ink-tertiary">At least 8 characters.</span>
        </label>

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      <p className="text-caption text-ink-secondary text-center mt-6">
        Already have an account?{" "}
        <Link
          href={`/sign-in${redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
          className="text-accent hover:underline"
        >
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      <div className="flex items-center gap-2.5 px-9 py-5">
        <BrandMark />
        <span className="text-title-m text-ink">RoleRecruit</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <Suspense fallback={<div className="text-body-s text-ink-secondary">Loading…</div>}>
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  );
}

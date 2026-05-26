"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Card, Button } from "@/components/ui";
import { nameInitial } from "@/components/ui/avatar";
import Link from "next/link";

type InviteData = {
  token: string;
  email: string;
  role: string;
  status: string;
  expiresAt: number;
  schoolName: string;
};

const ROLE_LABELS: Record<string, string> = {
  hr_admin: "HR admin",
  principal: "Principal",
  hod: "HOD",
  viewer: "Viewer",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function AcceptInviteInner({ invite, token }: { invite: InviteData; token: string }) {
  const router = useRouter();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const acceptInvite = useMutation(api.invitations.accept);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  const isValid = invite.status === "pending" && Date.now() < invite.expiresAt;

  if (!isValid) {
    const reason =
      invite.status === "accepted"
        ? "This invitation has already been accepted."
        : invite.status === "revoked"
          ? "This invitation has been revoked."
          : invite.status === "expired" || Date.now() > invite.expiresAt
            ? "This invitation has expired."
            : "This invitation is no longer valid.";

    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <h1 className="text-title-l text-ink mb-2">Invitation no longer available</h1>
        <p className="text-body-s text-ink-secondary">{reason}</p>
      </Card>
    );
  }

  if (!authLoaded) {
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <p className="text-body-s text-ink-secondary">Loading...</p>
      </Card>
    );
  }

  if (!isSignedIn) {
    const returnUrl = `/accept-invite/${token}`;
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto">
        <div className="flex items-center gap-2.5 pb-5 mb-5 border-b border-hairline">
          <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-body-s font-bold flex items-center justify-center">
            {nameInitial(invite.schoolName, "·")}
          </div>
          <div className="min-w-0">
            <p className="text-body-s font-medium text-ink truncate">{invite.schoolName}</p>
            <p className="text-caption text-ink-secondary truncate">{roleLabel(invite.role)} invitation</p>
          </div>
        </div>
        <h1 className="text-display-s text-ink mb-2">You're invited</h1>
        <p className="text-body-s text-ink-secondary mb-6">
          Sign in or create an account to accept this invitation.
        </p>
        <div className="flex gap-3">
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`} className="flex-1">
            <Button variant="secondary" size="lg" className="w-full">Sign in</Button>
          </Link>
          <Link href={`/sign-up?redirect_url=${encodeURIComponent(returnUrl)}`} className="flex-1">
            <Button variant="primary" size="lg" className="w-full">Sign up</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const emailMismatch =
    user?.primaryEmailAddress?.emailAddress &&
    user.primaryEmailAddress.emailAddress.toLowerCase() !== invite.email.toLowerCase();

  const handleAccept = async () => {
    if (!user) return;
    setError("");
    setAccepting(true);
    try {
      await acceptInvite({
        token,
        userId: user.id,
        name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "User",
        email: user.primaryEmailAddress?.emailAddress ?? "",
      });
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setAccepting(false);
    }
  };

  return (
    <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto">
      <div className="flex items-center gap-2.5 pb-5 mb-5 border-b border-hairline">
        <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-body-s font-bold flex items-center justify-center">
          {nameInitial(invite.schoolName, "·")}
        </div>
        <div className="min-w-0">
          <p className="text-body-s font-medium text-ink truncate">{invite.schoolName}</p>
          <p className="text-caption text-ink-secondary truncate">{roleLabel(invite.role)} invitation</p>
        </div>
      </div>

      <h1 className="text-display-s text-ink mb-1">Accept invitation</h1>
      <p className="text-body-s text-ink-secondary mb-6">
        Joining as <span className="text-ink font-medium">{roleLabel(invite.role)}</span> at{" "}
        <span className="text-ink font-medium">{invite.schoolName}</span>.
      </p>

      {emailMismatch ? (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] border border-[color-mix(in_srgb,var(--warning)_25%,transparent)] px-4 py-3 text-body-s text-warning">
          This invitation was sent to <span className="font-medium">{invite.email}</span>.
          You're signed in as <span className="font-medium">{user?.primaryEmailAddress?.emailAddress}</span>.
          Please sign in with the invited email address.
        </div>
      ) : (
        <>
          {error && (
            <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger mb-4">
              {error}
            </div>
          )}
          <Button onClick={handleAccept} variant="primary" size="lg" loading={accepting} className="w-full">
            Accept invitation
          </Button>
        </>
      )}
    </Card>
  );
}

export function AcceptInviteClient({ invite, token }: { invite: InviteData; token: string }) {
  return (
    <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
      <ConvexClientProvider>
        <AcceptInviteInner invite={invite} token={token} />
      </ConvexClientProvider>
    </div>
  );
}

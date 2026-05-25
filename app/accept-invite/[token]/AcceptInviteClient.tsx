"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

type InviteData = {
  token: string;
  email: string;
  role: string;
  status: string;
  expiresAt: number;
  schoolName: string;
};

const ROLE_LABELS: Record<string, string> = {
  hr_admin: "HR Admin",
  principal: "Principal",
  hod: "HOD",
  viewer: "Viewer",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function AcceptInviteInner({
  invite,
  token,
}: {
  invite: InviteData;
  token: string;
}) {
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
      <div className="max-w-md w-full mx-auto text-center">
        <div className="text-4xl mb-4">📧</div>
        <h1 className="text-xl font-semibold text-ink mb-2">
          Invitation No Longer Available
        </h1>
        <p className="text-ink-secondary text-sm">{reason}</p>
      </div>
    );
  }

  if (!authLoaded) {
    return <div className="text-sm text-ink-secondary">Loading...</div>;
  }

  if (!isSignedIn) {
    const returnUrl = `/accept-invite/${token}`;
    return (
      <div className="max-w-md w-full mx-auto text-center">
        <div className="text-4xl mb-4">👋</div>
        <h1 className="text-xl font-semibold text-ink mb-2">
          You're Invited!
        </h1>
        <p className="text-ink-secondary text-sm mb-6">
          You've been invited to join <strong className="text-ink">{invite.schoolName}</strong> as{" "}
          <strong className="text-ink">{roleLabel(invite.role)}</strong>. Sign in or create an account to accept.
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href={`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`}
            className="inline-flex items-center px-5 py-2.5 rounded-apple bg-surface-canvas text-ink text-sm font-medium hover:bg-[#e8e8ed] transition-colors"
          >
            Sign In
          </a>
          <a
            href={`/sign-up?redirect_url=${encodeURIComponent(returnUrl)}`}
            className="inline-flex items-center px-5 py-2.5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] transition-colors"
          >
            Sign Up
          </a>
        </div>
      </div>
    );
  }

  const emailMismatch =
    user?.primaryEmailAddress?.emailAddress &&
    user.primaryEmailAddress.emailAddress.toLowerCase() !==
      invite.email.toLowerCase();

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
    <div className="max-w-md w-full mx-auto text-center">
      <div className="text-4xl mb-4">🎉</div>
      <h1 className="text-xl font-semibold text-ink mb-2">
        Accept Invitation
      </h1>
      <p className="text-ink-secondary text-sm mb-1">
        Join <strong className="text-ink">{invite.schoolName}</strong>
      </p>
      <p className="text-ink-secondary text-sm mb-6">
        as <strong className="text-ink">{roleLabel(invite.role)}</strong>
      </p>

      {emailMismatch ? (
        <div className="px-4 py-3 rounded-apple bg-[#fff9f0] text-sm text-[#ff9500] mb-4">
          This invitation was sent to <strong>{invite.email}</strong>. You are
          signed in as{" "}
          <strong>{user?.primaryEmailAddress?.emailAddress}</strong>. Please sign
          in with the invited email address.
        </div>
      ) : (
        <>
          {error && (
            <div className="px-4 py-3 rounded-apple bg-[#fff2f0] text-sm text-[#ff3b30] mb-4">
              {error}
            </div>
          )}
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="inline-flex items-center px-6 py-2.5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] disabled:opacity-50 transition-colors"
          >
            {accepting ? "Accepting..." : "Accept Invitation"}
          </button>
        </>
      )}
    </div>
  );
}

export function AcceptInviteClient({
  invite,
  token,
}: {
  invite: InviteData;
  token: string;
}) {
  return (
    <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
      <ConvexClientProvider>
        <AcceptInviteInner invite={invite} token={token} />
      </ConvexClientProvider>
    </div>
  );
}

import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";

export async function requireProfile() {
  // Single source of truth: ask Convex for the current user. Skips the extra
  // isAuthenticated() round trip, which can briefly disagree with the user
  // query right after sign-in while auth state propagates.
  const user = await fetchAuthQuery(api.auth.getCurrentUser);

  if (!user) {
    redirect("/sign-in");
  }

  const profile = await fetchAuthQuery(api.users.getProfile, {
    userId: user._id,
  });

  if (!profile) {
    redirect("/onboarding");
  }

  return { userId: user._id, profile };
}

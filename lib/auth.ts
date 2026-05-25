import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function requireProfile() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const profile = await fetchQuery(api.users.getProfile, { userId });

  if (!profile) {
    redirect("/onboarding");
  }

  return { userId, profile };
}

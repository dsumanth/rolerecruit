import { useMemo } from "react";
import { authClient } from "@/lib/auth-client";

export function useSession() {
  const { data, isPending, error } = authClient.useSession();
  return useMemo(
    () => ({
      signedIn: !!data?.session,
      user: data?.user ?? null,
      session: data?.session ?? null,
      loading: isPending,
      error,
      signOut: () => authClient.signOut(),
    }),
    [data, isPending, error],
  );
}

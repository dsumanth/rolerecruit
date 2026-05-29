import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSession } from "@/hooks/use-session";
import { requestAndGetExpoPushToken } from "@/lib/push";

export function useRegisterPushToken() {
  const { signedIn, user } = useSession();
  const profile = useQuery(
    api.users.getProfile,
    signedIn && user?.id ? { userId: user.id } : "skip",
  );
  const register = useMutation(api.users.registerExpoToken);
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!signedIn || !profile?._id) return;
    let cancelled = false;
    (async () => {
      const token = await requestAndGetExpoPushToken();
      if (!token || cancelled) return;
      if (registeredRef.current === token) return;
      await register({ userId: profile._id, token });
      registeredRef.current = token;
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, profile?._id, register]);
}

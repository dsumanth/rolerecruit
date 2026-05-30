import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const baseURL =
  (Constants.expoConfig?.extra?.betterAuthBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_BETTER_AUTH_URL;

if (!baseURL) {
  throw new Error(
    "Better Auth base URL is not configured. Set extra.betterAuthBaseUrl in app.json or EXPO_PUBLIC_BETTER_AUTH_URL.",
  );
}

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    convexClient(),
    emailOTPClient(),
    expoClient({
      scheme: "rolerecruit",
      storagePrefix: "rolerecruit",
      storage: SecureStore,
    }),
  ],
});

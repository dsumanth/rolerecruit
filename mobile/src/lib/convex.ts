import { ConvexReactClient } from "convex/react";
import Constants from "expo-constants";

const convexUrl =
  (Constants.expoConfig?.extra?.convexUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Convex URL is not configured. Set extra.convexUrl in app.json or EXPO_PUBLIC_CONVEX_URL.",
  );
}

export const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

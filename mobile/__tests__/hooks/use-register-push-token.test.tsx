import { renderHook, waitFor } from "@testing-library/react-native";

const mockRegisterMutation = jest.fn().mockResolvedValue(undefined);
const mockProfile = { _id: "profile_id_1" };

jest.mock("convex/react", () => ({
  useMutation: () => mockRegisterMutation,
  useQuery: () => mockProfile,
}));

jest.mock("@/hooks/use-session", () => ({
  useSession: () => ({
    signedIn: true,
    user: { id: "user_better_auth_id" },
    session: { id: "s" },
  }),
}));

jest.mock("@convex/_generated/api", () => ({
  api: {
    users: {
      registerExpoToken: "users:registerExpoToken",
      getProfile: "users:getProfile",
    },
  },
}));

import { useRegisterPushToken } from "@/hooks/use-register-push-token";

describe("useRegisterPushToken", () => {
  beforeEach(() => mockRegisterMutation.mockClear());

  it("requests a push token and calls registerExpoToken on mount when signed in", async () => {
    renderHook(() => useRegisterPushToken());
    await waitFor(() =>
      expect(mockRegisterMutation).toHaveBeenCalledWith({
        userId: "profile_id_1",
        token: "ExpoTestToken[xxx]",
      }),
    );
  });
});

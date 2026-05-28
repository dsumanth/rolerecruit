import { render, screen, fireEvent } from "@testing-library/react-native";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: () => ({ params: { applicationId: "a1", parentDemoId: "d-parent" } }),
}));

jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => ({ schoolId: "s1", userProfileId: "u-hr" }),
}));
jest.mock("@/hooks/use-staff-directory", () => ({
  useStaffDirectory: () => ({ staff: [] }),
}));
jest.mock("@/hooks/use-active-decision-rules", () => ({
  useActiveDecisionRules: () => ({ rules: [] }),
}));

const parentInvitesResult = [
  {
    _id: "i1",
    evaluatorUserId: "u1",
    evaluatorRole: "principal",
    status: "submitted",
    profile: null,
  },
  {
    _id: "i2",
    evaluatorUserId: "u-skip",
    evaluatorRole: "hod",
    status: "cancelled",
    profile: null,
  },
];

jest.mock("convex/react", () => ({
  useMutation: () => jest.fn(),
  useQuery: (name: string) => {
    if (typeof name === "string" && name.includes("evaluationInvites:listForDemoWithProfiles")) {
      return parentInvitesResult;
    }
    return undefined;
  },
}));

jest.mock("@convex/_generated/api", () => ({
  api: {
    demoSessions: { create: "demoSessions:create" },
    evaluationInvites: {
      listForDemoWithProfiles: "evaluationInvites:listForDemoWithProfiles",
    },
  },
}));

import { ScheduleDemoScreen } from "@/screens/schedule-demo";

describe("ScheduleDemoScreen (re-demo)", () => {
  it("mounts cleanly on step 1 with prefill from parent demo", () => {
    render(<ScheduleDemoScreen />);
    expect(screen.getByText(/Step 1 of 3/)).toBeTruthy();
  });

  it("carries non-cancelled evaluators forward into the wizard draft", () => {
    render(<ScheduleDemoScreen />);
    // Advance to step 2 where the "Evaluators (N)" label is rendered.
    fireEvent.press(screen.getByText("Next"));
    // Only the submitted invite should be carried forward; the cancelled one is skipped.
    expect(screen.getByText(/Evaluators \(1\)/)).toBeTruthy();
  });

  it("defaults the date roughly +3 days from now", () => {
    render(<ScheduleDemoScreen />);
    const expected = new Date(Date.now() + 3 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expectedDate = `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}`;
    expect(screen.getByDisplayValue(expectedDate)).toBeTruthy();
  });
});

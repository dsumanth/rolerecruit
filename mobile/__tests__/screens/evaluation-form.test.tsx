import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { EvaluationFormScreen } from "@/screens/evaluation-form";

const mockTemplate = {
  _id: "tpl1",
  fields: [
    { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5", required: true },
    { key: "comments", label: "Comments", type: "text", allowDictation: true },
  ],
};

const mockInvite = { _id: "i1", formTemplateId: "tpl1", demoSessionId: "d1", evaluatorRole: "principal" };

const mockSubmitMutation = jest.fn().mockResolvedValue(undefined);

jest.mock("convex/react", () => ({
  useQuery: jest.fn().mockImplementation((q: any) => {
    if (q === "evaluationInvites:get") return mockInvite;
    if (q === "formTemplates:getById") return mockTemplate;
    return null;
  }),
  useMutation: () => mockSubmitMutation,
}));

jest.mock("@convex/_generated/api", () => ({
  api: {
    evaluationInvites: { get: "evaluationInvites:get" },
    formTemplates: { getById: "formTemplates:getById" },
    evaluations: { submit: "evaluations:submit" },
  },
}));

function withNav(node: React.ReactNode) {
  return <NavigationContainer>{node}</NavigationContainer>;
}

describe("EvaluationFormScreen", () => {
  it("renders one input per template field plus recommendation + submit", () => {
    render(withNav(
      <EvaluationFormScreen
        navigation={{ goBack: jest.fn(), reset: jest.fn(), navigate: jest.fn() } as any}
        route={{ params: { inviteId: "i1", demoId: "d1" } } as any}
      />,
    ));
    expect(screen.getByText("Subject knowledge")).toBeTruthy();
    expect(screen.getByText("Comments")).toBeTruthy();
    expect(screen.getByText("Recommendation")).toBeTruthy();
    expect(screen.getByText("Submit evaluation")).toBeTruthy();
  });

  it("submits collected responses including recommendation", async () => {
    render(withNav(
      <EvaluationFormScreen
        navigation={{ goBack: jest.fn(), reset: jest.fn(), navigate: jest.fn() } as any}
        route={{ params: { inviteId: "i1", demoId: "d1" } } as any}
      />,
    ));
    fireEvent.press(screen.getByLabelText("score-4"));
    fireEvent.changeText(screen.getByPlaceholderText("Type your notes..."), "Strong delivery");
    fireEvent.press(screen.getByText("Hire"));
    fireEvent.press(screen.getByText("Submit evaluation"));
    await waitFor(() =>
      expect(mockSubmitMutation).toHaveBeenCalledWith({
        inviteId: "i1",
        responses: { subjectKnowledge: 4, comments: "Strong delivery" },
        recommendation: "hire",
        voiceInputs: undefined,
        submittedFromPlatform: expect.stringMatching(/mobile_ios|mobile_android/),
      }),
    );
  });
});
